'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useApp = create(
  persist(
    (set) => ({
      language: 'TH',
      notificationsEnabled: true,
      soundEnabled: true,
      setLanguage: (language) => set({ language }),
      setNotifications: (notificationsEnabled) => set({ notificationsEnabled }),
      setSound: (soundEnabled) => set({ soundEnabled }),
    }),
    { name: 'pos-app' }
  )
);
