'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { SessionState, TenantReturn } from '@/types';

const SESSION_KEY = 'agm_deposit_session';

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
      const stored = localStorage.getItem(SESSION_KEY);
      if (stored) setSessionState(JSON.parse(stored));
    } catch {
      // ignore corrupt storage
    }
  }, []);

  const persist = (s: SessionState | null) => {
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else localStorage.removeItem(SESSION_KEY);
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
