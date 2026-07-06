'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AdminSettings } from '@/types';
import { DEFAULT_ADMIN_SETTINGS, withDefaults } from '@/lib/adminSettings';

// This is a SEPARATE store from the upload session on purpose.
// The session (agm_deposit_session) gets wiped whenever someone clicks
// "Start new upload". Settings should NOT be wiped by that — they're
// company config that outlives any single batch of tenants. So they get
// their own localStorage key.
const SETTINGS_KEY = 'agm_admin_settings';

// The shape of what this context hands out to components that use it.
// (Think of it like the public methods of a Java class.)
interface AdminSettingsContextValue {
  settings: AdminSettings;
  // Save a partial update — e.g. updateSettings({ reviewGate: 'hard' }).
  // Only the fields you pass change; everything else stays as-is.
  updateSettings: (patch: Partial<AdminSettings>) => void;
  // Wipe everything back to the built-in defaults.
  resetSettings: () => void;
}

const AdminSettingsContext = createContext<AdminSettingsContextValue | null>(null);

export function AdminSettingsProvider({ children }: { children: React.ReactNode }) {
  // Start from defaults, then hydrate from storage after mount (below).
  const [settings, setSettings] = useState<AdminSettings>(DEFAULT_ADMIN_SETTINGS);

  // On first render in the browser, load any saved settings.
  // We do this in useEffect (not up front) because localStorage only exists
  // in the browser, not during server rendering — reading it too early crashes.
  useEffect(() => {
    try {
      const stored = localStorage.getItem(SETTINGS_KEY);
      if (stored) setSettings(withDefaults(JSON.parse(stored)));
    } catch {
      // ignore corrupt storage — we'll just fall back to defaults
    }
  }, []);

  // Write the given settings object to localStorage as text (JSON).
  const persist = (s: AdminSettings) => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  };

  // Apply a partial change on top of the current settings, save, and re-render.
  // useCallback keeps this function identity stable so children don't re-render needlessly.
  const updateSettings = useCallback((patch: Partial<AdminSettings>) => {
    setSettings(prev => {
      const next = withDefaults({ ...prev, ...patch });
      persist(next);
      return next;
    });
  }, []);

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_ADMIN_SETTINGS);
    persist(DEFAULT_ADMIN_SETTINGS);
  }, []);

  return (
    <AdminSettingsContext.Provider value={{ settings, updateSettings, resetSettings }}>
      {children}
    </AdminSettingsContext.Provider>
  );
}

// The hook components call to read/change settings. Throws if used outside the
// provider so mistakes fail loudly instead of silently doing nothing.
export function useAdminSettings(): AdminSettingsContextValue {
  const ctx = useContext(AdminSettingsContext);
  if (!ctx) throw new Error('useAdminSettings must be used within AdminSettingsProvider');
  return ctx;
}
