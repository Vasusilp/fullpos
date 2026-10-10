'use client';
import { create } from 'zustand';
import { calcTotals, DEFAULT_SETTINGS } from '@/lib/points';

export const useCart = create((set, get) => ({
  items: [],            // { product_id, name, price, quantity }
  member: null,
  pointsToUse: 0,
  settings: DEFAULT_SETTINGS,

  setSettings: (settings) => set({ settings }),
  addItem: (p) =>
    set((s) => {
      const found = s.items.find((i) => i.product_id === p.id);
      if (found) {
        return { items: s.items.map((i) => (i.product_id === p.id ? { ...i, quantity: Math.min(i.quantity + 1, 99) } : i)) };
      }
      return { items: [...s.items, { product_id: p.id, name: p.name, price: Number(p.price), quantity: 1 }] };
    }),
  removeItem: (id) => set((s) => ({ items: s.items.filter((i) => i.product_id !== id) })),
  updateQuantity: (id, q) =>
    set((s) => ({
      items: q <= 0
        ? s.items.filter((i) => i.product_id !== id)
        : s.items.map((i) => (i.product_id === id ? { ...i, quantity: Math.min(q, 99) } : i)),
    })),
  clearCart: () => set({ items: [], member: null, pointsToUse: 0 }),
  setMember: (member) => set({ member, pointsToUse: 0 }),
  setPointsToUse: (pointsToUse) => set({ pointsToUse }),

  totals: () => {
    const { items, member, pointsToUse, settings } = get();
    return calcTotals(items, member, pointsToUse, settings);
  },
  getSubtotal: () => get().totals().subtotal,
  getDiscount: () => get().totals().discount,
  getTax: () => get().totals().tax,
  getTotal: () => get().totals().total,
  getPointsEarned: () => get().totals().pointsEarned,
}));
