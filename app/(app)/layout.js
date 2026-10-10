'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  ShoppingBag, ChefHat, Receipt, Package, Users, BarChart3, UserCog, ScrollText,
  Settings as Cog, Tv, LogOut,
} from 'lucide-react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { useSession } from '@/store/sessionStore';
import { useApp } from '@/store/appStore';
import { useT } from '@/lib/i18n';

const MENU = [
  { href: '/pos', key: 'pos', icon: ShoppingBag },
  { href: '/checker', key: 'checker', icon: ChefHat },
  { href: '/orders', key: 'orders', icon: Receipt },
  { href: '/products', key: 'products', icon: Package },
  { href: '/members', key: 'members', icon: Users, admin: true },
  { href: '/reports', key: 'reports', icon: BarChart3, admin: true },
  { href: '/staff', key: 'staff', icon: UserCog, admin: true },
  { href: '/admin/audit', key: 'audit', icon: ScrollText, admin: true },
  { href: '/settings', key: 'settings', icon: Cog },
];

export default function AppLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, role, loaded, setSession, clear } = useSession();
  const t = useT(useApp((s) => s.language));
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    const sb = supabaseBrowser();
    (async () => {
      const { data: { user } } = await sb.auth.getUser();
      if (!user) { clear(); router.replace('/login'); return; }
      const { data: p } = await sb.from('profiles').select('*').eq('id', user.id).single();
      if (!p || !p.is_active) { await sb.auth.signOut(); router.replace('/login'); return; }
      setSession(user, p);
    })();
    if (new URLSearchParams(window.location.search).get('denied')) {
      setDenied(true);
      setTimeout(() => setDenied(false), 4000);
    }
  }, []); // eslint-disable-line

  async function logout() {
    await supabaseBrowser().auth.signOut();
    clear();
    router.replace('/login');
  }

  const items = MENU.filter((m) => !m.admin || role === 'admin');

  return (
    <div className="h-screen overflow-hidden flex bg-pearl">
      <aside className="w-20 lg:w-60 shrink-0 h-full bg-white border-r border-gray-100 flex flex-col py-5">
        <div className="px-4 lg:px-6 mb-6 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gold-light text-gold font-extrabold flex items-center justify-center shrink-0">P</div>
          <span className="hidden lg:block font-extrabold uppercase tracking-widest text-sm">{t.appName}</span>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 space-y-1">
          {items.map(({ href, key, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/');
            return (
              <Link key={href} href={href}
                className={`flex items-center gap-3 rounded-full px-4 py-3 text-sm font-semibold transition ${
                  active ? 'bg-gold-light text-gold-dark' : 'text-ink-soft hover:bg-gray-50'}`}>
                <Icon size={18} className="shrink-0" />
                <span className="hidden lg:block">{t[key]}</span>
              </Link>
            );
          })}
          <a href={`/queue?token=${encodeURIComponent('')}`} target="_blank" rel="noreferrer"
            onClick={(e) => {
              e.preventDefault();
              const tk = window.prompt('Queue display token');
              if (tk) window.open(`/queue?token=${encodeURIComponent(tk)}`, '_blank');
            }}
            className="flex items-center gap-3 rounded-full px-4 py-3 text-sm font-semibold text-ink-soft hover:bg-gray-50">
            <Tv size={18} className="shrink-0" /><span className="hidden lg:block">{t.queue}</span>
          </a>
        </nav>
        <div className="px-3 pt-3 border-t border-gray-100">
          <div className="hidden lg:block px-4 pb-2">
            <div className="text-sm font-semibold truncate">{profile?.full_name}</div>
            <span className="badge bg-gold-light text-gold-dark mt-1">{role === 'admin' ? t.roleAdmin : t.roleStaff}</span>
          </div>
          <button onClick={logout}
            className="w-full flex items-center gap-3 rounded-full px-4 py-3 text-sm font-semibold text-ink-soft hover:bg-gray-50">
            <LogOut size={18} className="shrink-0" /><span className="hidden lg:block">{t.logout}</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 h-full overflow-hidden relative">
        {denied && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 glass card px-5 py-2.5 text-sm font-semibold text-bad">
            {t.noPermission}
          </div>
        )}
        {loaded ? children : null}
      </main>
    </div>
  );
}
