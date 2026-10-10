-- ============================================================
-- POS Pearl — Quick Service + Membership + RBAC
-- รันทั้งไฟล์นี้ใน Supabase SQL Editor (ครั้งเดียว)
-- ============================================================

create extension if not exists pgcrypto;

-- ---------- helpers ----------
create or replace function public.today_th() returns date
language sql stable as $$ select (now() at time zone 'Asia/Bangkok')::date $$;

-- ---------- tables ----------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text,
  role text not null default 'staff' check (role in ('staff','admin')),
  is_active boolean not null default true,
  created_at timestamptz default now()
);

create table categories (
  id serial primary key,
  name_en text not null,
  name_th text not null
);

create table products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price numeric(10,2) not null check (price >= 0),
  category_id int references categories(id),
  image_url text,
  is_available boolean default true,
  created_at timestamptz default now()
);

create table members (
  id uuid primary key default gen_random_uuid(),
  phone text unique not null check (phone ~ '^0[0-9]{9}$'),
  full_name text not null,
  email text,
  birthday date,
  pin_hash text not null,
  points int not null default 0 check (points >= 0),
  lifetime_spend numeric(12,2) not null default 0,
  tier text not null default 'member' check (tier in ('member','silver','gold')),
  pdpa_consent_at timestamptz not null,
  marketing_consent boolean not null default false,
  is_active boolean not null default true,
  failed_pin_attempts int not null default 0,
  locked_until timestamptz,
  registered_by uuid references profiles(id),
  created_at timestamptz default now()
);

create table orders (
  id uuid primary key default gen_random_uuid(),
  public_token uuid not null default gen_random_uuid(),   -- ให้ลูกค้าติดตามสถานะออเดอร์ตัวเอง
  queue_date date not null default public.today_th(),
  queue_no int not null,
  source text not null check (source in ('counter','qr')),
  status text not null default 'pending'
    check (status in ('awaiting_payment','pending','preparing','ready','done','cancelled')),
  payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid','paid','refunded')),
  payment_method text check (payment_method in ('cash','promptpay')),
  member_id uuid references members(id),
  subtotal numeric(10,2) not null,
  discount numeric(10,2) not null default 0,
  tax numeric(10,2) not null,
  total numeric(10,2) not null,
  points_earned int not null default 0,
  points_used int not null default 0,
  cancel_reason text,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  unique (queue_date, queue_no)
);
create index orders_created_idx on orders (created_at desc);
create index orders_token_idx on orders (public_token);

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) on delete cascade,
  product_id uuid references products(id),
  name text not null,
  price numeric(10,2) not null,
  quantity int not null check (quantity > 0)
);

create table point_transactions (
  id bigserial primary key,
  member_id uuid not null references members(id) on delete cascade,
  order_id uuid references orders(id),
  type text not null check (type in ('earn','redeem','refund_earn','refund_redeem','adjust')),
  points int not null,
  note text,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

create table settings (
  key text primary key,
  value jsonb not null
);

create table audit_logs (
  id bigserial primary key,
  user_id uuid references profiles(id),
  action text not null,
  detail jsonb,
  created_at timestamptz default now()
);

-- ---------- seed ----------
insert into settings (key, value) values
  ('shop_name', '"POS Pearl"'),
  ('tax_rate', '0.07'),
  ('promptpay_id', '"0000000000"'),
  ('earn_baht_per_point', '25'),
  ('redeem_baht_per_10_points', '10'),
  ('max_redeem_percent', '50'),
  ('tier_silver_spend', '3000'),
  ('tier_gold_spend', '10000');

insert into categories (name_en, name_th) values
  ('Drinks','เครื่องดื่ม'), ('Food','อาหาร'), ('Desserts','ของหวาน');

insert into products (name, price, category_id) values
  ('Iced Americano', 55, 1), ('Thai Milk Tea', 50, 1), ('Matcha Latte', 65, 1),
  ('Pad Kra Pao', 70, 2), ('Chicken Rice', 60, 2), ('Club Sandwich', 85, 2),
  ('Chocolate Brownie', 55, 3), ('Mango Sticky Rice', 80, 3);

-- ---------- role helpers ----------
create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and is_active);
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin' and is_active);
$$;

create or replace function public.setting_num(k text, d numeric) returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce((select (value #>> '{}')::numeric from settings where key = k), d);
$$;

create or replace function public._tier_for(spend numeric) returns text
language sql stable security definer set search_path = public as $$
  select case
    when spend >= setting_num('tier_gold_spend', 10000) then 'gold'
    when spend >= setting_num('tier_silver_spend', 3000) then 'silver'
    else 'member' end;
$$;

-- ---------- core: สร้างออเดอร์ (คำนวณราคาฝั่ง DB เสมอ) ----------
create or replace function public._build_order(
  p_items jsonb, p_member uuid, p_points int, p_source text,
  p_status text, p_method text, p_paystatus text, p_user uuid
) returns public.orders
language plpgsql security definer set search_path = public as $$
declare
  it jsonb; prod products; qty int;
  sub numeric := 0; disc numeric := 0; tax numeric; total numeric;
  m members; used int := 0; earned int := 0; mult numeric := 1;
  max_pct numeric; baht10 numeric; max_pts int; q int;
  lines jsonb := '[]'::jsonb; o orders;
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'empty cart';
  end if;

  for it in select * from jsonb_array_elements(p_items) loop
    qty := (it->>'quantity')::int;
    if qty is null or qty < 1 or qty > 99 then raise exception 'invalid quantity'; end if;
    select * into prod from products where id = (it->>'product_id')::uuid and is_available;
    if not found then raise exception 'product unavailable'; end if;
    sub := sub + prod.price * qty;
    lines := lines || jsonb_build_object(
      'product_id', prod.id, 'name', prod.name, 'price', prod.price, 'quantity', qty);
  end loop;

  if p_member is not null then
    select * into m from members where id = p_member and is_active;
    if not found then raise exception 'member not found'; end if;
    mult := case m.tier when 'gold' then 1.5 when 'silver' then 1.2 else 1 end;
    max_pct := setting_num('max_redeem_percent', 50);
    baht10 := setting_num('redeem_baht_per_10_points', 10);
    max_pts := (floor((sub * max_pct / 100) / baht10)::int) * 10;
    used := least(greatest(coalesce(p_points, 0), 0), m.points, max_pts);
    used := used - (used % 10);
    disc := used / 10.0 * baht10;
    earned := floor((sub - disc) / setting_num('earn_baht_per_point', 25) * mult)::int;
  end if;

  tax := round((sub - disc) * setting_num('tax_rate', 0.07), 2);
  total := sub - disc + tax;

  perform pg_advisory_xact_lock(884422);   -- กันเลขคิวซ้ำ
  select coalesce(max(queue_no), 0) + 1 into q from orders where queue_date = today_th();

  insert into orders (queue_no, source, status, payment_status, payment_method, member_id,
                      subtotal, discount, tax, total, points_earned, points_used, created_by)
  values (q, p_source, p_status, p_paystatus, p_method, p_member,
          sub, disc, tax, total, earned, used, p_user)
  returning * into o;

  insert into order_items (order_id, product_id, name, price, quantity)
  select o.id, x.product_id, x.name, x.price, x.quantity
  from jsonb_to_recordset(lines) as x(product_id uuid, name text, price numeric, quantity int);

  return o;
end $$;

-- ใช้/สะสมแต้มเมื่อชำระเงินแล้ว
create or replace function public._apply_points(o public.orders, uid uuid) returns void
language plpgsql security definer set search_path = public as $$
declare m members; net numeric;
begin
  if o.member_id is null then return; end if;
  select * into m from members where id = o.member_id for update;
  if m.points < o.points_used then raise exception 'not enough points'; end if;
  net := o.subtotal - o.discount;
  if o.points_used > 0 then
    insert into point_transactions (member_id, order_id, type, points, note, created_by)
    values (m.id, o.id, 'redeem', -o.points_used, 'Q' || lpad(o.queue_no::text, 3, '0'), uid);
  end if;
  if o.points_earned > 0 then
    insert into point_transactions (member_id, order_id, type, points, note, created_by)
    values (m.id, o.id, 'earn', o.points_earned, 'Q' || lpad(o.queue_no::text, 3, '0'), uid);
  end if;
  update members set
    points = points - o.points_used + o.points_earned,
    lifetime_spend = lifetime_spend + net,
    tier = _tier_for(lifetime_spend + net)
  where id = m.id;
end $$;

create or replace function public._audit(uid uuid, act text, det jsonb) returns void
language sql security definer set search_path = public as $$
  insert into audit_logs (user_id, action, detail) values (uid, act, det);
$$;

-- ---------- RPC: staff ----------
create or replace function public.place_order(
  p_items jsonb, p_member_id uuid, p_points_to_use int, p_payment_method text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare o orders;
begin
  if not is_staff() then raise exception 'forbidden'; end if;
  if p_payment_method not in ('cash','promptpay') then raise exception 'invalid payment method'; end if;
  o := _build_order(p_items, p_member_id, p_points_to_use, 'counter', 'pending',
                    p_payment_method, 'paid', auth.uid());
  perform _apply_points(o, auth.uid());
  perform _audit(auth.uid(), 'order.create', jsonb_build_object('order_id', o.id, 'queue_no', o.queue_no, 'total', o.total));
  return to_jsonb(o);
end $$;

create or replace function public.confirm_qr_payment(p_order_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare o orders;
begin
  if not is_staff() then raise exception 'forbidden'; end if;
  select * into o from orders where id = p_order_id for update;
  if not found or o.status <> 'awaiting_payment' then raise exception 'order not awaiting payment'; end if;
  update orders set status = 'pending', payment_status = 'paid' where id = o.id returning * into o;
  perform _apply_points(o, auth.uid());
  perform _audit(auth.uid(), 'order.confirm_payment', jsonb_build_object('order_id', o.id, 'queue_no', o.queue_no));
  return to_jsonb(o);
end $$;

create or replace function public.set_order_status(p_order_id uuid, p_status text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare o orders;
begin
  if not is_staff() then raise exception 'forbidden'; end if;
  select * into o from orders where id = p_order_id for update;
  if not found then raise exception 'order not found'; end if;
  if not ((o.status = 'pending' and p_status = 'preparing')
       or (o.status = 'preparing' and p_status = 'ready')
       or (o.status = 'ready' and p_status = 'done')) then
    raise exception 'invalid status transition';
  end if;
  update orders set status = p_status where id = o.id returning * into o;
  return to_jsonb(o);
end $$;

-- ---------- RPC: admin ----------
create or replace function public.cancel_order(p_order_id uuid, p_reason text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare o orders; m members; net numeric; new_pts int;
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  select * into o from orders where id = p_order_id for update;
  if not found then raise exception 'order not found'; end if;
  if o.status = 'cancelled' then raise exception 'already cancelled'; end if;

  if o.payment_status = 'paid' and o.member_id is not null then
    select * into m from members where id = o.member_id for update;
    net := o.subtotal - o.discount;
    if o.points_used > 0 then
      insert into point_transactions (member_id, order_id, type, points, note, created_by)
      values (m.id, o.id, 'refund_redeem', o.points_used, p_reason, auth.uid());
    end if;
    if o.points_earned > 0 then
      insert into point_transactions (member_id, order_id, type, points, note, created_by)
      values (m.id, o.id, 'refund_earn', -least(o.points_earned, m.points + o.points_used), p_reason, auth.uid());
    end if;
    new_pts := greatest(m.points + o.points_used - o.points_earned, 0);
    update members set
      points = new_pts,
      lifetime_spend = greatest(lifetime_spend - net, 0),
      tier = _tier_for(greatest(lifetime_spend - net, 0))
    where id = m.id;
  end if;

  update orders set
    status = 'cancelled',
    payment_status = case when payment_status = 'paid' then 'refunded' else payment_status end,
    cancel_reason = p_reason
  where id = o.id returning * into o;
  perform _audit(auth.uid(), 'order.cancel', jsonb_build_object('order_id', o.id, 'reason', p_reason));
  return to_jsonb(o);
end $$;

create or replace function public.adjust_points(p_member_id uuid, p_delta int, p_note text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare m members;
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  if p_note is null or length(trim(p_note)) = 0 then raise exception 'reason required'; end if;
  select * into m from members where id = p_member_id for update;
  if not found then raise exception 'member not found'; end if;
  if m.points + p_delta < 0 then raise exception 'points would be negative'; end if;
  update members set points = points + p_delta where id = m.id returning * into m;
  insert into point_transactions (member_id, type, points, note, created_by)
  values (m.id, 'adjust', p_delta, p_note, auth.uid());
  perform _audit(auth.uid(), 'member.adjust_points',
    jsonb_build_object('member_id', m.id, 'delta', p_delta, 'note', p_note));
  return jsonb_build_object('points', m.points);
end $$;

create sequence if not exists anon_phone_seq;
create or replace function public.anonymize_member(p_member_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  update members set
    full_name = 'Deleted member',
    phone = '0' || lpad(nextval('anon_phone_seq')::text, 9, '0'),
    email = null, birthday = null,
    pin_hash = gen_random_uuid()::text,
    marketing_consent = false, is_active = false
  where id = p_member_id;
  perform _audit(auth.uid(), 'member.anonymize', jsonb_build_object('member_id', p_member_id));
end $$;

-- ---------- RPC: ลูกค้าสั่งผ่าน QR (เรียกจาก API Route ด้วย Service Role เท่านั้น) ----------
create or replace function public.create_qr_order(p_items jsonb, p_member_id uuid, p_points_to_use int)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare o orders;
begin
  o := _build_order(p_items, p_member_id, p_points_to_use, 'qr', 'awaiting_payment',
                    'promptpay', 'unpaid', null);
  return to_jsonb(o);
end $$;

-- ---------- สิทธิ์การเรียกฟังก์ชัน ----------
revoke all on function public._build_order(jsonb,uuid,int,text,text,text,text,uuid) from public, anon, authenticated;
revoke all on function public._apply_points(public.orders,uuid) from public, anon, authenticated;
revoke all on function public._audit(uuid,text,jsonb) from public, anon, authenticated;
revoke all on function public.create_qr_order(jsonb,uuid,int) from public, anon, authenticated;
grant execute on function public.create_qr_order(jsonb,uuid,int) to service_role;

revoke all on function public.place_order(jsonb,uuid,int,text) from public, anon;
revoke all on function public.confirm_qr_payment(uuid) from public, anon;
revoke all on function public.set_order_status(uuid,text) from public, anon;
revoke all on function public.cancel_order(uuid,text) from public, anon;
revoke all on function public.adjust_points(uuid,int,text) from public, anon;
revoke all on function public.anonymize_member(uuid) from public, anon;
grant execute on function public.place_order(jsonb,uuid,int,text) to authenticated;
grant execute on function public.confirm_qr_payment(uuid) to authenticated;
grant execute on function public.set_order_status(uuid,text) to authenticated;
grant execute on function public.cancel_order(uuid,text) to authenticated;
grant execute on function public.adjust_points(uuid,int,text) to authenticated;
grant execute on function public.anonymize_member(uuid) to authenticated;

-- ---------- Row Level Security ----------
alter table profiles enable row level security;
alter table categories enable row level security;
alter table products enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table members enable row level security;
alter table point_transactions enable row level security;
alter table settings enable row level security;
alter table audit_logs enable row level security;

create policy "profiles read" on profiles for select
  using (id = auth.uid() or public.is_admin());
create policy "profiles admin write" on profiles for update
  using (public.is_admin()) with check (public.is_admin());

create policy "categories read" on categories for select using (public.is_staff());
create policy "categories admin" on categories for all
  using (public.is_admin()) with check (public.is_admin());

create policy "products read" on products for select using (public.is_staff());
create policy "products write" on products for all
  using (public.is_admin()) with check (public.is_admin());

-- orders: staff เห็นเฉพาะวันนี้, admin เห็นทั้งหมด. การสร้าง/เปลี่ยนสถานะ/ยกเลิก ทำผ่าน RPC เท่านั้น
create policy "orders read" on orders for select
  using (public.is_staff() and (public.is_admin() or queue_date = public.today_th()));

create policy "order_items read" on order_items for select
  using (exists (select 1 from orders o where o.id = order_id));

create policy "members read staff" on members for select using (public.is_staff());
create policy "members admin write" on members for update
  using (public.is_admin()) with check (public.is_admin());
create policy "members admin delete" on members for delete using (public.is_admin());

create policy "points read" on point_transactions for select using (public.is_staff());

create policy "settings read" on settings for select using (public.is_staff());
create policy "settings write" on settings for all
  using (public.is_admin()) with check (public.is_admin());

create policy "audit read" on audit_logs for select using (public.is_admin());
create policy "audit insert admin" on audit_logs for insert with check (public.is_admin());

-- ป้องกัน pin_hash หลุดไป client: ถอดสิทธิ์อ่านคอลัมน์ลับ แล้วให้อ่านผ่าน view
revoke select on members from anon, authenticated;
grant select (id, phone, full_name, email, birthday, points, lifetime_spend, tier,
              pdpa_consent_at, marketing_consent, is_active, registered_by, created_at)
  on members to authenticated;
grant update (full_name, email, birthday, marketing_consent, is_active) on members to authenticated;

create or replace view public.members_public as
  select id, phone, full_name, email, birthday, points, lifetime_spend, tier,
         marketing_consent, is_active, created_at
  from public.members
  where public.is_staff();
revoke all on public.members_public from anon;
grant select on public.members_public to authenticated;

-- ---------- Realtime + Storage ----------
alter publication supabase_realtime add table orders;

insert into storage.buckets (id, name, public) values ('product-images', 'product-images', true)
  on conflict (id) do nothing;
create policy "product images public read" on storage.objects for select
  using (bucket_id = 'product-images');
create policy "product images admin write" on storage.objects for insert
  with check (bucket_id = 'product-images' and public.is_admin());
create policy "product images admin update" on storage.objects for update
  using (bucket_id = 'product-images' and public.is_admin());
create policy "product images admin delete" on storage.objects for delete
  using (bucket_id = 'product-images' and public.is_admin());

-- ---------- ขั้นตอนสร้าง Admin คนแรก ----------
-- 1) สร้างผู้ใช้ใน Supabase Auth (Dashboard > Authentication > Add user)
-- 2) รัน (แก้ uuid/อีเมลให้ตรง):
-- insert into profiles (id, full_name, email, role)
--   values ('<auth-user-uuid>', 'Owner', 'owner@example.com', 'admin');
