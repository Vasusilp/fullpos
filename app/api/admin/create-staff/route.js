import { NextResponse } from 'next/server';
import { supabaseAdmin, getCaller } from '@/lib/supabase/server';

async function requireAdmin() {
  const c = await getCaller();
  return c && c.profile.role === 'admin' ? c : null;
}

export async function POST(request) {
  const caller = await requireAdmin();
  if (!caller) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const b = await request.json().catch(() => ({}));
  const email = String(b.email || '').trim();
  const password = String(b.password || '');
  const full_name = String(b.full_name || '').trim();
  const role = b.role === 'admin' ? 'admin' : 'staff';
  if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 8 || !full_name) {
    return NextResponse.json({ error: 'invalid_input' }, { status: 400 });
  }

  const sb = supabaseAdmin();
  const { data, error } = await sb.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const { error: pErr } = await sb.from('profiles').insert({ id: data.user.id, full_name, email, role });
  if (pErr) {
    await sb.auth.admin.deleteUser(data.user.id);
    return NextResponse.json({ error: 'profile_failed' }, { status: 500 });
  }
  await sb.from('audit_logs').insert({
    user_id: caller.profile.id, action: 'staff.create', detail: { email, role },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request) {
  const caller = await requireAdmin();
  if (!caller) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const { id } = await request.json().catch(() => ({}));
  if (!id || id === caller.profile.id) return NextResponse.json({ error: 'invalid_input' }, { status: 400 });

  const sb = supabaseAdmin();
  // ออเดอร์เก่าอ้างอิง profile อยู่ จึงใช้การระงับแทนถ้าลบไม่ได้
  const { error } = await sb.auth.admin.deleteUser(id);
  if (error) {
    await sb.from('profiles').update({ is_active: false }).eq('id', id);
    return NextResponse.json({ ok: true, suspended: true });
  }
  await sb.from('audit_logs').insert({ user_id: caller.profile.id, action: 'staff.delete', detail: { id } });
  return NextResponse.json({ ok: true });
}
