'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/context/SessionContext';
import { useTheme } from '@/context/ThemeContext';
import { parseAppFolioExport, ParseError } from '@/lib/parser';
import { lookupProperty } from '@/lib/propertyConfig';

export default function UploadPage() {
  const { session, setSession } = useSession();
  const { theme, toggle } = useTheme();
  const router = useRouter();
  const [dragging, setDragging] = useState(false);
  const [errors, setErrors] = useState<ParseError[]>([]);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Unlock gate ──────────────────────────────────────────────────────────
  // The right side (upload) is locked until the site password is entered.
  const [unlocked, setUnlocked] = useState(false);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [unlocking, setUnlocking] = useState(false);

  // On load, ask the server whether this visitor is already unlocked (valid
  // cookie) — or whether the gate is unconfigured — so we don't re-prompt.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/session');
        const data = await res.json();
        if (!cancelled && data?.authed) setUnlocked(true);
      } catch {
        /* leave locked; the password form still works */
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    setUnlocking(true);
    setAuthError('');
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (res.ok) setUnlocked(true);
      else setAuthError('Incorrect password. Please try again.');
    } catch {
      setAuthError('Something went wrong — please try again.');
    } finally {
      setUnlocking(false);
    }
  }

  const hasSession = session && session.returns.length > 0;

  async function handleFile(file: File) {
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      setErrors([{ message: 'Please upload an Excel file (.xlsx or .xls).' }]);
      return;
    }
    setLoading(true);
    setErrors([]);
    try {
      const buffer = await file.arrayBuffer();
      const result = parseAppFolioExport(buffer);
      if (result.errors.length > 0 && result.returns.length === 0) {
        setErrors(result.errors);
        return;
      }
      const resolvedName = result.propertyName || file.name.replace(/\.xlsx?$/, '');
      setSession({
        propertyName: resolvedName,
        uploadDate: new Date().toLocaleDateString('en-US'),
        returns: result.returns,
        propertyConfig: lookupProperty(resolvedName),
      });
      if (result.errors.length > 0) setErrors(result.errors);
      router.push('/dashboard');
    } catch (err) {
      setErrors([{ message: err instanceof Error ? err.message : 'Failed to parse file.' }]);
    } finally {
      setLoading(false);
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (!unlocked) return;
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      {/* Header */}
      <header className="bg-surface border-b border-separator px-6 py-4">
        <div className="w-full flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold text-app-text">AGM Security Deposit Return Tool</h1>
            <p className="text-xs text-secondary mt-0.5">AGM Real Estate Group</p>
          </div>
          <div className="flex items-center gap-3">
            {unlocked && hasSession && (
              <button
                onClick={() => router.push('/dashboard')}
                className="text-sm text-accent hover:underline font-medium"
              >
                Resume session ({session.returns.length} tenant{session.returns.length !== 1 ? 's' : ''}) →
              </button>
            )}
            <button
              onClick={toggle}
              className="w-9 h-9 rounded-full bg-fill flex items-center justify-center text-base hover:brightness-95 dark:hover:brightness-110 transition-colors shrink-0"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
          </div>
        </div>
      </header>

      {/* Split: instructions (left) · upload (right) */}
      <main className="flex-1 w-full max-w-6xl mx-auto grid md:grid-cols-2 gap-6 px-6 py-10">

        {/* ── Left: instructions ─────────────────────────────────────────────── */}
        <section className="space-y-4">
          <div>
            <h2 className="text-title2 text-app-text">Create a checkout report</h2>
            <p className="text-subhead text-secondary mt-1">
              Export a move-out report from AppFolio, unlock uploads with the site
              password, then drop the file in to load every move-out at once.
            </p>
          </div>

          <div className="bg-surface rounded-2xl border border-separator p-5 space-y-3">
            <p className="text-xs font-semibold text-secondary uppercase tracking-wider">What to export from AppFolio</p>
            <ol className="text-sm text-app-text space-y-2 list-decimal list-inside">
              <li>Run the Move-Out report in AppFolio for the target property</li>
              <li>Export to Excel (.xlsx)</li>
              <li>Ensure the file contains all 4 required sheets: Tenant &amp; Lease, Deposits &amp; Fees, Utility, Ledger</li>
              <li>Upload the file — all move-outs will populate automatically</li>
            </ol>
            <div className="border-t border-separator pt-3">
              <p className="text-xs font-semibold text-secondary uppercase tracking-wider mb-1">Inspection photos</p>
              <p className="text-sm text-app-text">
                In each return&apos;s <span className="font-medium">Move-In / Out Photos</span> section you can
                upload the move-in and move-out inspection photos so they&apos;re visible right in the form.
                A signed move-in inspection is required to defend deductions under Washington RCW&nbsp;59.18.280.
              </p>
            </div>
          </div>
        </section>

        {/* ── Right: upload (locked until password entered) ──────────────────── */}
        <section className="relative">
          {/* Upload content — dimmed & non-interactive while locked. */}
          <div
            className={`space-y-4 transition-all duration-500 ${
              unlocked ? 'opacity-100' : 'opacity-40 blur-[2px] pointer-events-none select-none'
            }`}
            aria-hidden={!unlocked}
          >
            <div>
              <h2 className="text-title2 text-app-text">Upload AppFolio Export</h2>
              <p className="text-secondary mt-1 text-sm">Drop your .xlsx file to get started.</p>
            </div>

            <div
              onDragOver={e => { e.preventDefault(); if (unlocked) setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => unlocked && fileRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-colors ${
                dragging ? 'border-accent bg-accent/10' : 'border-tertiary hover:border-accent hover:bg-surface'
              }`}
            >
              <div className="text-4xl mb-4">📂</div>
              <p className="text-app-text font-medium">Drop your .xlsx file here</p>
              <p className="text-secondary text-sm mt-1">or click to browse</p>
              <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={onFileChange} className="hidden" />
            </div>

            {loading && (
              <div className="text-center text-sm text-accent font-medium animate-pulse">Parsing file…</div>
            )}

            {errors.length > 0 && (
              <div className="bg-danger/10 border border-danger/30 rounded-2xl p-4 space-y-1">
                {errors.map((e, i) => (
                  <p key={i} className="text-sm text-danger-fg">
                    {e.sheet ? <span className="font-medium">[{e.sheet}]</span> : null} {e.message}
                  </p>
                ))}
              </div>
            )}
          </div>

          {/* Lock overlay — shown until unlocked (and while we check the session). */}
          {!unlocked && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-full max-w-sm bg-surface/90 backdrop-blur rounded-2xl border border-separator shadow-card p-6">
                <div className="w-11 h-11 rounded-2xl bg-accent/12 text-accent flex items-center justify-center text-xl mb-3">🔒</div>
                <h3 className="text-headline text-app-text">Uploads are locked</h3>
                <p className="text-subhead text-secondary mt-1">
                  Enter the site password to unlock uploads.
                </p>

                <form onSubmit={handleUnlock} className="mt-4 space-y-3">
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    autoFocus
                    autoComplete="current-password"
                    placeholder="Site password"
                    disabled={checking}
                    className="w-full bg-surface border border-tertiary rounded-xl px-3 py-2.5 text-sm text-app-text focus:outline-none focus:ring-2 focus:ring-accent transition-colors"
                  />
                  {authError && <p className="text-sm text-danger-fg">{authError}</p>}
                  <button
                    type="submit"
                    disabled={unlocking || checking || !password}
                    className="w-full bg-accent hover:bg-accent-hover text-on-accent rounded-xl py-2.5 text-sm font-semibold transition-colors disabled:bg-fill disabled:text-secondary disabled:cursor-not-allowed"
                  >
                    {unlocking ? 'Unlocking…' : 'Unlock'}
                  </button>
                </form>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
