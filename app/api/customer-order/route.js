import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { verifyMember } from '@/lib/members';
import { rateLimit, clientIp } from '@/lib/rateLimit';

// ลูกค้าสั่งผ่าน QR: ราคา/ส่วนลด/แต้ม คำนวณใหม่ใน DB (RPC create_qr_order) ไม่เชื่อค่าจาก client
export async function POST(request) {
  if (!rateLimit('corder:' + clientIp(request), 10, 10 * 60_000)) {
    return NextResponse.json({ error: 'too_many_requests' }, { status: 429 });
  }
  const b = await request.json().catch(() => ({}));
  const items = Array.isArray(b.items)
    ? b.items.map((i) => ({ product_id: i.product_id, quantity: Number(i.quantity) }))
    : [];
  if (items.length === 0 || items.length > 50) return NextResponse.json({ error: 'empty_cart' }, { status: 400 });

  const sb = supabaseAdmin();
  let memberId = null;
  let pointsToUse = 0;

  if (b.phone) {
    const phone = String(b.phone);
    if (!/^0[0-9]{9}$/.test(phone)) return NextResponse.json({ error: 'invalid_phone' }, { status: 400 });
    if (b.pin) {
      // ใส่ PIN ถูกต้อง = ยืนยันตัวตน จึงใช้แต้มได้
      const r = await verifyMember(sb, phone, b.pin);
      if (r.error) return NextResponse.json({ error: r.error }, { status: r.status });
      memberId = r.member.id;
      pointsToUse = Math.max(0, Math.floor(Number(b.points_to_use) || 0));
    } else {
      // เบอร์อย่างเดียว = สะสมแต้มได้ แต่ใช้แต้มไม่ได้
      const { data: m } = await sb.from('members').select('id, is_active').eq('phone', phone).maybeSingle();
      if (m?.is_active) memberId = m.id;
    }
  }

  const { data, error } = await sb.rpc('create_qr_order', {
    p_items: items, p_member_id: memberId, p_points_to_use: pointsToUse,
  });
  if (error) return NextResponse.json({ error: 'order_failed', message: error.message }, { status: 400 });

  const { data: ps } = await sb.from('settings').select('value').eq('key', 'promptpay_id').maybeSingle();
  return NextResponse.json({
    order: {
      token: data.public_token, queue_no: data.queue_no, total: data.total,
      subtotal: data.subtotal, discount: data.discount, tax: data.tax,
      points_earned: data.points_earned, points_used: data.points_used, status: data.status,
    },
    promptpay_id: ps?.value ?? '',
  });
}
