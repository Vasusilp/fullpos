'use client';
import { useEffect, useMemo, useState } from 'react';
import { Search, Plus, Minus, Trash2, UserPlus, X, Banknote, QrCode } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { useCart } from '@/store/cartStore';
import { useApp } from '@/store/appStore';
import { useT } from '@/lib/i18n';
import { money, queueLabel, settingsFromRows, maxRedeemablePoints } from '@/lib/points';
import { promptPayPayload } from '@/lib/promptpay';
import Modal from '@/components/Modal';
import MemberModal from '@/components/MemberModal';

export default function PosPage() {
  const sb = supabaseBrowser();
  const lang = useApp((s) => s.language);
  const t = useT(lang);
  const cart = useCart();
  const totals = cart.totals();

  const [products, setProducts] = useState([]);
  const [cats, setCats] = useState([]);
  const [cat, setCat] = useState('all');
  const [q, setQ] = useState('');
  const [promptpayId, setPromptpayId] = useState('');
  const [memberOpen, setMemberOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [method, setMethod] = useState('cash');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(null);

  useEffect(() => {
    (async () => {
      const [p, c, s] = await Promise.all([
        sb.from('products').select('*').eq('is_available', true).order('name'),
        sb.from('categories').select('*').order('id'),
        sb.from('settings').select('*'),
      ]);
      setProducts(p.data || []);
      setCats(c.data || []);
      cart.setSettings(settingsFromRows(s.data));
      setPromptpayId(String(s.data?.find((r) => r.key === 'promptpay_id')?.value ?? ''));
    })();
  }, []); // eslint-disable-line

  const filtered = useMemo(
    () => products.filter((p) =>
      (cat === 'all' || p.category_id === cat) && p.name.toLowerCase().includes(q.toLowerCase())),
    [products, cat, q]
  );
  const catName = (id) => { const c = cats.find((x) => x.id === id); return c ? (lang === 'TH' ? c.name_th : c.name_en) : ''; };
  const maxPts = maxRedeemablePoints(totals.subtotal, cart.member, cart.settings);

  async function checkout() {
    setBusy(true); setErr('');
    const { data, error } = await sb.rpc('place_order', {
      p_items: cart.items.map((i) => ({ product_id: i.product_id, quantity: i.quantity })),
      p_member_id: cart.member?.id || null,
      p_points_to_use: cart.pointsToUse,
      p_payment_method: method,
    });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setDone(data);
    cart.clearCart();
    setPayOpen(false);
  }

  return (
    <div className="h-full flex">
      {/* Products */}
      <section className="flex-1 flex flex-col min-w-0 p-6 gap-4">
        <div className="relative">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-soft" />
          <input className="input pl-11 rounded-full" placeholder={t.search} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {[{ id: 'all', label: t.all }, ...cats.map((c) => ({ id: c.id, label: lang === 'TH' ? c.name_th : c.name_en }))].map((c) => (
            <button key={c.id} onClick={() => setCat(c.id)}
              className={`shrink-0 rounded-full px-5 py-2 text-sm font-semibold border transition ${
                cat === c.id ? 'bg-gold text-white border-gold' : 'bg-white border-gray-200 text-ink-soft hover:bg-gray-50'}`}>
              {c.label}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto pr-1">
          <div className="grid grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
            {filtered.map((p) => (
              <button key={p.id} onClick={() => cart.addItem(p)}
                className="card text-left overflow-hidden hover:-translate-y-0.5 hover:border-gold transition active:scale-[0.98]">
                <div className="h-28 bg-pearl flex items-center justify-center">
                  {p.image_url
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                    : <span className="text-3xl font-extrabold text-gold/40">{p.name[0]}</span>}
                </div>
                <div className="p-4">
                  <div className="font-semibold leading-tight line-clamp-2">{p.name}</div>
                  <div className="text-[11px] uppercase tracking-widest text-ink-soft mt-1">{catName(p.category_id)}</div>
                  <div className="mt-2 font-bold text-gold-dark">฿{money(p.price)}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Cart */}
      <aside className="w-[380px] shrink-0 h-full bg-white border-l border-gray-100 flex flex-col">
        <div className="p-5 flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-widest">{t.cart}</h2>
          {cart.items.length > 0 && <button onClick={cart.clearCart} className="text-xs text-bad font-semibold">{t.clear}</button>}
        </div>

        <div className="px-5 pb-3">
          {cart.member ? (
            <div className="rounded-2xl bg-gold-light/60 p-3 flex items-center justify-between">
              <div>
                <div className="font-semibold text-sm">{cart.member.full_name}</div>
                <div className="text-xs text-ink-soft">{cart.member.phone} · {cart.member.tier} · {cart.member.points} {t.points}</div>
              </div>
              <button onClick={() => cart.setMember(null)} className="p-1.5 rounded-full hover:bg-white"><X size={16} /></button>
            </div>
          ) : (
            <button onClick={() => setMemberOpen(true)} className="btn-ghost w-full flex items-center justify-center gap-2 text-sm">
              <UserPlus size={16} />{t.member}
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-5 space-y-3">
          {cart.items.length === 0 && <p className="text-center text-sm text-ink-soft mt-10">{t.emptyCart}</p>}
          {cart.items.map((i) => (
            <div key={i.product_id} className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate">{i.name}</div>
                <div className="text-xs text-ink-soft">฿{money(i.price)}</div>
              </div>
              <div className="flex items-center gap-1.5">
                <button className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-50"
                  onClick={() => cart.updateQuantity(i.product_id, i.quantity - 1)}><Minus size={14} /></button>
                <span className="w-6 text-center text-sm font-bold">{i.quantity}</span>
                <button className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-50"
                  onClick={() => cart.updateQuantity(i.product_id, i.quantity + 1)}><Plus size={14} /></button>
              </div>
              <button onClick={() => cart.removeItem(i.product_id)} className="text-bad p-1"><Trash2 size={16} /></button>
            </div>
          ))}
        </div>

        <div className="p-5 border-t border-gray-100 space-y-2 text-sm">
          {cart.member && (
            <div className="rounded-2xl bg-pearl p-3 space-y-2">
              <div className="flex justify-between text-xs text-ink-soft">
                <span>{t.redeemPoints} (max {maxPts})</span>
                <span>{t.willEarn} +{totals.pointsEarned}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-ink-soft">{t.pointsLeft}: <b className="text-ink">{Math.max(0, (cart.member.points || 0) - totals.pointsUsed)}</b> / {cart.member.points || 0}</span>
                {totals.discount > 0 && <span className="text-ok font-semibold">{t.discountPct} ฿{money(totals.discount)} ({(totals.discount / totals.subtotal * 100).toFixed(1).replace(/\.0$/, '')}%)</span>}
              </div>
              <div className="flex gap-2">
                <input className="input !py-1.5" type="number" min="0" step="10" max={maxPts} value={Math.min(cart.pointsToUse, maxPts) || ''}
                  placeholder={t.usePoints}
                  onChange={(e) => cart.setPointsToUse(Math.min(maxPts, Math.max(0, Number(e.target.value) || 0)))} />
                <button className="btn-ghost !py-1.5 !px-3 text-xs whitespace-nowrap" onClick={() => cart.setPointsToUse(maxPts)}>{t.useAll}</button>
              </div>
            </div>
          )}
          <Row label={t.subtotal} value={totals.subtotal} />
          {totals.discount > 0 && <Row label={t.discount} value={-totals.discount} className="text-ok" />}
          <Row label={`${t.tax} ${(cart.settings.tax_rate * 100).toFixed(0)}%`} value={totals.tax} />
          <div className="flex justify-between text-lg font-extrabold pt-1">
            <span>{t.total}</span><span className="text-gold-dark">฿{money(totals.total)}</span>
          </div>
          <button className="btn-gold w-full !py-3.5 text-base" disabled={!cart.items.length}
            onClick={() => { setErr(''); setPayOpen(true); }}>{t.checkout}</button>
        </div>
      </aside>

      <MemberModal open={memberOpen} onClose={() => setMemberOpen(false)} />

      <Modal open={payOpen} onClose={() => setPayOpen(false)} title={t.payment}>
        <div className="space-y-4">
          <div className="text-center">
            <div className="text-xs uppercase tracking-widest text-ink-soft">{t.total}</div>
            <div className="text-4xl font-extrabold text-gold-dark">฿{money(totals.total)}</div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[['cash', t.cash, Banknote], ['promptpay', t.promptpay, QrCode]].map(([k, label, Icon]) => (
              <button key={k} onClick={() => setMethod(k)}
                className={`rounded-3xl border p-4 flex flex-col items-center gap-2 font-semibold transition ${
                  method === k ? 'border-gold bg-gold-light text-gold-dark' : 'border-gray-200 text-ink-soft'}`}>
                <Icon size={24} />{label}
              </button>
            ))}
          </div>
          {method === 'promptpay' && (
            <div className="flex justify-center p-4 bg-white rounded-3xl border border-gray-100">
              <QRCodeSVG value={promptPayPayload(promptpayId, totals.total)} size={200} />
            </div>
          )}
          {err && <p className="text-sm text-bad">{err}</p>}
          <button className="btn-gold w-full !py-3" disabled={busy} onClick={checkout}>{t.confirm}</button>
        </div>
      </Modal>

      <Modal open={!!done} onClose={() => setDone(null)} title={t.yourQueue}>
        {done && (
          <div className="text-center space-y-3">
            <div className="text-7xl font-extrabold text-gold-dark">{queueLabel(done.queue_no)}</div>
            <div className="text-sm text-ink-soft">{t.total}: ฿{money(done.total)}</div>
            {done.points_earned > 0 && <div className="text-sm text-ok font-semibold">+{done.points_earned} {t.points}</div>}
            <button className="btn-gold w-full" onClick={() => setDone(null)}>{t.close}</button>
          </div>
        )}
      </Modal>
    </div>
  );
}

function Row({ label, value, className = '' }) {
  return (
    <div className={`flex justify-between text-ink-soft ${className}`}>
      <span>{label}</span><span>{value < 0 ? '-' : ''}฿{money(Math.abs(value))}</span>
    </div>
  );
}
