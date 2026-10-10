'use client';
import { create } from 'zustand';

export const useSession = create((set, get) => ({
  user: null,
  profile: null,
  role: null,
  loaded: false,
  setSession: (user, profile) =>
    set({ user, profile, role: profile?.role || null, loaded: true }),
  clear: () => set({ user: null, profile: null, role: null, loaded: true }),
  isAdmin: () => get().role === 'admin',
}));
