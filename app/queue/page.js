'use client';
import { useEffect, useState } from 'react';
import { queueLabel } from '@/lib/points';

export default function QueuePage() {
  const [data, setData] = useState({ preparing: [], ready: [] });
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token') || '';
    let stop = false;
    async function tick() {
      try {
        const res = await fetch(`/api/queue?token=${encodeURIComponent(token)}`, { cache: 'no-store' });
        if (res.status === 403) { setForbidden(true); return; }
        const j = await res.json();
        if (!stop) setData(j);
      } catch {}
      if (!stop) setTimeout(tick, 3000);
    }
    tick();
    return () => { stop = true; };
  }, []);

  if (forbidden) return <main className="h-screen flex items-center justify-center text-ink-soft">Invalid display token</main>;

  return (
    <main className="h-screen overflow-hidden bg-pearl grid grid-cols-2 gap-6 p-6">
      <Column title="กำลังทำ · Preparing" list={data.preparing} tone="text-warn" bg="bg-white" />
      <Column title="พร้อมรับ · Ready" list={data.ready} tone="text-ok" bg="bg-white" highlight />
    </main>
  );
}

function Column({ title, list, tone, bg, highlight }) {
  return (
    <section className={`${bg} card rounded-[40px] p-8 flex flex-col min-h-0 ${highlight ? 'ring-2 ring-ok/30' : ''}`}>
      <h2 className={`text-2xl font-extrabold uppercase tracking-widest ${tone}`}>{title}</h2>
      <div className="flex-1 overflow-hidden mt-6 grid grid-cols-2 gap-5 content-start">
        {list.map((n) => (
          <div key={n} className={`rounded-[32px] py-6 text-center text-7xl font-extrabold tabular-nums ${
            highlight ? 'bg-green-50 text-ok' : 'bg-gold-light text-gold-dark'}`}>
            {queueLabel(n)}
          </div>
        ))}
      </div>
    </section>
  );
}
