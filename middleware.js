import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const ADMIN_ONLY = ['/members', '/reports', '/staff', '/admin'];
const STAFF_ROUTES = ['/pos', '/checker', '/orders', '/products', '/settings', ...ADMIN_ONLY];

export async function middleware(request) {
  const path = request.nextUrl.pathname;
  const needsAuth = STAFF_ROUTES.some((p) => path === p || path.startsWith(p + '/'));
  if (!needsAuth) return NextResponse.next();

  // ถ้า env ไม่ครบหรือ Supabase เรียกไม่สำเร็จ: เขียนสาเหตุลง Runtime Logs แล้วส่งไป /login
  // (แทนที่จะปล่อยให้ขึ้น 500 MIDDLEWARE_INVOCATION_FAILED ทั้งเว็บ). /login ไม่ผ่าน middleware จึงไม่วนลูป
  try {
    return await guard(request, path);
  } catch (err) {
    console.error('[middleware] failed:', err?.name, err?.message);
    return NextResponse.redirect(new URL('/login?error=server', request.url));
  }
}

async function guard(request, path) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.error('[middleware] missing env:', !url ? 'NEXT_PUBLIC_SUPABASE_URL' : '', !key ? 'NEXT_PUBLIC_SUPABASE_ANON_KEY' : '');
    return NextResponse.redirect(new URL('/login?error=config', request.url));
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    url,
    key,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL('/login', request.url));

  const { data: profile } = await supabase
    .from('profiles').select('role,is_active').eq('id', user.id).single();

  if (!profile || !profile.is_active) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL('/login?error=inactive', request.url));
  }

  const adminOnly = ADMIN_ONLY.some((p) => path === p || path.startsWith(p + '/'));
  if (adminOnly && profile.role !== 'admin') {
    return NextResponse.redirect(new URL('/pos?denied=1', request.url));
  }
  return response;
}

export const config = {
  matcher: ['/pos/:path*', '/checker/:path*', '/orders/:path*', '/products/:path*', '/settings/:path*',
    '/members/:path*', '/reports/:path*', '/staff/:path*', '/admin/:path*'],
};
