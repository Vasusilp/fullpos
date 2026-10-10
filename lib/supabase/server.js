import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Service Role — ใช้เฉพาะใน API Route ฝั่งเซิร์ฟเวอร์ ห้าม import ในไฟล์ client
export function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      // Next.js 14 แคชผลของ fetch ไว้ใช้ซ้ำ (Data Cache) ทำให้สถานะออเดอร์/แต้ม/เมนูค้างเป็นค่าเก่า
      // บังคับไม่ใช้แคชกับทุกคำขอที่ไปหา Supabase
      global: { fetch: (url, options = {}) => fetch(url, { ...options, cache: 'no-store' }) },
    }
  );
}

// client ที่อ่าน session ของผู้ใช้จาก cookie (ใช้ตรวจว่าเป็น staff/admin)
export function supabaseFromCookies() {
  const store = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll: () => store.getAll(), setAll: () => {} } }
  );
}

// คืน { user, profile } ของผู้เรียก หรือ null ถ้าไม่ได้ล็อกอิน/ถูกระงับ
export async function getCaller() {
  const sb = supabaseFromCookies();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data: profile } = await sb.from('profiles').select('*').eq('id', user.id).single();
  if (!profile || !profile.is_active) return null;
  return { user, profile };
}
