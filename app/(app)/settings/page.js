'use client';
import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { useSession } from '@/store/sessionStore';
import { useApp } from '@/store/appStore';
import { useT } from '@/lib/i18n';

export default function SettingsPage() {
  const sb = supabaseBrowser();
  const app = useApp();
  const t = useT(app.language);
  const isAdmin = useSession((s) => s.role) === 'admin';
  const [pw, setPw] = useState('');
  const [pwMsg, setPwMsg] = useState('');
  const [cfg, setCfg] = useState(null);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      const { data } = await sb.from('settings').select('*');
      const o = Object.fromEntries((data || []).map((r) => [r.key, r.value]));
      setCfg({
        shop_name: o.shop_name ?? '', promptpay_id: o.promptpay_id ?? '',
        tax_pct: (Number(o.tax_rate ?? 0.07) * 100).toString(),
        earn_baht_per_point: String(o.earn_baht_per_point ?? 25),
        redeem_baht_per_10_points: String(o.redeem_baht_per_10_points ?? 10),
        max_redeem_percent: String(o.max_redeem_percent ?? 50),
        tier_silver_spend: String(o.tier_silver_spend ?? 3000),
        tier_gold_spend: String(o.tier_gold_spend ?? 10000),
      });
    })();
  }, [isAdmin]); // eslint-disable-line

  async function changePassword(e) {
    e.preventDefault();
    const { error } = await sb.auth.updateUser({ password: pw });
    setPwMsg(error ? error.message : t.saved);
    if (!error) setPw('');
  }

  async function saveCfg(e) {
    e.preventDefault();
    const rows = [
      ['shop_name', cfg.shop_name], ['promptpay_id', cfg.promptpay_id],
      ['tax_rate', Number(cfg.tax_pct) / 100],
      ['earn_baht_per_point', Number(cfg.earn_baht_per_point)],
      ['redeem_baht_per_10_points', Number(cfg.redeem_baht_per_10_points)],
      ['max_redeem_percent', Number(cfg.max_redeem_percent)],
      ['tier_silver_spend', Number(cfg.tier_silver_spend)],
      ['tier_gold_spend', Number(cfg.tier_gold_spend)],
    ].map(([key, value]) => ({ key, value }));
    const { error } = await sb.from('settings').upsert(rows);
    if (!error) await sb.from('audit_logs').insert({ action: 'settings.update', detail: Object.fromEntries(rows.map((r) => [r.key, r.value])) }).then(() => {}, () => {});
    setMsg(error ? error.message : t.saved);
  }

  const field = (k, label, type = 'text') => (
    <div><label className="label">{label}</label>
      <input className="input" type={type} value={cfg[k]} onChange={(e) => setCfg({ ...cfg, [k]: e.target.value })} /></div>
  );

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-3xl space-y-5">
        <h1 className="text-sm font-bold uppercase tracking-widest">{t.settings}</h1>

        <div className="card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <span className="font-semibold">{t.language}</span>
            <div className="flex rounded-full border border-gray-200 overflow-hidden">
              {['TH', 'EN'].map((l) => (
                <button key={l} onClick={() => app.setLanguage(l)}
                  className={`px-5 py-1.5 text-sm font-semibold ${app.language === l ? 'bg-gold text-white' : 'text-ink-soft'}`}>{l}</button>
              ))}
            </div>
          </div>
          <label className="flex items-center justify-between"><span className="font-semibold">{t.notifications}</span>
            <input type="checkbox" checked={app.notificationsEnabled} onChange={(e) => app.setNotifications(e.target.checked)} /></label>
          <label className="flex items-center justify-between"><span className="font-semibold">{t.sound}</span>
            <input type="checkbox" checked={app.soundEnabled} onChange={(e) => app.setSound(e.target.checked)} /></label>
        </div>

        <form onSubmit={changePassword} className="card p-6 space-y-3">
          <div className="label">{t.changePassword}</div>
          <div className="flex gap-2">
            <input className="input" type="password" minLength={8} required placeholder={t.newPassword} value={pw} onChange={(e) => setPw(e.target.value)} />
            <button className="btn-gold">{t.save}</button>
          </div>
          {pwMsg && <p className="text-sm text-ink-soft">{pwMsg}</p>}
        </form>

        {isAdmin && cfg && (
          <form onSubmit={saveCfg} className="card p-6 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {field('shop_name', t.shopName)}
              {field('promptpay_id', t.promptpayId)}
              {field('tax_pct', t.taxRate, 'number')}
            </div>
            <div className="label pt-2">{t.memberProgram}</div>
            <div className="grid grid-cols-2 gap-3">
              {field('earn_baht_per_point', t.earnRate, 'number')}
              {field('redeem_baht_per_10_points', t.redeemRate, 'number')}
              {field('max_redeem_percent', t.maxRedeem, 'number')}
              <div />
              {field('tier_silver_spend', t.silverAt, 'number')}
              {field('tier_gold_spend', t.goldAt, 'number')}
            </div>
            {msg && <p className="text-sm text-ink-soft">{msg}</p>}
            <button className="btn-gold">{t.save}</button>
          </form>
        )}

        <div className="card p-6 text-sm text-ink-soft"><div className="label">{t.about}</div>POS Pearl · Quick Service + Membership · Next.js + Supabase</div>
      </div>
    </div>
  );
}
