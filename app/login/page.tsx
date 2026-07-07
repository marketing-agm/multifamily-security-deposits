'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

// Small feature points shown on the brand panel — what the tool actually does.
const FEATURES = [
  'Import an AppFolio move-out export',
  'Auto-calculated charges, NRC offsets & RUBS',
  'Washington RCW 59.18.280 — 30-day compliant',
  'One-click AGM Checkout Report PDF',
];

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        // Return to the page they originally requested (defaults to home).
        const next = new URLSearchParams(window.location.search).get('next');
        router.replace(next && next.startsWith('/') ? next : '/');
      } else {
        setError('Incorrect password. Please try again.');
      }
    } catch {
      setError('Something went wrong — please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col md:flex-row">

      {/* ── Brand panel ─────────────────────────────────────────────────────── */}
      <aside className="relative overflow-hidden md:w-[46%] md:min-h-screen bg-gradient-to-br from-accent to-accent-hover text-on-accent px-8 py-10 md:px-12 md:py-14 flex flex-col">
        {/* Soft decorative glows for depth (purely cosmetic). */}
        <div className="pointer-events-none absolute -top-24 -right-16 w-80 h-80 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 -left-10 w-72 h-72 rounded-full bg-black/10 blur-3xl" />

        <div className="relative flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center text-base font-bold tracking-tight">
            AGM
          </div>
          <span className="text-sm font-semibold tracking-wide opacity-90">AGM Real Estate Group</span>
        </div>

        <div className="relative mt-auto pt-10">
          <h1 className="text-large-title font-bold text-balance">
            Security Deposit Return Tool
          </h1>
          <p className="mt-3 text-base/relaxed opacity-90 max-w-sm">
            Turn a move-out export into a compliant AGM Checkout Report in minutes.
          </p>

          <ul className="mt-7 space-y-2.5 max-w-sm">
            {FEATURES.map(f => (
              <li key={f} className="flex items-start gap-2.5 text-sm opacity-95">
                <span className="mt-0.5 shrink-0 w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[10px]">✓</span>
                {f}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative mt-10 text-xs opacity-70">Internal tool · Authorized staff only</p>
      </aside>

      {/* ── Sign-in panel ───────────────────────────────────────────────────── */}
      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-6">
            <h2 className="text-title2 text-app-text">Sign in</h2>
            <p className="text-subhead text-secondary mt-1">
              Enter the site password to continue.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <label className="block space-y-1">
              <span className="text-xs font-medium text-secondary">Site password</span>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoFocus
                autoComplete="current-password"
                placeholder="••••••••••"
                className="w-full bg-surface border border-tertiary rounded-xl px-3 py-2.5 text-sm text-app-text focus:outline-none focus:ring-2 focus:ring-accent transition-colors"
              />
            </label>

            {error && <p className="text-sm text-danger-fg">{error}</p>}

            <button
              type="submit"
              disabled={loading || !password}
              className="w-full bg-accent text-on-accent rounded-xl py-2.5 text-sm font-semibold hover:bg-accent-hover transition-colors disabled:opacity-50"
            >
              {loading ? 'Checking…' : 'Continue'}
            </button>
          </form>

          <p className="mt-6 text-xs text-secondary">
            Trouble getting in? Ask your AGM administrator for the current site password.
          </p>
        </div>
      </main>
    </div>
  );
}
