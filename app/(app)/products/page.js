'use client';
import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { useSession } from '@/store/sessionStore';
import { useApp } from '@/store/appStore';
import { useT } from '@/lib/i18n';
import { money } from '@/lib/points';
import Modal from '@/components/Modal';

const EMPTY = { id: null, name: '', price: '', category_id: '', image_url: '', is_available: true };

export default function ProductsPage() {
  const sb = supabaseBrowser();
  const lang = useApp((s) => s.language);
  const t = useT(lang);
  const isAdmin = useSession((s) => s.role) === 'admin';
  const [rows, setRows] = useState([]);
  const [cats, setCats] = useState([]);
  const [q, setQ] = useState('');
  const [form, setForm] = useState(null);
  const [del, setDel] = useState(null);
  const [file, setFile] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    const [p, c] = await Promise.all([
      sb.from('products').select('*').order('created_at', { ascending: false }),
      sb.from('categories').select('*').order('id'),
    ]);
    setRows(p.data || []); setCats(c.data || []);
  }
  useEffect(() => { load(); }, []); // eslint-disable-line

  const catName = (id) => { const c = cats.find((x) => x.id === id); return c ? (lang === 'TH' ? c.name_th : c.name_en) : '—'; };
  const shown = rows.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()));

  async function save(e) {
    e.preventDefault();
    setBusy(true); setErr('');
    let image_url = form.image_url || null;
    if (file) {
      const path = `${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const up = await sb.storage.from('product-images').upload(path, file);
      if (up.error) { setErr(up.error.message); setBusy(false); return; }
      image_url = sb.storage.from('product-images').getPublicUrl(path).data.publicUrl;
    }
    const payload = {
      name: form.name.trim(), price: Number(form.price),
      category_id: form.category_id ? Number(form.category_id) : null,
      image_url, is_available: form.is_available,
    };
    const { error } = form.id
      ? await sb.from('products').update(payload).eq('id', form.id)
      : await sb.from('products').insert(payload);
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setForm(null); setFile(null); load();
  }

  async function remove() {
    const { error } = await sb.from('products').delete().eq('id', del.id);
    if (error) {
      // สินค้าที่เคยขายแล้วลบไม่ได้ (อ้างอิงใน order_items) ให้ปิดขายแทน
      await sb.from('products').update({ is_available: false }).eq('id', del.id);
    }
    setDel(null); load();
  }

  async function toggle(p) {
    await sb.from('products').update({ is_available: !p.is_available }).eq('id', p.id);
    load();
  }

  return (
    <div className="h-full flex flex-col p-6 gap-4">
      <div className="flex items-center gap-3">
        <h1 className="text-sm font-bold uppercase tracking-widest mr-auto">{t.products}</h1>
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-soft" />
          <input className="input pl-10 rounded-full !w-64" placeholder={t.search} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {isAdmin && (
          <button className="btn-gold flex items-center gap-2" onClick={() => { setForm(EMPTY); setFile(null); setErr(''); }}>
            <Plus size={16} />{t.addProduct}
          </button>
        )}
      </div>

      <div className="card flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-white text-left text-[11px] uppercase tracking-widest text-ink-soft">
            <tr>{[t.image, t.name, t.category, t.price, t.status, ''].map((h, i) => <th key={i} className="px-5 py-3">{h}</th>)}</tr>
          </thead>
          <tbody>
            {shown.map((p) => (
              <tr key={p.id} className="border-t border-gray-50 hover:bg-pearl">
                <td className="px-5 py-2">
                  <div className="w-12 h-12 rounded-2xl bg-pearl overflow-hidden flex items-center justify-center text-gold/50 font-bold">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {p.image_url ? <img src={p.image_url} alt="" className="w-full h-full object-cover" /> : p.name[0]}
                  </div>
                </td>
                <td className="px-5 py-2 font-semibold">{p.name}</td>
                <td className="px-5 py-2 text-ink-soft">{catName(p.category_id)}</td>
                <td className="px-5 py-2 font-semibold">฿{money(p.price)}</td>
                <td className="px-5 py-2">
                  {isAdmin ? (
                    <button onClick={() => toggle(p)}
                      className={`badge ${p.is_available ? 'bg-green-50 text-ok' : 'bg-gray-100 text-ink-soft'}`}>
                      {p.is_available ? t.available : t.unavailable}
                    </button>
                  ) : (
                    <span className={`badge ${p.is_available ? 'bg-green-50 text-ok' : 'bg-gray-100 text-ink-soft'}`}>
                      {p.is_available ? t.available : t.unavailable}
                    </span>
                  )}
                </td>
                <td className="px-5 py-2 text-right whitespace-nowrap">
                  {isAdmin && (<>
                    <button className="p-2 rounded-full hover:bg-gray-100" onClick={() => { setForm({ ...p, price: String(p.price), category_id: p.category_id || '' }); setFile(null); setErr(''); }}><Pencil size={16} /></button>
                    <button className="p-2 rounded-full hover:bg-red-50 text-bad" onClick={() => setDel(p)}><Trash2 size={16} /></button>
                  </>)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={!!form} onClose={() => setForm(null)} title={form?.id ? t.editProduct : t.addProduct}>
        {form && (
          <form onSubmit={save} className="space-y-3">
            <div><label className="label">{t.name}</label>
              <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">{t.price}</label>
                <input className="input" type="number" min="0" step="0.01" required value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></div>
              <div><label className="label">{t.category}</label>
                <select className="input" value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
                  <option value="">—</option>
                  {cats.map((c) => <option key={c.id} value={c.id}>{lang === 'TH' ? c.name_th : c.name_en}</option>)}
                </select></div>
            </div>
            <div><label className="label">{t.image}</label>
              <input className="input" type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} /></div>
            <label className="flex gap-2 text-sm"><input type="checkbox" checked={form.is_available} onChange={(e) => setForm({ ...form, is_available: e.target.checked })} />{t.available}</label>
            {err && <p className="text-sm text-bad">{err}</p>}
            <button className="btn-gold w-full" disabled={busy}>{t.save}</button>
          </form>
        )}
      </Modal>

      <Modal open={!!del} onClose={() => setDel(null)} title={t.delete}>
        {del && (
          <div className="space-y-4">
            <p className="text-sm"><b>{del.name}</b><br />{t.deleteConfirm}</p>
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
