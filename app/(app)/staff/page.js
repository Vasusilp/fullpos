'use client';
import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { useSession } from '@/store/sessionStore';
import { useApp } from '@/store/appStore';
import { useT } from '@/lib/i18n';
import Modal from '@/components/Modal';

export default function StaffPage() {
  const sb = supabaseBrowser();
  const t = useT(useApp((s) => s.language));
  const me = useSession((s) => s.user?.id);
  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(false);
  const [del, setDel] = useState(null);
  const [form, setForm] = useState({ full_name: '', email: '', password: '', role: 'staff' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    const { data } = await sb.from('profiles').select('*').order('created_at');
    setRows(data || []);
  }
  useEffect(() => { load(); }, []); // eslint-disable-line

  async function create(e) {
    e.preventDefault(); setBusy(true); setErr('');
    const res = await fetch('/api/admin/create-staff', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    });
    const j = await res.json();
    setBusy(false);
    if (!res.ok) { setErr(j.error || t.error); return; }
    setOpen(false); setForm({ full_name: '', email: '', password: '', role: 'staff' }); load();
  }

  async function setRole(p, role) {
    await sb.from('profiles').update({ role }).eq('id', p.id); load();
  }
  async function toggle(p) {
    await sb.from('profiles').update({ is_active: !p.is_active }).eq('id', p.id); load();
  }
  async function remove() {
    await fetch('/api/admin/create-staff', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: del.id }),
    });
    setDel(null); load();
  }

  return (
    <div className="h-full flex flex-col p-6 gap-4">
      <div className="flex items-center">
        <h1 className="text-sm font-bold uppercase tracking-widest mr-auto">{t.staff}</h1>
        <button className="btn-gold flex items-center gap-2" onClick={() => { setOpen(true); setErr(''); }}><Plus size={16} />{t.addStaff}</button>
      </div>
      <div className="card flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-white text-left text-[11px] uppercase tracking-widest text-ink-soft">
            <tr>{[t.name, t.email, t.role, t.status, ''].map((h, i) => <th key={i} className="px-5 py-3">{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className="border-t border-gray-50 hover:bg-pearl">
                <td className="px-5 py-3 font-semibold">{p.full_name}</td>
                <td className="px-5 py-3 text-ink-soft">{p.email}</td>
                <td className="px-5 py-3">
                  <select className="input !w-40 !py-1.5 rounded-full" value={p.role} disabled={p.id === me} onChange={(e) => setRole(p, e.target.value)}>
                    <option value="staff">{t.roleStaff}</option><option value="admin">{t.roleAdmin}</option>
                  </select>
                </td>
                <td className="px-5 py-3">
                  <span className={`badge ${p.is_active ? 'bg-green-50 text-ok' : 'bg-red-50 text-bad'}`}>{p.is_active ? t.active : t.suspended}</span>
                </td>
                <td className="px-5 py-3 text-right whitespace-nowrap">
                  {p.id !== me && (<>
                    <button className="btn-ghost !py-1.5 !px-4 text-xs mr-1" onClick={() => toggle(p)}>{p.is_active ? t.suspend : t.activate}</button>
                    <button className="p-2 rounded-full hover:bg-red-50 text-bad" onClick={() => setDel(p)}><Trash2 size={16} /></button>
                  </>)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={t.addStaff}>
        <form onSubmit={create} className="space-y-3">
          <div><label className="label">{t.fullName}</label><input className="input" required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
          <div><label className="label">{t.email}</label><input className="input" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div><label className="label">{t.password} (8+)</label><input className="input" type="password" minLength={8} required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
          <div><label className="label">{t.role}</label>
            <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="staff">{t.roleStaff}</option><option value="admin">{t.roleAdmin}</option>
            </select></div>
          {err && <p className="text-sm text-bad">{err}</p>}
          <button className="btn-gold w-full" disabled={busy}>{t.save}</button>
        </form>
      </Modal>

      <Modal open={!!del} onClose={() => setDel(null)} title={t.delete}>
        {del && (
          <div className="space-y-4">
            <p className="text-sm"><b>{del.full_name}</b><br />{t.deleteConfirm}</p>
            <div className="flex gap-2">
              <button className="btn-ghost flex-1" onClick={() => setDel(null)}>{t.cancel}</button>
              <button className="btn-danger flex-1" onClick={remove}>{t.delete}</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
