'use client';
import { useEffect, useMemo, useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { useApp } from '@/store/appStore';
import { useT } from '@/lib/i18n';
import { money } from '@/lib/points';

const GOLD = '#B8962E';
const MONTHLY_GOAL_KEY = 'pos-monthly-goal';

const dayKey = (d) => new Date(d).toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });

export default function ReportsPage() {
  const sb = supabaseBrowser();
  const t = useT(useApp((s) => s.language));
  const [orders, setOrders] = useState([]);
  const [staff, setStaff] = useState([]);
  const [members, setMembers] = useState([]);
  const [tx, setTx] = useState([]);
  const [goal, setGoal] = useState(100000);

  useEffect(() => {
    try { const g = Number(localStorage.getItem(MONTHLY_GOAL_KEY)); if (g) setGoal(g); } catch {}
    (async () => {
      const since = new Date(Date.now() - 60 * 864e5).toISOString();
      const [o, s, m, p] = await Promise.all([
        sb.from('orders').select('*, order_items(name, quantity, price)').gte('created_at', since).neq('status', 'cancelled').neq('payment_status', 'unpaid'),
        sb.from('profiles').select('id, full_name'),
        sb.from('members_public').select('id, created_at'),
        sb.from('point_transactions').select('type, points, created_at').gte('created_at', since),
      ]);
      setOrders(o.data || []); setStaff(s.data || []); setMembers(m.data || []); setTx(p.data || []);
    })();
  }, []); // eslint-disable-line

  const r = useMemo(() => {
    const now = Date.now();
    const today = dayKey(now);
    const sum = (list) => list.reduce((a, o) => a + Number(o.total), 0);
    const inRange = (o, fromDays, toDays) => {
      const age = (now - new Date(o.created_at).getTime()) / 864e5;
      return age >= fromDays && age < toDays;
    };
    const last30 = orders.filter((o) => inRange(o, 0, 30));
    const prev30 = orders.filter((o) => inRange(o, 30, 60));
    const todaySales = sum(orders.filter((o) => dayKey(o.created_at) === today));
    const revenue = sum(last30), prevRev = sum(prev30);
    const pct = prevRev > 0 ? ((revenue - prevRev) / prevRev) * 100 : null;

    // จ.–อา. ของสัปดาห์นี้
    const d = new Date(); const dow = (d.getDay() + 6) % 7; // 0 = Monday
    const monday = new Date(d); monday.setDate(d.getDate() - dow); monday.setHours(0, 0, 0, 0);
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label, i) => {
      const day = new Date(monday); day.setDate(monday.getDate() + i);
      return { label, sales: sum(orders.filter((o) => dayKey(o.created_at) === dayKey(day))) };
    });
    // 4 สัปดาห์ล่าสุด
    const weeks = [3, 2, 1, 0].map((w) => ({
      label: w === 0 ? 'This wk' : `-${w} wk`,
      sales: sum(orders.filter((o) => inRange(o, w * 7, (w + 1) * 7))),
    }));
    // เป้าหมายรายเดือน
    const ym = dayKey(now).slice(0, 7);
    const monthSales = sum(orders.filter((o) => dayKey(o.created_at).slice(0, 7) === ym));

    const top = {};
    last30.forEach((o) => o.order_items.forEach((i) => { top[i.name] = (top[i.name] || 0) + i.quantity; }));
    const topList = Object.entries(top).sort((a, b) => b[1] - a[1]).slice(0, 5);

    const byStaff = {};
    last30.forEach((o) => { const k = o.created_by || 'qr'; byStaff[k] = (byStaff[k] || 0) + Number(o.total); });
    const staffList = Object.entries(byStaff).map(([k, v]) => ({
      name: k === 'qr' ? 'QR (customer)' : staff.find((s) => s.id === k)?.full_name || '—', v,
    })).sort((a, b) => b.v - a.v);

    const memberSales = sum(last30.filter((o) => o.member_id));
    const newMembers = members.filter((m) => (now - new Date(m.created_at).getTime()) / 864e5 < 7).length;
    const issued = tx.filter((x) => x.points > 0 && x.type === 'earn').reduce((a, x) => a + x.points, 0);
    const redeemed = Math.abs(tx.filter((x) => x.type === 'redeem').reduce((a, x) => a + x.points, 0));

    return { todaySales, revenue, pct, days, weeks, monthSales, topList, staffList, memberSales, newMembers, issued, redeemed };
  }, [orders, staff, members, tx]);

  const goalPct = Math.min(100, (r.monthSales / goal) * 100);

  return (
    <div className="h-full overflow-y-auto p-6 space-y-5">
      <h1 className="text-sm font-bold uppercase tracking-widest">{t.reports}</h1>

      <div className="grid grid-cols-3 gap-4">
        <Kpi label={t.todaySales} value={`฿${money(r.todaySales)}`} />
        <Kpi label={t.totalRevenue} value={`฿${money(r.revenue)}`}
          sub={r.pct === null ? null : (
            <span className={`flex items-center gap-1 ${r.pct >= 0 ? 'text-ok' : 'text-bad'}`}>
              {r.pct >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}{r.pct.toFixed(1)}%
            </span>)} />
        <div className="card p-5">
          <div className="label">{t.monthlyGoal}</div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-extrabold">฿{money(r.monthSales)}</span>
            <input className="w-28 text-right text-xs text-ink-soft bg-transparent border-b border-gray-200 outline-none" type="number" value={goal}
              onChange={(e) => { const g = Number(e.target.value) || 0; setGoal(g); try { localStorage.setItem(MONTHLY_GOAL_KEY, String(g)); } catch {} }} />
          </div>
          <div className="mt-3 h-2.5 rounded-full bg-gray-100 overflow-hidden"><div className="h-full bg-gold rounded-full" style={{ width: `${goalPct}%` }} /></div>
          <div className="text-xs text-ink-soft mt-1">{goalPct.toFixed(0)}%</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <ChartCard title={t.dailySales} data={r.days} />
        <ChartCard title={t.weeklySales} data={r.weeks} />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="card p-5">
          <div className="label">{t.topProducts}</div>
          <ol className="space-y-2 mt-2 text-sm">
            {r.topList.map(([n, q], i) => (
              <li key={n} className="flex justify-between"><span><b className="text-gold-dark mr-2">{i + 1}</b>{n}</span><b>{q}</b></li>
            ))}
          </ol>
        </div>
        <div className="card p-5">
          <div className="label">{t.salesByStaff}</div>
          <ul className="space-y-2 mt-2 text-sm">
            {r.staffList.map((s) => <li key={s.name} className="flex justify-between"><span>{s.name}</span><b>฿{money(s.v)}</b></li>)}
          </ul>
        </div>
        <div className="card p-5">
          <div className="label">{t.memberStats}</div>
          <ul className="space-y-2 mt-2 text-sm">
            <li className="flex justify-between"><span>{t.newMembers}</span><b>{r.newMembers}</b></li>
            <li className="flex justify-between"><span>{t.memberShare}</span><b>{r.revenue ? ((r.memberSales / r.revenue) * 100).toFixed(0) : 0}%</b></li>
            <li className="flex justify-between"><span>{t.pointsIssued}</span><b className="text-ok">+{r.issued}</b></li>
            <li className="flex justify-between"><span>{t.pointsRedeemed}</span><b className="text-bad">-{r.redeemed}</b></li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, sub }) {
  return (
    <div className="card p-5">
      <div className="label">{label}</div>
      <div className="text-3xl font-extrabold">{value}</div>
      {sub && <div className="text-sm font-semibold mt-1">{sub}</div>}
    </div>
  );
}

function ChartCard({ title, data }) {
  return (
    <div className="card p-5">
      <div className="label">{title}</div>
      <div className="h-56 mt-2">
        <ResponsiveContainer>
          <BarChart data={data}>
            <CartesianGrid vertical={false} stroke="#F3F4F6" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} />
            <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} width={48} />
            <Tooltip formatter={(v) => `฿${money(v)}`} cursor={{ fill: '#F5EBCB66' }} />
            <Bar dataKey="sales" fill={GOLD} radius={[10, 10, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
