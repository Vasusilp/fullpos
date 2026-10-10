import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
 
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;
 
// เมนูสาธารณะสำหรับหน้า /order (ลูกค้าไม่ได้ล็อกอิน จึงอ่านผ่าน Service Role เฉพาะฟิลด์ที่จำเป็น)
export async function GET() {
  const sb = supabaseAdmin();
  const [p, c, s] = await Promise.all([
    sb.from('products').select('id, name, price, category_id, image_url').eq('is_available', true).order('name'),
    sb.from('categories').select('*').order('id'),
    sb.from('settings').select('key, value').in('key', ['shop_name', 'tax_rate', 'earn_baht_per_point',
      'redeem_baht_per_10_points', 'max_redeem_percent']),
  ]);
  return NextResponse.json({ products: p.data || [], categories: c.data || [], settings: s.data || [] });
}
 
