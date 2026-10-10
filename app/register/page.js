'use client';
import { useState } from 'react';
import { useApp } from '@/store/appStore';
import { useT } from '@/lib/i18n';

export default function RegisterPage() {
  const lang = useApp((s) => s.language);
  const setLanguage = useApp((s) => s.setLanguage);
  const t = useT(lang);
  const [f, setF] = useState({ full_name: '', phone: '', pin: '', email: '', birthday: '', pdpa: false, marketing: false });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(null);

  async function submit(e) {
    e.preventDefault(); setBusy(true); setErr('');
    const res = await fetch('/api/members/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f),
    });
    const j = await res.json();
    setBusy(false);
    if (!res.ok) { setErr(j.error === 'phone_exists' ? 'เบอร์นี้เป็นสมาชิกแล้ว / Phone already registered' : (j.error || t.error)); return; }
    setOk(j.member);
  }

  return (
    <main className="min-h-screen bg-pearl p-4 flex items-start justify-center">
      <div className="w-full max-w-md mt-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="font-extrabold uppercase tracking-widest">{t.appName}</h1>
          <button className="text-xs font-semibold text-ink-soft" onClick={() => setLanguage(lang === 'TH' ? 'EN' : 'TH')}>{lang === 'TH' ? 'EN' : 'TH'}</button>
        </div>
        {ok ? (
          <div className="card p-8 text-center space-y-3 rounded-[32px]">
            <div className="text-5xl">✓</div>
            <div className="text-xl font-extrabold">{ok.full_name}</div>
            <p className="text-sm text-ink-soft">{t.register} · {ok.phone}</p>
            <a href="/member" className="btn-gold inline-block">{t.myPoints}</a>
          </div>
        ) : (
          <form onSubmit={submit} className="card p-6 rounded-[32px] space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-widest">{t.register}</h2>
            <div><label className="label">{t.name}</label><input className="input" required value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></div>
            <div><label className="label">{t.phone}</label><input className="input" required inputMode="numeric" maxLength={10} pattern="0[0-9]{9}" placeholder="0xxxxxxxxx" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value.replace(/\D/g, '') })} /></div>
            <div><label className="label">{t.pin} (4–6)</label><input className="input" required type="password" inputMode="numeric" maxLength={6} pattern="[0-9]{4,6}" value={f.pin} onChange={(e) => setF({ ...f, pin: e.target.value.replace(/\D/g, '') })} /></div>
            <div><label className="label">{t.email} ({t.optional})</label><input className="input" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
            <div><label className="label">{t.birthday} ({t.optional})</label><input className="input" type="date" value={f.birthday} onChange={(e) => setF({ ...f, birthday: e.target.value })} /></div>
            <label className="flex gap-2 text-sm"><input type="checkbox" checked={f.pdpa} onChange={(e) => setF({ ...f, pdpa: e.target.checked })} />{t.pdpa}</label>
            <label className="flex gap-2 text-sm text-ink-soft"><input type="checkbox" checked={f.marketing} onChange={(e) => setF({ ...f, marketing: e.target.checked })} />{t.marketing}</label>
            {err && <p className="text-sm text-bad">{err}</p>}
            <button className="btn-gold w-full !py-3" disabled={busy || !f.pdpa}>{t.register}</button>
          </form>
        )}
      </div>
    </main>
  );
}
