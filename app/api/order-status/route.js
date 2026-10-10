import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

// ลูกค้าติดตามสถานะออเดอร์ตัวเองด้วย public_token (uuid เดายาก)
export async function GET(request) {
  const token = new URL(request.url).searchParams.get('token') || '';
  if (!/^[0-9a-f-]{36}$/i.test(token)) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const { data } = await supabaseAdmin().from('orders')
    .select('queue_no, status, payment_status, total, queue_date')
    .eq('public_token', token).maybeSingle();
  if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json({ order: data });
}
