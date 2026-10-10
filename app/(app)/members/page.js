'use client';
import { useEffect, useState } from 'react';
import { Search, Download, Eye } from 'lucide-react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { useApp } from '@/store/appStore';
import { useT } from '@/lib/i18n';
import { money } from '@/lib/points';
import Modal from '@/components/Modal';

const TIER_STYLE = { member: 'bg-gray-100 text-ink-soft', silver: 'bg-slate-100 text-slate-600', gold: 'bg-gold-light text-gold-dark' };

export default function MembersPage() {
  const sb = supabaseBrowser();
  const t = useT(useApp((s) => s.language));
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(null);
  const [tx, setTx] = useState([]);
  const [delta, setDelta] = useState('');
  const [note, setNote] = useState('');
  const [edit, setEdit] = useState({ full_name: '', email: '' });
  const [msg, setMsg] = useState('');
  const [confirmAnon, setConfirmAnon] = useState(false);

  async function load() {
    const { data } = await sb.from('members_public').select('*').order('created_at', { ascending: false });
    setRows(data || []);
  }
  useEffect(() => { load(); }, []); // eslint-disable-line

  async function open(m) {
    setSel(m); setMsg(''); setDelta(''); setNote(''); setConfirmAnon(false);
    setEdit({ full_name: m.full_name, email: m.email || '' });
    const { data } = await sb.from('point_transactions').select('*').eq('member_id', m.id)
      .order('created_at', { ascending: false }).limit(50);
    setTx(data || []);
  }

  async function adjust() {
    const d = parseInt(delta, 10);
    if (!d) return;
    if (!note.trim()) { setMsg(t.reasonRequired); return; }
    const { error } = await sb.rpc('adjust_points', { p_member_id: sel.id, p_delta: d, p_note: note });
    if (error) { setMsg(error.message); return; }
    await load(); await open({ ...sel, points: sel.points + d });
    setMsg(t.saved);
  }

  async function saveEdit() {
    const { error } = await sb.from('members').update({ full_name: edit.full_name, email: edit.email || null }).eq('id', sel.id);
    setMsg(error ? error.message : t.saved);
    load();
  }

  async function toggleActive() {
    await sb.from('members').update({ is_active: !sel.is_active }).eq('id', sel.id);
    setSel({ ...sel, is_active: !sel.is_active }); load();
  }

  async function anonymize() {
    const { error } = await sb.rpc('anonymize_member', { p_member_id: sel.id });
    if (error) { setMsg(error.message); return; }
    setSel(null); load();
  }

  function exportCsv() {
    const head = ['name', 'phone', 'tier', 'points', 'lifetime_spend', 'created_at'];
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [head.join(','), ...rows.map((m) =>
      [m.full_name, m.phone, m.tier, m.points, m.lifetime_spend, m.created_at].map(esc).join(','))].join('\n');
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = `members-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  const shown = rows.filter((m) => !q || m.phone.includes(q) || m.full_name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="h-full flex flex-col p-6 gap-4">
      <div className="flex items-center gap-3">
        <h1 className="text-sm font-bold uppercase tracking-widest mr-auto">{t.members} ({rows.length})</h1>
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-soft" />
          <input className="input pl-10 rounded-full !w-64" placeholder={`${t.search} ${t.phone}/${t.name}`} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <button className="btn-ghost flex items-center gap-2" onClick={exportCsv}><Download size={16} />{t.exportCsv}</button>
      </div>

      <div className="card flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-white text-left text-[11px] uppercase tracking-widest text-ink-soft">
            <tr>{[t.name, t.phone, t.tier, t.points, t.lifetimeSpend, t.joined, ''].map((h, i) => <th key={i} className="px-5 py-3">{h}</th>)}</tr>
          </thead>
          <tbody>
            {shown.map((m) => (
              <tr key={m.id} className={`border-t border-gray-50 hover:bg-pearl ${m.is_active ? '' : 'opacity-50'}`}>
                <td className="px-5 py-3 font-semibold">{m.full_name}</td>
                <td className="px-5 py-3 text-ink-soft">{m.phone}</td>
                <td className="px-5 py-3"><span className={`badge ${TIER_STYLE[m.tier]}`}>{m.tier}</span></td>
                <td className="px-5 py-3 font-bold">{m.points}</td>
                <td className="px-5 py-3">฿{money(m.lifetime_spend)}</td>
                <td className="px-5 py-3 text-ink-soft">{new Date(m.created_at).toLocaleDateString('th-TH')}</td>
                <td className="px-5 py-3 text-right"><button className="p-2 rounded-full hover:bg-gray-100" onClick={() => open(m)}><Eye size={16} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={!!sel} onClose={() => setSel(null)} title={sel?.full_name || ''} wide>
        {sel && (
          <div className="space-y-5 text-sm">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-2xl bg-pearl p-3"><div className="text-[11px] uppercase tracking-widest text-ink-soft">{t.points}</div><div className="text-2xl font-extrabold">{sel.points}</div></div>
              <div className="rounded-2xl bg-pearl p-3"><div className="text-[11px] uppercase tracking-widest text-ink-soft">{t.tier}</div><div className="text-2xl font-extrabold capitalize">{sel.tier}</div></div>
              <div className="rounded-2xl bg-pearl p-3"><div className="text-[11px] uppercase tracking-widest text-ink-soft">{t.lifetimeSpend}</div><div className="text-2xl font-extrabold">฿{money(sel.lifetime_spend)}</div></div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">{t.name}</label><input className="input" value={edit.full_name} onChange={(e) => setEdit({ ...edit, full_name: e.target.value })} /></div>
              <div><label className="label">{t.email}</label><input className="input" value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} /></div>
            </div>
            <button className="btn-ghost" onClick={saveEdit}>{t.save}</button>

            <div className="rounded-2xl border border-gray-100 p-4 space-y-2">
              <div className="label">{t.adjustPoints}</div>
              <div className="flex gap-2">
                <input className="input !w-32" type="number" placeholder={t.delta} value={delta} onChange={(e) => setDelta(e.target.value)} />
                <input className="input" placeholder={t.reason} value={note} onChange={(e) => setNote(e.target.value)} />
                <button className="btn-gold" onClick={adjust}>{t.save}</button>
              </div>
            </div>

            <div>
              <div className="label">{t.pointHistory}</div>
              <ul className="max-h-48 overflow-y-auto divide-y divide-gray-50">
                {tx.map((r) => (
                  <li key={r.id} className="py-2 flex justify-between">
                    <span className="text-ink-soft">{r.type}{r.note ? ` · ${r.note}` : ''} · {new Date(r.created_at).toLocaleString('th-TH')}</span>
                    <b className={r.points >= 0 ? 'text-ok' : 'text-bad'}>{r.points > 0 ? '+' : ''}{r.points}</b>
                  </li>
                ))}
              </ul>
            </div>

            {msg && <p className="text-ink-soft">{msg}</p>}
            <div className="flex gap-2 pt-2 border-t border-gray-100">
              <button className="btn-ghost" onClick={toggleActive}>{sel.is_active ? t.suspend : t.activate}</button>
              {!confirmAnon
                ? <button className="btn-ghost text-bad ml-auto" onClick={() => setConfirmAnon(true)}>{t.anonymize}</button>
                : <button className="btn-danger ml-auto" onClick={anonymize}>{t.confirm}: {t.anonymize}</button>}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
