'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/context/SessionContext';
import { useTheme } from '@/context/ThemeContext';
import { calcTotalCharges, calcTotalCredits, calcBalance, formatCurrency } from '@/lib/calculations';
import { fillAGMCheckoutPDF } from '@/lib/pdfFiller';
import { FIELD_MAP } from '@/lib/fieldMap';
import { computeDeadline, daysUntilDeadline as daysUntil, DEADLINE_LAW_REF, DEPOSIT_RETURN_DAYS } from '@/lib/deadline';
import { Sun, Moon, ArrowLeft, CalendarClock, FileText, CheckCircle2, AlertTriangle, Download, Eye, ShieldCheck, Building2, Send, LayoutDashboard } from 'lucide-react';

// AGM's mailing address for the FROM block on the checkout report.
const AGM_ADDRESS = '12330 Northup Way, Bellevue, WA 98005';

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
          templateBytes,
          tenantReturn,
          tenantReturn.propertyName ?? session.propertyName,
          tenantReturn.propertyConfig ?? session.propertyConfig,
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

  // Washington RCW 59.18.280 — 30-day deadline from move-out date.
  const deadlineDate = computeDeadline(tenantData.moveOutDate);
  const daysUntilDeadline = daysUntil(deadlineDate);

  // This tenant's property (an upload can span several) — used for the FROM block.
  const propertyName = tenantReturn.propertyName ?? session.propertyName;
  const propertyAddress = (tenantReturn.propertyConfig ?? session.propertyConfig)?.address ?? '';

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
      ? 'bg-danger/10 border-danger/30 text-danger-fg'
      : daysUntilDeadline <= 7
      ? 'bg-warning/10 border-warning/30 text-warning-fg'
      : 'bg-success/10 border-success/30 text-success-fg';

  return (
    <div className="min-h-screen bg-bg flex flex-col">

      {/* ── Header ─────────────────────────────────────────────────────────────── */}
      <div className="bg-surface border-b border-separator px-6 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push(`/return/${returnId}`)}
            className="inline-flex items-center gap-1.5 text-sm text-secondary hover:text-app-text transition-colors shrink-0"
          >
            <ArrowLeft size={15} /> Edit form
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
            className="w-9 h-9 rounded-lg bg-fill flex items-center justify-center text-secondary hover:text-app-text hover:brightness-95 dark:hover:brightness-110 transition-colors shrink-0"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          </button>
        </div>
      </div>

      <div className="flex-1 px-6 py-6 max-w-3xl mx-auto w-full space-y-5">

        {/* ── Washington RCW 59.18.280 deadline banner ───────────────────────── */}
        {/* Days-left is the focal point (big number block on the right), per spec. */}
        <div className={`rounded-2xl border px-5 py-4 ${deadlineBannerClass}`}>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider">
                <CalendarClock size={15} />
                {DEADLINE_LAW_REF} — {DEPOSIT_RETURN_DAYS}-Day Deadline
              </p>
              {deadlineDate ? (
                <p className="text-sm mt-1">
                  Deposit return must be postmarked by{' '}
                  <strong>
                    {deadlineDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </strong>
                  . Mail the itemized statement and any refund check to the forwarding address below.
                </p>
              ) : (
                <p className="text-sm mt-1">Enter a move-out date to see the deadline.</p>
              )}
            </div>
            {daysUntilDeadline !== null && (
              <div className="shrink-0 text-center rounded-xl border border-current/25 px-4 py-2 min-w-[92px]">
                <div className="text-3xl font-bold leading-none tabular-nums">
                  {Math.abs(daysUntilDeadline)}
                </div>
                <div className="text-[11px] font-medium uppercase tracking-wide mt-1">
                  {daysUntilDeadline > 0 ? 'days left' : daysUntilDeadline === 0 ? 'due today' : 'days overdue'}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── FROM / MAIL TO address blocks ──────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-4">
          {/* FROM */}
          <div className="bg-surface rounded-2xl border border-separator p-5 shadow-card">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-secondary uppercase tracking-wider mb-3"><Building2 size={14} className="text-accent" />From</p>
            <p className="text-sm font-semibold text-app-text">AGM Real Estate Group</p>
            <p className="text-sm text-secondary mt-0.5">{AGM_ADDRESS}</p>
            {propertyName && (
              <p className="text-sm text-app-text mt-1">{propertyName}</p>
            )}
            {propertyAddress && (
              <p className="text-sm text-secondary mt-0.5">{propertyAddress}</p>
            )}
          </div>

          {/* MAIL TO */}
          <div className="bg-surface rounded-2xl border border-separator p-5 shadow-card">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-secondary uppercase tracking-wider mb-3"><Send size={14} className="text-accent" />Mail To</p>
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
              <p className="text-sm text-danger-fg mt-0.5 italic">
                No forwarding address — go back to add one.
              </p>
            )}
          </div>
        </div>

        {/* ── PDF card ───────────────────────────────────────────────────────── */}
        <div className="bg-surface rounded-2xl border border-separator p-5 shadow-card">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-secondary uppercase tracking-wider mb-4"><FileText size={14} className="text-accent" />AGM Checkout Report PDF</p>

          <div className="flex items-start gap-4">
            {/* PDF icon */}
            <div className="w-12 h-14 bg-accent/10 border border-accent/20 rounded-xl flex flex-col items-center justify-center shrink-0 gap-0.5 text-accent">
              <FileText size={20} />
              <span className="text-[9px] font-bold uppercase tracking-wide">PDF</span>
            </div>

            {/* Filename + status */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-app-text truncate">{pdfFilename}</p>
              {generating && (
                <p className="text-xs text-secondary mt-1">Generating…</p>
              )}
              {pdfReady && fieldsPopulated !== null && (
                <p className="flex items-center gap-1 text-xs text-success-fg mt-1">
                  <CheckCircle2 size={13} /> {fieldsPopulated}/{TOTAL_FIELDS} fields populated
                </p>
              )}
              {pdfReady && !generating && (
                <p className="text-xs text-secondary mt-0.5">Ready to download</p>
              )}
              {/* Balance warning in PDF card */}
              {balance < 0 && (
                <p className="flex items-center gap-1 text-xs text-warning-fg mt-1">
                  <AlertTriangle size={13} /> Balance owing landlord — confirm charges before sending
                </p>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex flex-col gap-2 shrink-0">
              <button
                onClick={handlePreview}
                disabled={!pdfReady}
                className="inline-flex items-center justify-center gap-1 text-xs font-medium text-accent hover:underline disabled:text-secondary disabled:no-underline disabled:cursor-not-allowed transition-colors"
              >
                <Eye size={13} /> Preview form
              </button>
              <button
                onClick={handleDownload}
                disabled={!pdfReady || !complianceChecked}
                className="inline-flex items-center justify-center gap-1 text-xs font-semibold bg-accent hover:bg-accent-hover text-on-accent px-3 py-1.5 rounded-lg disabled:bg-fill disabled:text-secondary disabled:cursor-not-allowed transition-colors"
              >
                <Download size={13} /> Download
              </button>
            </div>
          </div>
        </div>

        {/* ── Balance summary ─────────────────────────────────────────────────── */}
        <div className={`rounded-2xl border p-5 ${
          balance === 0
            ? 'bg-fill border-separator'
            : balance > 0
            ? 'bg-success/10 border-success/30'
            : 'bg-danger/10 border-danger/30'
        }`}>
          <div className="flex justify-between items-center">
            <div>
              <p className={`text-sm font-semibold ${
                balance === 0 ? 'text-secondary'
                : balance > 0 ? 'text-success-fg'
                : 'text-danger-fg'
              }`}>
                {balance === 0 ? 'No balance due' : balance > 0 ? 'Return to tenant' : 'Balance owing landlord'}
              </p>
              <p className="text-xs text-secondary mt-0.5">
                {formatCurrency(totalCredits)} deposits − {formatCurrency(totalCharges)} charges
              </p>
            </div>
            <span className={`text-2xl font-bold tabular-nums ${
              balance === 0 ? 'text-secondary'
              : balance > 0 ? 'text-success-fg'
              : 'text-danger-fg'
            }`}>
              {formatCurrency(Math.abs(balance))}
            </span>
          </div>
        </div>

        {/* ── Compliance checkbox ─────────────────────────────────────────────── */}
        <div className="bg-surface rounded-2xl border border-separator p-5">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-secondary uppercase tracking-wider mb-3"><ShieldCheck size={14} className="text-accent" />Compliance Check</p>
          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={complianceChecked}
              onChange={e => setComplianceChecked(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-separator accent-accent"
            />
            <span className="text-sm text-app-text">
              I confirm all charges reflect company-approved rates and this return complies with
              {' '}{DEADLINE_LAW_REF} — it will be postmarked within {DEPOSIT_RETURN_DAYS} days of move-out.
            </span>
          </label>
        </div>

        {/* ── Final download button ───────────────────────────────────────────── */}
        <button
          onClick={handleDownload}
          disabled={!pdfReady || !complianceChecked}
          className="w-full inline-flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover disabled:bg-fill disabled:text-secondary disabled:cursor-not-allowed text-on-accent font-semibold py-3.5 rounded-2xl transition-colors text-sm"
        >
          {generating
            ? 'Generating PDF…'
            : !pdfReady
            ? 'Preparing PDF…'
            : !complianceChecked
            ? 'Check compliance box to download'
            : <><Download size={16} /> Download AGM Checkout Report</>}
        </button>

        {/* Back navigation — return to the form/calculations or the dashboard. */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => router.push(`/return/${returnId}`)}
            className="w-full inline-flex items-center justify-center gap-1.5 border border-separator text-secondary hover:text-app-text font-medium py-2.5 rounded-2xl hover:bg-fill transition-colors text-sm"
          >
            <ArrowLeft size={15} /> Back to form
          </button>
          <button
            onClick={() => router.push('/dashboard')}
            className="w-full inline-flex items-center justify-center gap-1.5 border border-separator text-secondary hover:text-app-text font-medium py-2.5 rounded-2xl hover:bg-fill transition-colors text-sm"
          >
            <LayoutDashboard size={15} /> Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
