// ใช้คำนวณเพื่อ "แสดงผล" เท่านั้น — ค่าจริงคำนวณซ้ำใน RPC ฝั่ง DB ทุกครั้ง
export const DEFAULT_SETTINGS = {
  tax_rate: 0.07,
  earn_baht_per_point: 25,
  redeem_baht_per_10_points: 10,
  max_redeem_percent: 50,
  tier_silver_spend: 3000,
  tier_gold_spend: 10000,
};

export const TIER_MULT = { member: 1, silver: 1.2, gold: 1.5 };

export function maxRedeemablePoints(subtotal, member, s = DEFAULT_SETTINGS) {
  if (!member) return 0;
  const maxDisc = (subtotal * s.max_redeem_percent) / 100;
  const byPct = Math.floor(maxDisc / s.redeem_baht_per_10_points) * 10;
  const p = Math.min(member.points, byPct);
  return Math.max(p - (p % 10), 0);
}

export function calcTotals(items, member, pointsToUse, s = DEFAULT_SETTINGS) {
  const subtotal = items.reduce((a, i) => a + i.price * i.quantity, 0);
  const used = Math.min(pointsToUse || 0, maxRedeemablePoints(subtotal, member, s));
  const usedRounded = used - (used % 10);
  const discount = (usedRounded / 10) * s.redeem_baht_per_10_points;
  const net = subtotal - discount;
  const tax = Math.round(net * s.tax_rate * 100) / 100;
  const total = net + tax;
  const mult = member ? TIER_MULT[member.tier] || 1 : 0;
  const earned = member ? Math.floor((net / s.earn_baht_per_point) * mult) : 0;
  return { subtotal, discount, tax, total, pointsUsed: usedRounded, pointsEarned: earned };
}

export const money = (n) =>
  Number(n || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const queueLabel = (n) => 'Q' + String(n).padStart(3, '0');

export function settingsFromRows(rows = []) {
  const s = { ...DEFAULT_SETTINGS };
  for (const r of rows) {
    if (r.key in s) s[r.key] = Number(r.value);
  }
  return s;
}
