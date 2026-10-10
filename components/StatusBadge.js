'use client';
import { useApp } from '@/store/appStore';
import { useT } from '@/lib/i18n';

const STYLE = {
  awaiting_payment: 'bg-gray-100 text-ink-soft',
  pending: 'bg-gold-light text-gold-dark',
  preparing: 'bg-amber-50 text-warn',
  ready: 'bg-green-50 text-ok',
  done: 'bg-gray-100 text-ink-soft',
  cancelled: 'bg-red-50 text-bad',
};
const KEY = {
  awaiting_payment: 'awaitingPayment', pending: 'pending', preparing: 'preparing',
  ready: 'ready', done: 'done', cancelled: 'cancelled',
};

export default function StatusBadge({ status }) {
  const t = useT(useApp((s) => s.language));
  return <span className={`badge ${STYLE[status] || ''}`}>{t[KEY[status]] || status}</span>;
}
