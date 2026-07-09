'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { SessionState, TenantReturn } from '@/types';

const SESSION_KEY = 'agm_deposit_session';

// We keep the uploaded move-out data in sessionStorage, NOT localStorage.
// Both are browser key/value stores, but they differ in lifetime:
//   • localStorage   — permanent; survives closing the browser (kept until cleared).
//   • sessionStorage — per browser tab; survives a page refresh, but is wiped when
//                      the tab/browser is closed (and a new tab starts empty).
// Tenant names + financial figures are sensitive, and on a shared office computer
// we don't want the last upload lingering. sessionStorage means: reopen the app in
// a fresh browser session → no previous Excel/tenants. (Theme is separate and does
// stay in localStorage, since a display preference SHOULD persist.)
const store = (): Storage | null =>
  typeof window !== 'undefined' ? window.sessionStorage : null;

interface SessionContextValue {
  session: SessionState | null;
  setSession: (s: SessionState) => void;
  updateReturn: (id: string, patch: Partial<TenantReturn>) => void;
  clearSession: () => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSessionState] = useState<SessionState | null>(null);

  useEffect(() => {
    try {
      const stored = store()?.getItem(SESSION_KEY);
      if (stored) setSessionState(JSON.parse(stored));
    } catch {
      // ignore corrupt storage
    }
  }, []);

  const persist = (s: SessionState | null) => {
    const s2 = store();
    if (!s2) return;
    if (s) s2.setItem(SESSION_KEY, JSON.stringify(s));
    else s2.removeItem(SESSION_KEY);
  };

  const setSession = useCallback((s: SessionState) => {
    setSessionState(s);
    persist(s);
  }, []);

  const updateReturn = useCallback((id: string, patch: Partial<TenantReturn>) => {
    setSessionState(prev => {
      if (!prev) return prev;
      const updated = {
        ...prev,
        returns: prev.returns.map(r => (r.id === id ? { ...r, ...patch } : r)),
      };
      persist(updated);
      return updated;
    });
  }, []);

  const clearSession = useCallback(() => {
    setSessionState(null);
    persist(null);
  }, []);

  return (
    <SessionContext.Provider value={{ session, setSession, updateReturn, clearSession }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within SessionProvider');
  return ctx;
}
