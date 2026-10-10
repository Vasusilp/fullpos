'use client';
import { useState } from 'react';
import Modal from './Modal';
import { supabaseBrowser } from '@/lib/supabase/client';
import { useApp } from '@/store/appStore';
import { useT } from '@/lib/i18n';
import { useCart } from '@/store/cartStore';

const TIER_STYLE = { member: 'bg-gray-100 text-ink-soft', silver: 'bg-slate-100 text-slate-600', gold: 'bg-gold-light text-gold-dark' };

export default function MemberModal({ open, onClose }) {
  const t = useT(useApp((s) => s.language));
  const setMember = useCart((s) => s.setMember);
  const [phone, setPhone] = useState('');
  const [found, setFound] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [mode, setMode] = useState('search'); // search | register
  const [form, setForm] = useState({ full_name: '', pin: '', email: '', birthday: '', pdpa: false, marketing: false });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  function reset() {
    setPhone(''); setFound(null); setNotFound(false); setMode('search'); setErr('');
    setForm({ full_name: '', pin: '', email: '', birthday: '', pdpa: false, marketing: false });
  }
  function close() { reset(); onClose(); }

  async function search(e) {
    e?.preventDefault();
    setErr(''); setFound(null); setNotFound(false);
    if (!/^0[0-9]{9}$/.test(phone)) { setErr('0xxxxxxxxx'); return; }
    const { data } = await supabaseBrowser().from('members_public')
      .select('id, full_name, phone, points, tier, lifetime_spend, is_active').eq('phone', phone).maybeSingle();
    if (data && data.is_active) setFound(data); else setNotFound(true);
  }

  async function register(e) {
    e.preventDefault();
    setBusy(true); setErr('');
    const res = await fetch('/api/members/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, phone }),
    });
    const j = await res.json();
    setBusy(false);
    if (!res.ok) { setErr(j.error || t.error); return; }
    setMember(j.member);
    close();
  }

  function attach() { setMember(found); close(); }

  return (
    <Modal open={open} onClose={close} title={mode === 'register' ? t.newMember : t.member}>
      {mode === 'search' && (
        <div className="space-y-4">
          <form onSubmit={search} className="flex gap-2">
            <input className="input" inputMode="numeric" maxLength={10} placeholder="0xxxxxxxxx" value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))} autoFocus />
            <button className="btn-gold">{t.search}</button>
          </form>
          {err && <p className="text-sm text-bad">{err}</p>}
          {found && (
            <div className="rounded-2xl border border-gray-100 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="font-bold">{found.full_name}</div>
                <span className={`badge ${TIER_STYLE[found.tier]}`}>{found.tier}</span>
              </div>
              <div className="text-sm text-ink-soft">{found.phone} · {t.points}: <b className="text-ink">{found.points}</b></div>
              <button className="btn-gold w-full" onClick={attach}>{t.attach}</button>
            </div>
          )}
          {notFound && (
            <div className="rounded-2xl bg-pearl p-4 space-y-3 text-center">
              <p className="text-sm text-ink-soft">{t.notFound}</p>
              <button className="btn-ghost" onClick={() => setMode('register')}>{t.newMember}</button>
            </div>
          )}
        </div>
      )}

      {mode === 'register' && (
        <form onSubmit={register} className="space-y-3">
          <div><label className="label">{t.phone}</label>
            <input className="input" value={phone} readOnly /></div>
          <div><label className="label">{t.name}</label>
            <input className="input" required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
          <div><label className="label">{t.pin} (4–6)</label>
            <input className="input" required inputMode="numeric" maxLength={6} pattern="[0-9]{4,6}" value={form.pin}
              onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, '') })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">{t.email} ({t.optional})</label>
              <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><label className="label">{t.birthday} ({t.optional})</label>
              <input className="input" type="date" value={form.birthday} onChange={(e) => setForm({ ...form, birthday: e.target.value })} /></div>
          </div>
          <label className="flex gap-2 text-sm"><input type="checkbox" checked={form.pdpa} onChange={(e) => setForm({ ...form, pdpa: e.target.checked })} />{t.pdpa}</label>
          <label className="flex gap-2 text-sm text-ink-soft"><input type="checkbox" checked={form.marketing} onChange={(e) => setForm({ ...form, marketing: e.target.checked })} />{t.marketing}</label>
          {err && <p className="text-sm text-bad">{err}</p>}
          <div className="flex gap-2 pt-2">
            <button type="button" className="btn-ghost flex-1" onClick={() => setMode('search')}>{t.cancel}</button>
            <button className="btn-gold flex-1" disabled={busy || !form.pdpa}>{t.save}</button>
          </div>
        </form>
      )}
    </Modal>
  );
}
