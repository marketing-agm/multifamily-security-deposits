'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/context/SessionContext';
import { useTheme } from '@/context/ThemeContext';
import { calcTotalCharges, calcTotalCredits, calcBalance, formatCurrency } from '@/lib/calculations';
import { fillAGMCheckoutPDF } from '@/lib/pdfFiller';
import { FIELD_MAP } from '@/lib/fieldMap';

// Total fields in the PDF template — used for the "X/Y fields populated" badge.
const TOTAL_FIELDS = Object.keys(FIELD_MAP).length;

interface Props {
  returnId: string;
}

export function ReviewScreen({ returnId }: Props) {
  const { session, updateReturn } = useSession();
  const { theme, toggle } = useTheme();
  const router = useRouter();

  const [complianceChecked, setComplianceChecked] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [pdfReady, setPdfReady] = useState(false);
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  // How many PDF fields were populated (returned by fillAGMCheckoutPDF)
  const [fieldsPopulated, setFieldsPopulated] = useState<number | null>(null);
  const [pdfObjectUrl, setPdfObjectUrl] = useState<string | null>(null);

  const tenantReturn = session?.returns.find(r => r.id === returnId);

  useEffect(() => {
    if (!session) router.replace('/');
  }, [session, router]);

  // Auto-generate the PDF when the page mounts so it's ready to preview/download.
  useEffect(() => {
    if (!tenantReturn || !session || pdfReady) return;
    let cancelled = false;
    setGenerating(true);
    (async () => {
      try {
        const templateRes = await fetch('/AGM_template.pdf');
        if (!templateRes.ok) throw new Error('PDF template not found.');
        const templateBytes = await templateRes.arrayBuffer();
        const { filled, populated } = await fillAGMCheckoutPDF(
          templateBytes, tenantReturn, session.propertyName, session.propertyConfig,
        );
        if (!cancelled) {
          setPdfBytes(filled);
          setFieldsPopulated(populated ?? null);
          // Create a blob URL so Preview can open it in a new tab.
          const blob = new Blob([filled.buffer as ArrayBuffer], { type: 'application/pdf' });
          setPdfObjectUrl(URL.createObjectURL(blob));
          setPdfReady(true);
        }
      } catch (_err) {
        // Silent — the error surfaces when the user tries to download.
      } finally {
        if (!cancelled) setGenerating(false);
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [returnId]);

  if (!tenantReturn || !session) return null;

  const { tenantData, depositData } = tenantReturn;
  const totalCharges = calcTotalCharges(tenantReturn);
  const totalCredits = calcTotalCredits(tenantReturn);
  const balance = calcBalance(tenantReturn);

  // California Civil Code §1950.5 — 21-day deadline from move-out date.
  const deadlineDate = tenantData.moveOutDate
    ? (() => {
        const d = new Date(tenantData.moveOutDate + 'T00:00:00');
        d.setDate(d.getDate() + 21);
        return d;
      })()
    : null;
  const daysUntilDeadline = deadlineDate
    ? Math.ceil((deadlineDate.getTime() - Date.now()) / 86_400_000)
    : null;

  // Property address for the FROM block.
  const propertyAddress = session.propertyConfig?.address ?? '';

  // Forwarding address for the MAIL TO block.
  const { street, city, state, zip } = tenantData.forwardingAddress;
  const forwardingLine2 = [city, state, zip].filter(Boolean).join(', ');

  // PDF filename.
  const pdfFilename = `AGM_Checkout_${tenantData.unit}_${tenantData.tenantName.replace(/\s+/g, '_')}.pdf`;

  function handleDownload() {
    if (!pdfBytes) return;
    const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = pdfFilename;
    a.click();
    URL.revokeObjectURL(url);
    updateReturn(returnId, { processingStatus: 'complete', complianceChecked: true, pdfGenerated: true });
  }

  function handlePreview() {
    if (!pdfObjectUrl) return;
    window.open(pdfObjectUrl, '_blank');
  }

  // Deadline banner color: red < 3 days, yellow 3–7, green > 7.
  const deadlineBannerClass =
    daysUntilDeadline === null
      ? 'bg-fill border-separator text-secondary'
      : daysUntilDeadline <= 3
      ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400'
      : daysUntilDeadline <= 7
      ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-300'
      : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-400';

  return (
    <div className="min-h-screen bg-bg flex flex-col">

      {/* ── Header ─────────────────────────────────────────────────────────────── */}
      <div className="bg-surface border-b border-separator px-6 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push(`/return/${returnId}`)}
            className="text-sm text-secondary hover:text-app-text transition-colors shrink-0"
          >
            ← Edit form
          </button>
          <span className="text-separator select-none">|</span>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-semibold text-app-text truncate">
              Review &amp; Download — {tenantData.tenantName} · Unit {tenantData.unit}
            </h1>
            <p className="text-xs text-secondary mt-0.5">
              All sections complete · Ready for compliance check
            </p>
          </div>
          <button
            onClick={toggle}
            className="w-8 h-8 rounded-full bg-fill flex items-center justify-center text-sm hover:bg-fill transition-colors shrink-0"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>
      </div>

      <div className="flex-1 px-6 py-6 max-w-3xl mx-auto w-full space-y-5">

        {/* ── California §1950.5 deadline banner ─────────────────────────────── */}
        <div className={`rounded-2xl border px-5 py-4 ${deadlineBannerClass}`}>
          <div className="flex items-start gap-3">
            <span className="text-lg shrink-0">⚖️</span>
            <div>
              <p className="text-sm font-semibold">
                California Civil Code §1950.5 — 21-Day Deadline
              </p>
              {deadlineDate ? (
                <p className="text-sm mt-0.5">
                  Deposit return must be postmarked by{' '}
                  <strong>
                    {deadlineDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </strong>
                  {daysUntilDeadline !== null && (
                    <> —{' '}
                      {daysUntilDeadline > 0
                        ? `${daysUntilDeadline} day${daysUntilDeadline === 1 ? '' : 's'} remaining`
                        : daysUntilDeadline === 0
                        ? 'due today'
                        : `${Math.abs(daysUntilDeadline)} day${Math.abs(daysUntilDeadline) === 1 ? '' : 's'} overdue`}
                    </>
                  )}
                </p>
              ) : (
                <p className="text-sm mt-0.5">Enter a move-out date to see the deadline.</p>
              )}
            </div>
          </div>
        </div>

        {/* ── FROM / MAIL TO address blocks ──────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-4">
          {/* FROM */}
          <div className="bg-surface rounded-2xl border border-separator p-5">
            <p className="text-xs font-semibold text-secondary uppercase tracking-wider mb-3">From</p>
            <p className="text-sm font-semibold text-app-text">AGM Real Estate Group</p>
            {session.propertyName && (
              <p className="text-sm text-app-text mt-0.5">{session.propertyName}</p>
            )}
            {propertyAddress && (
              <p className="text-sm text-secondary mt-0.5">{propertyAddress}</p>
            )}
          </div>

          {/* MAIL TO */}
          <div className="bg-surface rounded-2xl border border-separator p-5">
            <p className="text-xs font-semibold text-secondary uppercase tracking-wider mb-3">Mail To</p>
            <p className="text-sm font-semibold text-app-text">{tenantData.tenantName}</p>
            {tenantData.coTenant && (
              <p className="text-sm text-app-text">{tenantData.coTenant}</p>
            )}
            {street ? (
              <>
                <p className="text-sm text-secondary mt-0.5">{street}</p>
                {forwardingLine2 && <p className="text-sm text-secondary">{forwardingLine2}</p>}
              </>
            ) : (
              <p className="text-sm text-red-500 dark:text-red-400 mt-0.5 italic">
                No forwarding address — go back to add one.
              </p>
            )}
          </div>
        </div>

        {/* ── PDF card ───────────────────────────────────────────────────────── */}
        <div className="bg-surface rounded-2xl border border-separator p-5">
          <p className="text-xs font-semibold text-secondary uppercase tracking-wider mb-4">AGM Checkout Report PDF</p>

          <div className="flex items-start gap-4">
            {/* PDF icon */}
            <div className="w-12 h-14 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex flex-col items-center justify-center shrink-0 gap-0.5">
              <span className="text-lg">📄</span>
              <span className="text-[9px] font-bold text-red-600 dark:text-red-400 uppercase tracking-wide">PDF</span>
            </div>

            {/* Filename + status */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-app-text truncate">{pdfFilename}</p>
              {generating && (
                <p className="text-xs text-secondary mt-1">Generating…</p>
              )}
              {pdfReady && fieldsPopulated !== null && (
                <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                  ✓ {fieldsPopulated}/{TOTAL_FIELDS} fields populated
                </p>
              )}
              {pdfReady && !generating && (
                <p className="text-xs text-secondary mt-0.5">Ready to download</p>
              )}
              {/* Balance warning in PDF card */}
              {balance < 0 && (
                <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                  ⚠ Balance owing landlord — confirm charges before sending
                </p>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex flex-col gap-2 shrink-0">
              <button
                onClick={handlePreview}
                disabled={!pdfReady}
                className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline disabled:text-secondary disabled:no-underline disabled:cursor-not-allowed transition-colors"
              >
                Preview form
              </button>
              <button
                onClick={handleDownload}
                disabled={!pdfReady || !complianceChecked}
                className="text-xs font-semibold bg-accent hover:bg-accent-hover text-on-accent px-3 py-1.5 rounded-lg disabled:bg-fill disabled:text-secondary disabled:cursor-not-allowed transition-colors"
              >
                ↓ Download
              </button>
            </div>
          </div>
        </div>

        {/* ── Balance summary ─────────────────────────────────────────────────── */}
        <div className={`rounded-2xl border p-5 ${
          balance === 0
            ? 'bg-fill border-separator'
            : balance > 0
            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
            : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
        }`}>
          <div className="flex justify-between items-center">
            <div>
              <p className={`text-sm font-semibold ${
                balance === 0 ? 'text-secondary'
                : balance > 0 ? 'text-green-800 dark:text-green-400'
                : 'text-red-800 dark:text-red-400'
              }`}>
                {balance === 0 ? 'No balance due' : balance > 0 ? 'Return to tenant' : 'Balance owing landlord'}
              </p>
              <p className="text-xs text-secondary mt-0.5">
                {formatCurrency(totalCredits)} deposits − {formatCurrency(totalCharges)} charges
              </p>
            </div>
            <span className={`text-2xl font-bold tabular-nums ${
              balance === 0 ? 'text-secondary'
              : balance > 0 ? 'text-green-800 dark:text-green-400'
              : 'text-red-800 dark:text-red-400'
            }`}>
              {formatCurrency(Math.abs(balance))}
            </span>
          </div>
        </div>

        {/* ── Compliance checkbox ─────────────────────────────────────────────── */}
        <div className="bg-surface rounded-2xl border border-separator p-5">
          <p className="text-xs font-semibold text-secondary uppercase tracking-wider mb-3">Compliance Check</p>
          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={complianceChecked}
              onChange={e => setComplianceChecked(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-gray-300 accent-blue-600"
            />
            <span className="text-sm text-app-text">
              I confirm all charges reflect company-approved rates and this return complies with
              California Civil Code §1950.5 — it will be postmarked within 21 days of move-out.
            </span>
          </label>
        </div>

        {/* ── Final download button ───────────────────────────────────────────── */}
        <button
          onClick={handleDownload}
          disabled={!pdfReady || !complianceChecked}
          className="w-full bg-accent hover:bg-accent-hover disabled:bg-fill disabled:text-secondary disabled:cursor-not-allowed text-on-accent font-semibold py-3.5 rounded-2xl transition-colors text-sm"
        >
          {generating
            ? 'Generating PDF…'
            : !pdfReady
            ? 'Preparing PDF…'
            : !complianceChecked
            ? 'Check compliance box to download'
            : '↓ Download AGM Checkout Report'}
        </button>

        <button
          onClick={() => router.push('/dashboard')}
          className="w-full border border-separator text-secondary hover:text-app-text font-medium py-2.5 rounded-2xl hover:bg-fill transition-colors text-sm"
        >
          ← Back to Dashboard
        </button>
      </div>
    </div>
  );
}
