'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

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
    <div className="min-h-screen bg-bg flex items-center justify-center px-6">
      <div className="w-full max-w-sm bg-surface rounded-2xl border border-separator shadow-card p-6">
        <h1 className="text-title2 text-app-text">AGM Security Deposit Tool</h1>
        <p className="text-subhead text-secondary mt-1">
          Enter the site password to continue.
        </p>

        <form onSubmit={handleSubmit} className="mt-5 space-y-3">
          <label className="block space-y-1">
            <span className="text-xs font-medium text-secondary">Password</span>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoFocus
              autoComplete="current-password"
              className="w-full bg-surface border border-tertiary rounded-xl px-3 py-2 text-sm text-app-text focus:outline-none focus:ring-2 focus:ring-accent transition-colors"
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
      </div>
    </div>
  );
}
