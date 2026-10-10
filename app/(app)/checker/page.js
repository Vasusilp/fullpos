'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { useApp } from '@/store/appStore';
import { useT } from '@/lib/i18n';
import { queueLabel, money } from '@/lib/points';
import { playDing } from '@/lib/sound';

export default function CheckerPage() {
  const sb = supabaseBrowser();
  const t = useT(useApp((s) => s.language));
  const soundEnabled = useApp((s) => s.soundEnabled);
  const notificationsEnabled = useApp((s) => s.notificationsEnabled);
  const [orders, setOrders] = useState([]);
  const [err, setErr] = useState('');
  const known = useRef(null);
  const soundRef = useRef(soundEnabled);
  soundRef.current = soundEnabled && notificationsEnabled;

  const load = useCallback(async () => {
    const { data } = await sb.from('orders')
      .select('*, order_items(name, quantity)')
      .in('status', ['awaiting_payment', 'pending', 'preparing', 'ready'])
      .order('queue_no', { ascending: true });
    const list = data || [];
    // เล่นเสียงเมื่อมีออเดอร์ใหม่ (ไม่เล่นตอนโหลดครั้งแรก)
    if (known.current) {
      const fresh = list.some((o) => !known.current.has(o.id));
      if (fresh && soundRef.current) playDing();
    }
    known.current = new Set(list.map((o) => o.id));
    setOrders(list);
  }, []); // eslint-disable-line

  useEffect(() => {
    load();
    const ch = sb.channel('checker-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => load())
      .subscribe();
    const poll = setInterval(load, 15000); // เผื่อ realtime หลุด
    return () => { sb.removeChannel(ch); clearInterval(poll); };
  }, [load]); // eslint-disable-line

  async function act(fn, args) {
    setErr('');
    const { error } = await sb.rpc(fn, args);
    if (error) setErr(error.message);
    load();
  }

  const cols = [
    { key: 'awaiting_payment', title: t.awaitingPayment, tone: 'text-ink-soft',
      action: (o) => ({ label: t.confirmPayment, run: () => act('confirm_qr_payment', { p_order_id: o.id }) }) },
    { key: 'pending', title: t.pending, tone: 'text-gold-dark',
      action: (o) => ({ label: t.start, run: () => act('set_order_status', { p_order_id: o.id, p_status: 'preparing' }) }) },
    { key: 'preparing', title: t.preparing, tone: 'text-warn',
      action: (o) => ({ label: t.markReady, run: () => act('set_order_status', { p_order_id: o.id, p_status: 'ready' }) }) },
    { key: 'ready', title: t.ready, tone: 'text-ok',
      action: (o) => ({ label: t.handOver, run: () => act('set_order_status', { p_order_id: o.id, p_status: 'done' }) }) },
  ];

  return (
    <div className="h-full flex flex-col p-6 gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-sm font-bold uppercase tracking-widest">{t.checker}</h1>
        {err && <span className="text-sm text-bad">{err}</span>}
      </div>
      <div className="flex-1 grid grid-cols-4 gap-4 min-h-0">
        {cols.map((c) => {
          const list = orders.filter((o) => o.status === c.key);
          return (
            <div key={c.key} className="flex flex-col min-h-0 rounded-[32px] bg-white/60 border border-gray-100 p-3">
              <div className={`px-3 py-2 text-xs font-bold uppercase tracking-widest flex justify-between ${c.tone}`}>
                <span>{c.title}</span><span>{list.length}</span>
              </div>
              <div className="flex-1 overflow-y-auto space-y-3 p-1">
                {list.map((o) => {
                  const a = c.action(o);
                  return (
                    <div key={o.id} className="card p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-2xl font-extrabold">{queueLabel(o.queue_no)}</span>
                        <span className="badge bg-gray-100 text-ink-soft">{o.source === 'qr' ? 'QR' : 'Counter'}</span>
                      </div>
                      <ul className="text-sm text-ink-soft space-y-0.5">
                        {o.order_items.map((i, idx) => <li key={idx}>{i.quantity}× {i.name}</li>)}
                      </ul>
                      {c.key === 'awaiting_payment' && (
                        <div className="text-sm font-bold text-gold-dark">฿{money(o.total)}</div>
                      )}
                      <button className="btn-gold w-full !py-2 text-sm" onClick={a.run}>{a.label}</button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
