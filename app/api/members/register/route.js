import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { supabaseAdmin, getCaller } from '@/lib/supabase/server';
import { rateLimit, clientIp } from '@/lib/rateLimit';

export async function POST(request) {
  if (!rateLimit('register:' + clientIp(request), 8, 10 * 60_000)) {
    return NextResponse.json({ error: 'too_many_requests' }, { status: 429 });
  }
  const b = await request.json().catch(() => ({}));
  const full_name = String(b.full_name || '').trim();
  const phone = String(b.phone || '').trim();
  const pin = String(b.pin || '');
  const email = b.email ? String(b.email).trim() : null;
  const birthday = b.birthday || null;

  if (!full_name || full_name.length > 80) return NextResponse.json({ error: 'invalid_name' }, { status: 400 });
  if (!/^0[0-9]{9}$/.test(phone)) return NextResponse.json({ error: 'invalid_phone' }, { status: 400 });
  if (!/^[0-9]{4,6}$/.test(pin)) return NextResponse.json({ error: 'invalid_pin' }, { status: 400 });
  if (b.pdpa !== true) return NextResponse.json({ error: 'pdpa_required' }, { status: 400 });
  if (email && !/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: 'invalid_email' }, { status: 400 });

  const caller = await getCaller();   // null = ลูกค้าสมัครเอง
  const pin_hash = await bcrypt.hash(pin, 10);
  const sb = supabaseAdmin();

  const { data, error } = await sb.from('members').insert({
    full_name, phone, email, birthday, pin_hash,
    pdpa_consent_at: new Date().toISOString(),
    marketing_consent: b.marketing === true,
    registered_by: caller?.profile.id || null,
  }).select('id, full_name, phone, points, tier, lifetime_spend').single();

  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'phone_exists' }, { status: 409 });
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
  await sb.from('audit_logs').insert({
    user_id: caller?.profile.id || null, action: 'member.register', detail: { member_id: data.id },
  });
  return NextResponse.json({ member: data });
}
