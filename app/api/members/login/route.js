import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { rateLimit, clientIp } from '@/lib/rateLimit';
import { verifyMember } from '@/lib/members';

export async function POST(request) {
  if (!rateLimit('mlogin:' + clientIp(request), 20, 10 * 60_000)) {
    return NextResponse.json({ error: 'too_many_requests' }, { status: 429 });
  }
  const { phone, pin } = await request.json().catch(() => ({}));
  if (!/^0[0-9]{9}$/.test(String(phone || '')) || !/^[0-9]{4,6}$/.test(String(pin || ''))) {
    return NextResponse.json({ error: 'invalid_credentials' }, { status: 400 });
  }
  const sb = supabaseAdmin();
  const r = await verifyMember(sb, phone, pin);
  if (r.error) return NextResponse.json({ error: r.error }, { status: r.status });
  const m = r.member;

  const [{ data: tx }, { data: orders }] = await Promise.all([
    sb.from('point_transactions').select('type, points, note, created_at')
      .eq('member_id', m.id).order('created_at', { ascending: false }).limit(30),
    sb.from('orders').select('queue_no, queue_date, total, status, created_at')
      .eq('member_id', m.id).order('created_at', { ascending: false }).limit(10),
  ]);

  return NextResponse.json({
    member: { full_name: m.full_name, phone: m.phone, points: m.points, tier: m.tier, lifetime_spend: m.lifetime_spend },
    transactions: tx || [],
    orders: orders || [],
  });
}
