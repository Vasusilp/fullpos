'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import { useApp } from '@/store/appStore';
import { useT } from '@/lib/i18n';

export default function LoginPage() {
  const router = useRouter();
  const t = useT(useApp((s) => s.language));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setErr('');
    const sb = supabaseBrowser();
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) { setErr(error.message); setBusy(false); return; }
    router.replace('/pos');
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-pearl flex items-center justify-center p-4">
      <form onSubmit={submit} className="card w-full max-w-sm p-8 rounded-[32px] space-y-4">
        <div className="text-center mb-2">
          <div className="mx-auto w-14 h-14 rounded-full bg-gold-light flex items-center justify-center text-gold font-extrabold text-xl">P</div>
          <h1 className="mt-3 text-lg font-extrabold uppercase tracking-widest">{t.appName}</h1>
        </div>
        <div><label className="label">{t.email}</label>
          <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div><label className="label">{t.password}</label>
          <input className="input" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} /></div>
        {err && <p className="text-sm text-bad">{err}</p>}
        <button className="btn-gold w-full" disabled={busy}>{t.login}</button>
      </form>
    </main>
  );
}
