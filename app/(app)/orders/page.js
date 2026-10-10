'use client';
import { useEffect, useState } from 'react';
import { Eye, Search } from 'lucide-react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { useSession } from '@/store/sessionStore';
import { useApp } from '@/store/appStore';
import { useT } from '@/lib/i18n';
import { money, queueLabel } from '@/lib/points';
import StatusBadge from '@/components/StatusBadge';
import Modal from '@/components/Modal';

export default function OrdersPage() {
  const sb = supabaseBrowser();
  const t = useT(useApp((s) => s.language));
  const isAdmin = useSession((s) => s.role) === 'admin';
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sel, setSel] = useState(null);
  const [reason, setReason] = useState('');
  const [err, setErr] = useState('');

  async function load() {
    // RLS: staff เห็นเฉพาะวันนี้, admin เห็นทั้งหมด
    const { data } = await sb.from('orders')
      .select('*, order_items(name, quantity, price), members(full_name, phone)')
      .order('created_at', { ascending: false }).limit(500);
    setRows(data || []);
  }
  useEffect(() => { load(); }, []); // eslint-disable-line

  const shown = rows.filter((o) =>
    (statusFilter === 'all' || o.status === statusFilter) &&
    (!q || o.id.toLowerCase().includes(q.toLowerCase()) || queueLabel(o.queue_no).toLowerCase().includes(q.toLowerCase())));

  async function voidOrder() {
    if (!reason.trim()) { setErr(t.reasonRequired); return; }
    const { error } = await sb.rpc('cancel_order', { p_order_id: sel.id, p_reason: reason });
    if (error) { setErr(error.message); return; }
    setSel(null); setReason(''); setErr(''); load();
  }

  return (
    <div className="h-full flex flex-col p-6 gap-4">
      <div className="flex items-center gap-3">
        <h1 className="text-sm font-bold uppercase tracking-widest mr-auto">
          {t.orders} {!isAdmin && <span className="text-ink-soft normal-case tracking-normal">({t.today})</span>}
        </h1>
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-soft" />
          <input className="input pl-10 rounded-full !w-64" placeholder={`${t.search} Q001 / ID`} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="input !w-44 rounded-full" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">{t.all}</option>
          {['awaiting_payment', 'pending', 'preparing', 'ready', 'done', 'cancelled'].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <div className="card flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-white text-left text-[11px] uppercase tracking-widest text-ink-soft">
            <tr>
              {[t.queueNo, t.date, t.member, t.items, t.total, t.status, ''].map((h, i) => <th key={i} className="px-5 py-3">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {shown.map((o) => (
              <tr key={o.id} className="border-t border-gray-50 hover:bg-pearl">
                <td className="px-5 py-3 font-bold">{queueLabel(o.queue_no)}</td>
                <td className="px-5 py-3 text-ink-soft">{new Date(o.created_at).toLocaleString('th-TH')}</td>
                <td className="px-5 py-3">{o.members?.full_name || '—'}</td>
                <td className="px-5 py-3">{o.order_items.reduce((a, i) => a + i.quantity, 0)}</td>
                <td className="px-5 py-3 font-semibold">฿{money(o.total)}</td>
                <td className="px-5 py-3"><StatusBadge status={o.status} /></td>
                <td className="px-5 py-3 text-right">
                  <button className="p-2 rounded-full hover:bg-gray-100" onClick={() => { setSel(o); setErr(''); setReason(''); }}><Eye size={16} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={!!sel} onClose={() => setSel(null)} title={sel ? `${t.orderId} ${queueLabel(sel.queue_no)}` : ''}>
        {sel && (
          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-ink-soft">{t.status}</span><StatusBadge status={sel.status} /></div>
            <ul className="divide-y divide-gray-50">
              {sel.order_items.map((i, idx) => (
                <li key={idx} className="py-2 flex justify-between"><span>{i.quantity}× {i.name}</span><span>฿{money(i.price * i.quantity)}</span></li>
              ))}
            </ul>
            <div className="space-y-1 text-ink-soft">
              <div className="flex justify-between"><span>{t.subtotal}</span><span>฿{money(sel.subtotal)}</span></div>
              {sel.discount > 0 && <div className="flex justify-between"><span>{t.discount} {(sel.discount / sel.subtotal * 100).toFixed(1).replace(/\.0$/, '')}% ({sel.points_used} {t.points})</span><span>-฿{money(sel.discount)}</span></div>}
              <div className="flex justify-between"><span>{t.tax}</span><span>฿{money(sel.tax)}</span></div>
              <div className="flex justify-between font-bold text-ink text-base"><span>{t.total}</span><span>฿{money(sel.total)}</span></div>
            </div>
            {sel.cancel_reason && <p className="text-bad">{t.reason}: {sel.cancel_reason}</p>}
            {isAdmin && sel.status !== 'cancelled' && (
              <div className="pt-3 border-t border-gray-100 space-y-2">
                <input className="input" placeholder={t.reason} value={reason} onChange={(e) => setReason(e.target.value)} />
                {err && <p className="text-bad">{err}</p>}
                <button className="btn-danger w-full" onClick={voidOrder}>{t.voidOrder}</button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
