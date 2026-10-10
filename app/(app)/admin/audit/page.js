'use client';
import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { useApp } from '@/store/appStore';
import { useT } from '@/lib/i18n';

export default function AuditPage() {
  const sb = supabaseBrowser();
  const t = useT(useApp((s) => s.language));
  const [rows, setRows] = useState([]);

  useEffect(() => {
    (async () => {
      const [a, p] = await Promise.all([
        sb.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(300),
        sb.from('profiles').select('id, full_name'),
      ]);
      const names = Object.fromEntries((p.data || []).map((x) => [x.id, x.full_name]));
      setRows((a.data || []).map((r) => ({ ...r, who: names[r.user_id] || (r.user_id ? '—' : 'customer / system') })));
    })();
  }, []); // eslint-disable-line

  return (
    <div className="h-full flex flex-col p-6 gap-4">
      <h1 className="text-sm font-bold uppercase tracking-widest">{t.audit}</h1>
      <div className="card flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-white text-left text-[11px] uppercase tracking-widest text-ink-soft">
            <tr>{['Time', 'User', 'Action', 'Detail'].map((h) => <th key={h} className="px-5 py-3">{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-gray-50 align-top">
                <td className="px-5 py-3 whitespace-nowrap text-ink-soft">{new Date(r.created_at).toLocaleString('th-TH')}</td>
                <td className="px-5 py-3">{r.who}</td>
                <td className="px-5 py-3 font-semibold">{r.action}</td>
                <td className="px-5 py-3 text-xs text-ink-soft font-mono break-all">{r.detail ? JSON.stringify(r.detail) : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
