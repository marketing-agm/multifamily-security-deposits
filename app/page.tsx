'use client';

// app/page.tsx — Screen 1: Upload + current move-outs queue
// This is the first page you see. It has two parts:
//   1. The upload zone (drag & drop an Excel file from AppFolio)
//   2. A queue table showing all tenants from the last upload (if any)
//
// Think of this like the "home screen" of the app.

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/context/SessionContext';
import { parseAppFolioExport, ParseError } from '@/lib/parser';
import { DUMMY_SESSION } from '@/lib/dummyData';
import { TenantReturn } from '@/types';
import { formatCurrency } from '@/lib/calculations';
import { formatDeadlineDate } from '@/lib/deadlineUtils';

// --- Small inline components for the queue table ---

// UtilityPill: shows whether the tenant uses RUBS or Flat fee billing.
// RUBS = Ratio Utility Billing System (tenant pays a share of the building's water bill).
function UtilityPill({ type }: { type: TenantReturn['utilityData']['utilityType'] }) {
  if (type === 'RUBS') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#e6efff] text-[#1858b8] border border-[#2383e2]/25">
        RUBS
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#e3f5e6] text-[#1a7a3a] border border-[#1a7a3a]/25">
      Flat fee
    </span>
  );
}

// InspectionPill: shows whether the move-in inspection was signed or is missing.
// Missing inspection is a risk — it weakens the landlord's case for damage charges.
function InspectionPill({ status }: { status: TenantReturn['tenantData']['inspectionStatus'] }) {
  if (status === 'signed') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#e3f5e6] text-[#1a7a3a] border border-[#1a7a3a]/25">
        ✓ Signed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#fceae8] text-[#b3261e] border border-[#b3261e]/25">
      ⚠ Missing
    </span>
  );
}

// StatusPill: shows processing state of each return.
function StatusPill({ status }: { status: TenantReturn['processingStatus'] }) {
  if (status === 'complete') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#e3f5e6] text-[#1a7a3a]">
        Complete
      </span>
    );
  }
  if (status === 'in_progress') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#fdf3da] text-[#8b6a00]">
        In progress
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#f1f1ef] text-[#6b6b6a] border border-[#e8e7e4]">
      Not started
    </span>
  );
}

export default function UploadPage() {
  // useSession() is like getting the app's shared "state" — the list of tenant returns.
  // In React, session state is stored in a Context (similar to a global variable in Java).
  const { session, setSession } = useSession();
  const router = useRouter();

  // Local state — only relevant to this one page.
  const [dragging, setDragging] = useState(false);    // true while user drags a file over the drop zone
  const [errors, setErrors] = useState<ParseError[]>([]);  // parse errors from the Excel file
  const [loading, setLoading] = useState(false);       // true while parsing the file

  // A ref is like a pointer to a DOM element — lets us click the hidden file input programmatically.
  const fileRef = useRef<HTMLInputElement>(null);

  // If a session already exists with tenants, show the "Resume session" button.
  const hasSession = session && session.returns.length > 0;

  // handleFile: called whenever the user picks or drops an Excel file.
  async function handleFile(file: File) {
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      setErrors([{ message: 'Please upload an Excel file (.xlsx or .xls).' }]);
      return;
    }
    setLoading(true);
    setErrors([]);
    try {
      // arrayBuffer() reads the file as raw bytes — needed by our Excel parser.
      const buffer = await file.arrayBuffer();
      const result = parseAppFolioExport(buffer);
      if (result.errors.length > 0 && result.returns.length === 0) {
        setErrors(result.errors);
        return;
      }
      setSession({
        propertyName: result.propertyName || file.name.replace(/\.xlsx?$/, ''),
        uploadDate: new Date().toLocaleDateString('en-US'),
        returns: result.returns,
      });
      if (result.errors.length > 0) setErrors(result.errors); // non-fatal warnings
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
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  return (
    <div className="min-h-screen bg-[#fbfbfa] flex flex-col">

      {/* ── Top nav bar ── */}
      <header className="bg-white border-b border-[#e8e7e4] px-6 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1
              className="text-[15px] font-semibold text-[#1a1a19]"
              style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}
            >
              AGM Security Deposit Return Tool
            </h1>
            <p className="text-[11px] text-[#9b9b99] mt-0.5">AGM Real Estate Group</p>
          </div>
          {/* Resume session link — only visible when a previous session exists */}
          {hasSession && (
            <button
              onClick={() => router.push('/dashboard')}
              className="text-sm text-[#2383e2] hover:underline font-medium"
            >
              Resume session ({session.returns.length} tenant{session.returns.length !== 1 ? 's' : ''}) →
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 px-6 py-10">
        <div className="max-w-4xl mx-auto space-y-5">

          {/* ── Upload header ── */}
          <div>
            <h2
              className="text-[22px] font-semibold text-[#1a1a19] mb-1"
              style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}
            >
              Upload AppFolio Export
            </h2>
            <p className="text-[13px] text-[#6b6b6a] max-w-xl leading-relaxed">
              Export your AppFolio move-out report to Excel and upload it here. All move-outs in the file will be loaded at once.
            </p>
          </div>

          {/* ── Drop zone ── */}
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
            className={`border-[1.5px] border-dashed rounded-[8px] p-10 text-center cursor-pointer transition-colors ${
              dragging
                ? 'border-[#2383e2] bg-[#e6efff]'
                : 'border-[#d4d3d0] hover:border-[#2383e2] hover:bg-[#f7f6f3]'
            }`}
          >
            <div className="text-3xl mb-3 text-[#9b9b99]">📂</div>
            <p className="text-[14px] font-medium text-[#1a1a19]">Drop your .xlsx file here</p>
            <p className="text-[12px] text-[#9b9b99] mt-1">or click to browse</p>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={onFileChange} className="hidden" />
          </div>

          {loading && (
            <div className="text-center text-sm text-[#2383e2] font-medium animate-pulse">
              Parsing file…
            </div>
          )}

          {/* ── Demo data banner ── */}
          <div className="bg-[#fdf3da] border border-[#e8c840]/40 rounded-[6px] px-4 py-3 flex items-center justify-between gap-4">
            <p className="text-[12px] text-[#8b6a00]">
              <span className="font-semibold">No Excel file?</span> Load 3 sample tenants to explore the tool.
            </p>
            <button
              onClick={() => { setSession(DUMMY_SESSION); router.push('/dashboard'); }}
              className="shrink-0 text-[12px] font-semibold text-[#8b6a00] bg-[#fdf3da] hover:bg-[#f9e8b0] border border-[#8b6a00]/30 rounded-[6px] px-3 py-1.5 transition-colors"
            >
              Load demo data
            </button>
          </div>

          {/* ── Parse errors ── */}
          {errors.length > 0 && (
            <div className="bg-[#fceae8] border border-[#b3261e]/20 rounded-[6px] p-4 space-y-1">
              {errors.map((e, i) => (
                <p key={i} className="text-sm text-[#b3261e]">
                  {e.sheet ? <span className="font-medium">[{e.sheet}]</span> : null} {e.message}
                </p>
              ))}
            </div>
          )}

          {/* ── AppFolio export instructions ── */}
          <div className="border-t border-[#e8e7e4] pt-5">
            <p className="text-[10px] font-semibold text-[#9b9b99] uppercase tracking-[0.06em] mb-2.5">
              What to export from AppFolio
            </p>
            <p className="text-[12px] text-[#9b9b99] mb-3">
              See <code className="bg-[#f7f6f3] px-1 rounded border border-[#e8e7e4] text-[#1a1a19] text-[11px]">docs/appfolio-export-spec.md</code> for the exact report and column structure required.
            </p>
            <div className="flex flex-col gap-2">
              {[
                'Run the Move-Out report in AppFolio for the target property',
                'Export to Excel (.xlsx)',
                'Ensure the file contains all 4 required sheets: Tenant & Lease, Deposits & Fees, Utility, Ledger',
                'Upload the file above — all move-outs will populate automatically',
              ].map((step, i) => (
                <div key={i} className="flex items-start gap-2.5 text-[13px] text-[#6b6b6a]">
                  {/* Numbered circle — like step indicators in onboarding flows */}
                  <div className="w-5 h-5 rounded-full bg-[#f1f1ef] border border-[#e8e7e4] flex items-center justify-center text-[11px] text-[#9b9b99] shrink-0 mt-px">
                    {i + 1}
                  </div>
                  <span>{step}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Current move-outs queue (only shown when a session exists) ── */}
          {hasSession && (
            <div>
              {/* Divider */}
              <div className="border-t border-[#e8e7e4] my-2" />

              {/* Queue header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-semibold text-[#1a1a19]">Current move-outs</span>
                  <span className="text-[11px] text-[#9b9b99]">— from last upload</span>
                </div>
                {/* Pending count badge */}
                {(() => {
                  const pending = session.returns.filter(r => r.processingStatus !== 'complete').length;
                  return pending > 0 ? (
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#fdf3da] text-[#8b6a00] border border-[#e8c840]/40">
                      {pending} pending
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#e3f5e6] text-[#1a7a3a] border border-[#1a7a3a]/25">
                      All complete
                    </span>
                  );
                })()}
              </div>

              {/* Queue table */}
              <div className="border border-[#e8e7e4] rounded-[6px] overflow-hidden">
                {/* Table header row */}
                <div className="grid grid-cols-[2fr_0.9fr_0.7fr_0.7fr_0.9fr] px-4 py-2 border-b border-[#e8e7e4] bg-[#f7f6f3]">
                  {['Tenant / unit', 'Move-out', 'Utility', 'Inspection', 'Action'].map(h => (
                    <span key={h} className="text-[11px] font-semibold text-[#9b9b99] uppercase tracking-[0.04em]">{h}</span>
                  ))}
                </div>

                {/* One row per tenant */}
                {session.returns.map((r, idx) => (
                  <div
                    key={r.id}
                    className={`grid grid-cols-[2fr_0.9fr_0.7fr_0.7fr_0.9fr] px-4 py-3 items-center hover:bg-[#f7f6f3] cursor-pointer transition-colors ${
                      idx < session.returns.length - 1 ? 'border-b border-[#eeeeec]' : ''
                    }`}
                    onClick={() => router.push(`/return/${r.id}`)}
                  >
                    {/* Tenant name + unit + deposit */}
                    <div>
                      <div className="text-[13px] font-semibold text-[#1a1a19]">{r.tenantData.tenantName}</div>
                      <div className="text-[11px] text-[#9b9b99] mt-0.5">
                        Unit {r.tenantData.unit} · {formatCurrency(r.depositData.securityDeposit)} deposit
                      </div>
                    </div>
                    {/* Move-out date */}
                    <span className="text-[12px] text-[#6b6b6a]">{r.tenantData.moveOutDate}</span>
                    {/* Utility type pill */}
                    <UtilityPill type={r.utilityData.utilityType} />
                    {/* Inspection status pill */}
                    <InspectionPill status={r.tenantData.inspectionStatus} />
                    {/* Status + action button */}
                    <div className="flex items-center gap-2">
                      <StatusPill status={r.processingStatus} />
                      <button
                        onClick={e => { e.stopPropagation(); router.push(`/return/${r.id}`); }}
                        className={`text-[11px] px-2.5 py-1 rounded-[4px] border transition-colors ${
                          r.processingStatus === 'in_progress'
                            ? 'bg-[#e6efff] border-[#2383e2]/40 text-[#1858b8] font-medium'
                            : 'bg-white border-[#e8e7e4] text-[#6b6b6a] hover:bg-[#f7f6f3]'
                        }`}
                      >
                        {r.processingStatus === 'complete' ? 'View' : 'Open'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
