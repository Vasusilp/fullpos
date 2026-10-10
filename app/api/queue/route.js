import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

// จอแสดงคิว: เปิดด้วย display token (QUEUE_DISPLAY_TOKEN) โดยไม่ต้องล็อกอิน คืนเฉพาะเลขคิว ไม่มีข้อมูลลูกค้า
export async function GET(request) {
  const token = new URL(request.url).searchParams.get('token');
  if (!process.env.QUEUE_DISPLAY_TOKEN || token !== process.env.QUEUE_DISPLAY_TOKEN) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const sb = supabaseAdmin();
  const { data: today } = await sb.rpc('today_th');
  const { data } = await sb.from('orders').select('queue_no, status')
    .eq('queue_date', today).in('status', ['pending', 'preparing', 'ready'])
    .order('queue_no', { ascending: true });
  const rows = data || [];
  return NextResponse.json({
    preparing: rows.filter((o) => o.status === 'pending' || o.status === 'preparing').map((o) => o.queue_no),
    ready: rows.filter((o) => o.status === 'ready').map((o) => o.queue_no),
  });
}

