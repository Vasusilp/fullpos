'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Minus, ShoppingBag } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useApp } from '@/store/appStore';
import { useT } from '@/lib/i18n';
import { money, queueLabel, calcTotals, settingsFromRows } from '@/lib/points';
import { promptPayPayload } from '@/lib/promptpay';
import Modal from '@/components/Modal';

const TOKEN_KEY = 'pos-order-token';
const STEPS = ['awaiting_payment', 'pending', 'preparing', 'ready'];

export default function CustomerOrderPage() {
  const lang = useApp((s) => s.language);
  const setLanguage = useApp((s) => s.setLanguage);
  const t = useT(lang);

  const [products, setProducts] = useState([]);
  const [cats, setCats] = useState([]);
  const [cat, setCat] = useState('all');
  const [settings, setSettings] = useState(settingsFromRows([]));
  const [shop, setShop] = useState('POS Pearl');
  const [cart, setCart] = useState({}); // id -> qty
  const [cartOpen, setCartOpen] = useState(false);
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [pts, setPts] = useState(0);
  const [placed, setPlaced] = useState(null); // { token, queue_no, total, promptpay_id }
  const [status, setStatus] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const timer = useRef(null);

  useEffect(() => {
    (async () => {
      const j = await (await fetch('/api/menu', { cache: 'no-store' })).json();
      setProducts(j.products); setCats(j.categories);
      setSettings(settingsFromRows(j.settings));
      const n = j.settings.find((r) => r.key === 'shop_name')?.value;
      if (n) setShop(n);
    })();
    try {
      const saved = JSON.parse(localStorage.getItem(TOKEN_KEY) || 'null');
      if (saved?.token && saved.day === new Date().toDateString()) setPlaced(saved);
    } catch {}
  }, []);

  // ติดตามสถานะออเดอร์ (polling ผ่าน token ของออเดอร์ตัวเอง)
  useEffect(() => {
    if (!placed) return;
    let stop = false;
    async function tick() {
      try {
        const res = await fetch(`/api/order-status?token=${placed.token}`, { cache: 'no-store' });
        if (res.ok) { const j = await res.json(); if (!stop) setStatus(j.order); }
      } catch {}
      if (!stop) timer.current = setTimeout(tick, 3000);
    }
    tick();
    return () => { stop = true; clearTimeout(timer.current); };
  }, [placed]);

  const items = useMemo(
    () => Object.entries(cart).map(([id, quantity]) => {
      const p = products.find((x) => x.id === id);
      return p ? { product_id: id, name: p.name, price: Number(p.price), quantity } : null;
    }).filter(Boolean),
    [cart, products]
  );
  const count = items.reduce((a, i) => a + i.quantity, 0);
  // แสดงผลเท่านั้น: ถ้ากรอก PIN ให้คำนวณส่วนลดโดยประมาณ ราคาจริงคำนวณที่เซิร์ฟเวอร์
  const preview = calcTotals(items, pin ? { points: 1e9, tier: 'member' } : null, pts, settings);
  const set = (id, d) => setCart((c) => { const q = Math.max(0, Math.min(99, (c[id] || 0) + d)); const n = { ...c }; if (q) n[id] = q; else delete n[id]; return n; });

  async function submit() {
    setBusy(true); setErr('');
    const res = await fetch('/api/customer-order', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: items.map((i) => ({ product_id: i.product_id, quantity: i.quantity })),
        phone: phone || undefined, pin: pin || undefined, points_to_use: pin ? pts : 0,
      }),
    });
    const j = await res.json();
    setBusy(false);
    if (!res.ok) {
      setErr(j.error === 'locked' ? t.lockedTry : j.error === 'invalid_credentials' ? 'เบอร์หรือ PIN ไม่ถูกต้อง' : (j.message || j.error || t.error));
      return;
    }
    const data = { token: j.order.token, queue_no: j.order.queue_no, total: j.order.total, promptpay_id: j.promptpay_id, day: new Date().toDateString() };
    try { localStorage.setItem(TOKEN_KEY, JSON.stringify(data)); } catch {}
    setPlaced(data); setCart({}); setCartOpen(false);
  }

  function newOrder() {
    try { localStorage.removeItem(TOKEN_KEY); } catch {}
    setPlaced(null); setStatus(null);
  }

  // ---------- หน้าชำระเงิน / ติดตามสถานะ ----------
  if (placed) {
    const st = status?.status || 'awaiting_payment';
    const stepIdx = STEPS.indexOf(st);
    const label = { awaiting_payment: t.awaitingPayment, pending: t.pending, preparing: t.cooking, ready: t.pickup };
    return (
      <main className="min-h-screen bg-pearl p-4 flex justify-center">
        <div className="w-full max-w-md mt-6 space-y-4">
          {st === 'cancelled' ? (
            <div className="card p-8 text-center rounded-[32px] space-y-3">
              <div className="text-bad font-bold">{t.cancelled}</div>
              <button className="btn-gold" onClick={newOrder}>{t.orderOnline}</button>
            </div>
          ) : (
            <>
              <div className="card p-6 text-center rounded-[32px]">
                <div className="text-xs uppercase tracking-widest text-ink-soft">{t.yourQueue}</div>
                <div className="text-7xl font-extrabold text-gold-dark my-1">{queueLabel(placed.queue_no)}</div>
                <div className="text-sm text-ink-soft">{t.total}: ฿{money(placed.total)}</div>
              </div>

              {st === 'awaiting_payment' && (
                <div className="card p-6 rounded-[32px] text-center space-y-3">
                  <p className="text-sm text-ink-soft">{t.scanToPay}</p>
                  <div className="flex justify-center"><QRCodeSVG value={promptPayPayload(placed.promptpay_id, placed.total)} size={220} /></div>
                  <p className="text-xs text-ink-soft">หลังโอน พนักงานจะตรวจสอบและยืนยันให้ · Staff will confirm your payment</p>
                </div>
              )}

              <div className="card p-6 rounded-[32px] space-y-3">
                <div className="label">{t.trackStatus}</div>
                {STEPS.map((s, i) => (
                  <div key={s} className={`flex items-center gap-3 ${i <= stepIdx ? 'text-ink font-semibold' : 'text-gray-300'}`}>
                    <span className={`w-3 h-3 rounded-full ${i < stepIdx ? 'bg-ok' : i === stepIdx ? 'bg-gold animate-pulse' : 'bg-gray-200'}`} />
                    {label[s]}
                  </div>
                ))}
                {st === 'done' && <div className="text-ok font-semibold">{t.done} ✓</div>}
              </div>
              {(st === 'done' || st === 'ready') && <button className="btn-ghost w-full" onClick={newOrder}>{t.orderOnline}</button>}
            </>
          )}
        </div>
      </main>
    );
  }

  // ---------- หน้าเมนู ----------
  const shown = products.filter((p) => cat === 'all' || p.category_id === cat);
  return (
    <main className="min-h-screen bg-pearl pb-28">
      <header className="sticky top-0 z-20 glass border-b border-gray-100 px-4 py-3 flex items-center justify-between">
        <div className="font-extrabold uppercase tracking-widest text-sm">{shop}</div>
        <button className="text-xs font-semibold text-ink-soft" onClick={() => setLanguage(lang === 'TH' ? 'EN' : 'TH')}>{lang === 'TH' ? 'EN' : 'TH'}</button>
      </header>

      <div className="px-4 pt-4 flex gap-2 overflow-x-auto no-scrollbar">
        {[{ id: 'all', label: t.all }, ...cats.map((c) => ({ id: c.id, label: lang === 'TH' ? c.name_th : c.name_en }))].map((c) => (
          <button key={c.id} onClick={() => setCat(c.id)}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold border ${cat === c.id ? 'bg-gold text-white border-gold' : 'bg-white border-gray-200 text-ink-soft'}`}>{c.label}</button>
        ))}
      </div>

      <div className="p-4 grid grid-cols-2 gap-3">
        {shown.map((p) => (
          <div key={p.id} className="card overflow-hidden rounded-3xl flex flex-col">
            <div className="h-24 bg-pearl flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {p.image_url ? <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" /> : <span className="text-2xl font-extrabold text-gold/40">{p.name[0]}</span>}
            </div>
            <div className="p-3 flex-1 flex flex-col">
              <div className="font-semibold text-sm leading-tight line-clamp-2">{p.name}</div>
              <div className="font-bold text-gold-dark text-sm mt-1">฿{money(p.price)}</div>
              <div className="mt-2 flex items-center justify-end gap-2">
                {cart[p.id] ? (<>
                  <button className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center" onClick={() => set(p.id, -1)}><Minus size={14} /></button>
                  <span className="w-5 text-center font-bold text-sm">{cart[p.id]}</span>
                </>) : null}
                <button className="w-8 h-8 rounded-full bg-gold text-white flex items-center justify-center" onClick={() => set(p.id, 1)}><Plus size={14} /></button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {count > 0 && (
        <div className="fixed bottom-4 inset-x-4 z-30">
          <button className="btn-gold w-full !py-4 flex items-center justify-between shadow-soft" onClick={() => setCartOpen(true)}>
            <span className="flex items-center gap-2"><ShoppingBag size={18} />{t.cart} ({count})</span>
            <span>฿{money(preview.subtotal)}</span>
          </button>
        </div>
      )}

      <Modal open={cartOpen} onClose={() => setCartOpen(false)} title={t.cart}>
        <div className="space-y-3">
          <ul className="space-y-2 text-sm">
            {items.map((i) => (
              <li key={i.product_id} className="flex items-center justify-between gap-2">
                <span className="flex-1 truncate">{i.name}</span>
                <button className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center" onClick={() => set(i.product_id, -1)}><Minus size={12} /></button>
                <b className="w-5 text-center">{i.quantity}</b>
                <button className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center" onClick={() => set(i.product_id, 1)}><Plus size={12} /></button>
                <span className="w-16 text-right">฿{money(i.price * i.quantity)}</span>
              </li>
            ))}
          </ul>

          <div className="rounded-2xl bg-pearl p-3 space-y-2">
            <div className="label !mb-0">{t.memberOptional}</div>
            <input className="input" inputMode="numeric" maxLength={10} placeholder="0xxxxxxxxx" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))} />
            {phone.length === 10 && (<>
              <input className="input" type="password" inputMode="numeric" maxLength={6} placeholder={`${t.pin} (${t.redeemPoints}, ${t.optional})`} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} />
              {pin.length >= 4 && (
                <input className="input" type="number" min="0" step="10" placeholder={`${t.usePoints} (${t.optional})`} value={pts || ''} onChange={(e) => setPts(Math.max(0, Number(e.target.value) || 0))} />
              )}
            </>)}
          </div>

          <div className="text-sm text-ink-soft space-y-1">
            <div className="flex justify-between"><span>{t.subtotal}</span><span>฿{money(preview.subtotal)}</span></div>
            <div className="flex justify-between"><span>{t.tax}</span><span>฿{money(preview.tax)}</span></div>
            <div className="flex justify-between text-ink text-lg font-extrabold"><span>{t.total}</span><span className="text-gold-dark">฿{money(preview.total)}</span></div>
            {pin && <p className="text-xs">* ส่วนลดจากแต้มจะคำนวณจริงเมื่อสั่งซื้อ · Points discount is applied at checkout</p>}
          </div>
          {err && <p className="text-sm text-bad">{err}</p>}
          <button className="btn-gold w-full !py-3" disabled={busy || !items.length} onClick={submit}>{t.promptpay}</button>
        </div>
      </Modal>
    </main>
  );
}
