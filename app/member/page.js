'use client';
import { useState } from 'react';
import { useApp } from '@/store/appStore';
import { useT } from '@/lib/i18n';
import { money, queueLabel } from '@/lib/points';

const TIER_STYLE = { member: 'bg-gray-100 text-ink-soft', silver: 'bg-slate-100 text-slate-600', gold: 'bg-gold-light text-gold-dark' };

export default function MemberPage() {
  const lang = useApp((s) => s.language);
  const setLanguage = useApp((s) => s.setLanguage);
  const t = useT(lang);
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault(); setBusy(true); setErr('');
    const res = await fetch('/api/members/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone, pin }),
    });
    const j = await res.json();
    setBusy(false);
    if (!res.ok) { setErr(j.error === 'locked' ? t.lockedTry : 'เบอร์หรือ PIN ไม่ถูกต้อง / Wrong phone or PIN'); return; }
    setData(j); setPin('');
  }

  return (
    <main className="min-h-screen bg-pearl p-4 flex items-start justify-center">
      <div className="w-full max-w-md mt-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="font-extrabold uppercase tracking-widest">{t.appName}</h1>
          <button className="text-xs font-semibold text-ink-soft" onClick={() => setLanguage(lang === 'TH' ? 'EN' : 'TH')}>{lang === 'TH' ? 'EN' : 'TH'}</button>
        </div>

        {!data ? (
          <form onSubmit={submit} className="card p-6 rounded-[32px] space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-widest">{t.myPoints}</h2>
            <div><label className="label">{t.phone}</label><input className="input" required inputMode="numeric" maxLength={10} value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))} /></div>
            <div><label className="label">{t.pin}</label><input className="input" required type="password" inputMode="numeric" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} /></div>
            {err && <p className="text-sm text-bad">{err}</p>}
            <button className="btn-gold w-full !py-3" disabled={busy}>{t.login}</button>
            <a href="/register" className="block text-center text-sm text-ink-soft underline">{t.register}</a>
          </form>
        ) : (
          <>
            <div className="card p-6 rounded-[32px] text-center space-y-2">
              <div className="flex items-center justify-center gap-2">
                <span className="font-bold">{data.member.full_name}</span>
                <span className={`badge ${TIER_STYLE[data.member.tier]}`}>{data.member.tier}</span>
              </div>
              <div className="text-xs uppercase tracking-widest text-ink-soft">{t.points}</div>
              <div className="text-6xl font-extrabold text-gold-dark">{data.member.points}</div>
              <div className="text-xs text-ink-soft">{t.lifetimeSpend}: ฿{money(data.member.lifetime_spend)}</div>
            </div>
            <div className="card p-5 rounded-[32px]">
              <div className="label">{t.pointHistory}</div>
              <ul className="divide-y divide-gray-50 text-sm max-h-64 overflow-y-auto">
                {data.transactions.map((r, i) => (
                  <li key={i} className="py-2 flex justify-between">
                    <span className="text-ink-soft">{new Date(r.created_at).toLocaleDateString('th-TH')} · {r.type}</span>
                    <b className={r.points >= 0 ? 'text-ok' : 'text-bad'}>{r.points > 0 ? '+' : ''}{r.points}</b>
                  </li>
                ))}
              </ul>
            </div>
            <div className="card p-5 rounded-[32px]">
              <div className="label">{t.recentOrders}</div>
              <ul className="divide-y divide-gray-50 text-sm">
                {data.orders.map((o, i) => (
                  <li key={i} className="py-2 flex justify-between">
                    <span>{queueLabel(o.queue_no)} · <span className="text-ink-soft">{new Date(o.created_at).toLocaleDateString('th-TH')}</span></span>
                    <b>฿{money(o.total)}</b>
                  </li>
                ))}
              </ul>
            </div>
            <button className="btn-ghost w-full" onClick={() => setData(null)}>{t.logout}</button>
          </>
        )}
      </div>
    </main>
  );
}
