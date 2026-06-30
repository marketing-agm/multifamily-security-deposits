// components/AgentForm/index.tsx
// Return form — two-column layout.
//
// Layout (left to right):
//   [200px vertical progress steps] | [flex-1 checkout form (60%)]
//
// The LEFT panel is a vertical ordered progress list — each step corresponds
// to a section of the AGM Checkout Report on the right. Clicking a step shows
// context info relevant to that form section. Steps auto-select as the form fills.
//
//   1. Property & Tenant  — name, unit, address, inspection status, lease dates
//   2. Utility & Rates    — RUBS or flat fee details, deposit amounts, NRC
//   3. Turnover Charges   — cleaning, carpet, painting, other charge inputs
//   4. Notes              — freeform case notes
//
// The RIGHT panel is ALWAYS the AGM Checkout Report form.
// Fields are auto-filled from AppFolio data and can be manually edited.

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/context/SessionContext';
import { formatCurrency } from '@/lib/calculations';
import { TenantReturn } from '@/types';

// Simpler 4-step progress bar: Upload → Form → Review → Download
const TOP_STEPS = ['1. Upload', '2. Form', '3. Review', '4. Download'];
const CURRENT_TOP_STEP = 1; // zero-indexed — "Form" is index 1
const TOTAL_FIELDS = 72;

type FormSection = 'tenant' | 'utility' | 'charges' | 'notes';

// Each step in the vertical sidebar progress list
const FORM_SECTIONS: { key: FormSection; number: number; title: string; subtitle: string }[] = [
  { key: 'tenant',  number: 1, title: 'Property & Tenant',   subtitle: 'Name, unit, lease dates' },
  { key: 'utility', number: 2, title: 'Utility & Rates',     subtitle: 'RUBS or flat fee billing' },
  { key: 'charges', number: 3, title: 'Turnover Charges',    subtitle: 'Cleaning, carpet, other' },
  { key: 'notes',   number: 4, title: 'Notes',               subtitle: 'Case notes & reminders' },
];

interface Props {
  returnId: string;
}

// ============================================================
// InfoRow — label + value pair inside a card
// ============================================================
function InfoRow({ label, value, highlight }: { label: string; value: string; highlight?: 'red' | 'amber' }) {
  return (
    <div className="flex justify-between px-3 py-2 border-b border-[#e8e7e4] last:border-b-0">
      <span className="text-[11px] text-[#9b9b99]">{label}</span>
      <span className={`text-[11px] font-medium text-right max-w-[55%] ${
        highlight === 'red' ? 'text-[#b3261e] font-semibold' :
        highlight === 'amber' ? 'text-[#8b6a00] font-semibold' :
        'text-[#1a1a19]'
      }`}>{value}</span>
    </div>
  );
}

// ============================================================
// FormDisplayField — editable input, pre-filled from tenant data.
// White background = editable. onChange is optional; without it the field is read-only.
// ============================================================
function FormDisplayField({ label, value, onChange }: { label: string; value: string; onChange?: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-0.5">
      <label className="text-[9px] font-medium text-[#9b9b99] uppercase tracking-[0.04em]">{label}</label>
      <input
        type="text"
        value={value}
        onChange={e => onChange?.(e.target.value)}
        readOnly={!onChange}
        className="h-[26px] text-[11px] px-2 rounded-[4px] border border-[#e8e7e4] focus:outline-none focus:border-[#2383e2] transition-colors"
        style={{ background: onChange ? '#fff' : '#f7f6f3', color: onChange ? '#1a1a19' : '#6b6b6a' }}
      />
    </div>
  );
}

// ============================================================
// ChargeInput — editable dollar amount for manual charges.
// Turns amber when a non-zero value is entered.
// ============================================================
function ChargeInput({ label, value, onChange, note }: {
  label: string; value: number; onChange: (v: number) => void; note?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <label className="text-[10px] text-[#9b9b99]">
        {label}
        {note && <span className="block text-[9px] text-[#9b9b99]">{note}</span>}
      </label>
      <input
        type="number"
        min={0}
        step={0.01}
        value={value || ''}
        placeholder="0"
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
        className={`h-8 text-sm px-2 rounded-[4px] border w-full ${
          value > 0
            ? 'bg-[#fdf3da] border-[#8b6a00] text-[#8b6a00]'
            : 'bg-white border-[#e8e7e4] text-[#1a1a19]'
        }`}
      />
    </div>
  );
}

export function AgentForm({ returnId }: Props) {
  const { session, updateReturn } = useSession();
  const router = useRouter();

  const [activeSection, setActiveSection] = useState<FormSection>('tenant');
  const [notes, setNotes] = useState('');
  // formOverrides: user edits to auto-filled fields (stored per session, not persisted)
  const [formOverrides, setFormOverrides] = useState<Record<string, string>>({});

  function fieldVal(key: string, defaultVal: string): string {
    return key in formOverrides ? formOverrides[key] : defaultVal;
  }
  function setField(key: string, val: string) {
    setFormOverrides(prev => ({ ...prev, [key]: val }));
  }

  const trMaybe = session?.returns.find(r => r.id === returnId);
  if (!session || !trMaybe) {
    router.replace('/dashboard');
    return null;
  }
  const tr: TenantReturn = trMaybe;
  const { tenantData, depositData, utilityData, calculatedCharges, manualCharges } = tr;

  const nrcOffset = Math.min(manualCharges.generalCleaning, depositData.nrcCleaningFee);
  const tenantCleaning = Math.max(0, manualCharges.generalCleaning - nrcOffset);
  const totalCredits = depositData.securityDeposit + depositData.petDeposit + depositData.keyDeposit;
  const totalCharges =
    calculatedCharges.rentDue +
    calculatedCharges.utilityCharge +
    tenantCleaning +
    manualCharges.carpetShampooing +
    manualCharges.painting +
    manualCharges.other1 +
    manualCharges.other2 +
    manualCharges.legalCourtCosts;
  const balance = totalCredits - totalCharges;
  const fwdAddr = `${tenantData.forwardingAddress.street}, ${tenantData.forwardingAddress.city} ${tenantData.forwardingAddress.state} ${tenantData.forwardingAddress.zip}`;
  const dailyRate = tenantData.monthlyRent / 30;

  // Count how many form sections have data — drives the "completed" state on each step
  const sectionDone: Record<FormSection, boolean> = {
    tenant: true, // always pre-filled from AppFolio
    utility: calculatedCharges.utilityCharge > 0,
    charges: totalCharges > 0,
    notes: notes.trim().length > 0,
  };

  const autoFilledCount = Math.min(
    TOTAL_FIELDS,
    16 +
      (calculatedCharges.rentDue > 0 ? 4 : 0) +
      (calculatedCharges.utilityCharge > 0 ? 3 : 0) +
      (manualCharges.generalCleaning > 0 ? 2 : 0) +
      (manualCharges.carpetShampooing > 0 ? 2 : 0) +
      (manualCharges.painting > 0 ? 2 : 0),
  );

  function updateManual(field: keyof typeof manualCharges, value: number) {
    updateReturn(tr.id, { manualCharges: { ...manualCharges, [field]: value } });
  }

  function handleContinue() {
    updateReturn(tr.id, { processingStatus: 'in_progress' });
    router.push(`/review/${encodeURIComponent(tr.id)}`);
  }

  return (
    <div className="h-screen flex flex-col bg-[#fbfbfa] overflow-hidden">

      {/* ── Top nav bar ── */}
      <div className="bg-white border-b border-[#e8e7e4] px-4 py-2 flex items-center justify-between shrink-0">

        {/* Left: back + tenant name */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/dashboard')}
            className="text-[12px] text-[#2383e2] flex items-center gap-1 hover:underline shrink-0"
          >
            ← All returns
          </button>
          <div className="w-px h-3.5 bg-[#d4d3d0]" />
          <div>
            <p className="text-[13px] font-semibold text-[#1a1a19]">
              {tenantData.tenantName} — Unit {tenantData.unit}
            </p>
            <p className="text-[11px] text-[#9b9b99]">
              {session.propertyName} · Move-out {tenantData.moveOutDate} ·{' '}
              {utilityData.utilityType === 'RUBS' ? 'RUBS' : 'Flat fee'}
              {tenantData.leaseBreak && (
                <span className="text-[#b3261e] font-medium"> · Lease break</span>
              )}{' '}
              · {formatCurrency(depositData.securityDeposit)} deposit
            </p>
          </div>
        </div>

        {/* Center: simplified 4-step progress bar */}
        <div className="flex overflow-hidden rounded-[6px] border border-[#e8e7e4]">
          {TOP_STEPS.map((label, i) => (
            <div
              key={label}
              className={`px-3 py-1 text-[10px] border-r border-[#e8e7e4] last:border-r-0 whitespace-nowrap ${
                i < CURRENT_TOP_STEP
                  ? 'bg-[#e3f5e6] text-[#1a7a3a]'
                  : i === CURRENT_TOP_STEP
                  ? 'bg-[#e6efff] text-[#1858b8] font-semibold'
                  : 'bg-[#f7f6f3] text-[#9b9b99]'
              }`}
            >
              {label}
            </div>
          ))}
        </div>

        {/* Right: continue button */}
        <button
          onClick={handleContinue}
          className="px-4 py-1.5 text-sm font-medium bg-[#1a1a19] text-white rounded-[6px] hover:bg-[#333] shrink-0"
        >
          Continue to review →
        </button>
      </div>

      {/* ── Main layout: [left 40%: progress steps + content] [right 60%: checkout form] ── */}
      <div className="flex-1 flex overflow-hidden">

        {/* Left 40%: vertical progress steps + context panel */}
        <div className="flex shrink-0 overflow-hidden" style={{ width: '40%' }}>

          {/* ══ Vertical progress steps — replaces icon sidebar ══
              Each step corresponds to a section of the AGM Checkout form on the right.
              Numbered in fill order so the user knows what to do next. */}
          <div className="w-[180px] bg-white border-r border-[#e8e7e4] flex flex-col py-4 px-3 gap-1 shrink-0">
            <p className="text-[9px] font-semibold text-[#9b9b99] uppercase tracking-[0.06em] mb-2 px-1">Form sections</p>
            {FORM_SECTIONS.map((section, idx) => {
              const isActive = activeSection === section.key;
              const isDone = sectionDone[section.key];
              return (
                <button
                  key={section.key}
                  onClick={() => setActiveSection(section.key)}
                  className={`w-full text-left px-3 py-2.5 rounded-[8px] border transition-colors ${
                    isActive
                      ? 'bg-[#e6efff] border-[#2383e2]/40'
                      : 'bg-transparent border-transparent hover:bg-[#f1f1ef] hover:border-[#e8e7e4]'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    {/* Step number circle — turns green with checkmark when done */}
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                      isDone && !isActive
                        ? 'bg-[#1a7a3a] text-white'
                        : isActive
                        ? 'bg-[#2383e2] text-white'
                        : 'bg-[#e8e7e4] text-[#9b9b99]'
                    }`}>
                      {isDone && !isActive ? '✓' : section.number}
                    </span>
                    <span className={`text-[11px] font-semibold leading-tight ${
                      isActive ? 'text-[#1858b8]' : isDone ? 'text-[#1a1a19]' : 'text-[#6b6b6a]'
                    }`}>
                      {section.title}
                    </span>
                  </div>
                  <p className="text-[9px] text-[#9b9b99] pl-7 leading-tight">{section.subtitle}</p>
                </button>
              );
            })}

            {/* Progress line at bottom: X / 4 sections */}
            <div className="mt-auto pt-4 px-1">
              <div className="h-1.5 bg-[#e8e7e4] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#1a7a3a] rounded-full transition-all"
                  style={{
                    width: `${(Object.values(sectionDone).filter(Boolean).length / 4) * 100}%`,
                  }}
                />
              </div>
              <p className="text-[9px] text-[#9b9b99] mt-1">
                {Object.values(sectionDone).filter(Boolean).length} of 4 sections complete
              </p>
            </div>
          </div>

          {/* ══ Context panel — content depends on active section ══ */}
          <div className="flex-1 bg-white border-r border-[#e8e7e4] flex flex-col overflow-hidden">
            <div className="px-3 py-2.5 border-b border-[#e8e7e4] shrink-0">
              <span className="text-[11px] font-semibold text-[#1a1a19]">
                {FORM_SECTIONS.find(s => s.key === activeSection)?.title}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-3">

              {/* ── SECTION 1: Property & Tenant ── */}
              {activeSection === 'tenant' && (
                <>
                  <p className="text-[10px] font-semibold text-[#9b9b99] uppercase tracking-[0.05em]">Tenant</p>
                  <div className="bg-[#f7f6f3] border border-[#e8e7e4] rounded-[6px] overflow-hidden">
                    <InfoRow label="Name" value={tenantData.tenantName} />
                    <InfoRow label="Co-tenant" value={tenantData.coTenant || '—'} />
                    <InfoRow label="Unit" value={tenantData.unit} />
                    <InfoRow label="Forwarding address" value={tenantData.forwardingAddress.street} />
                  </div>

                  <p className="text-[10px] font-semibold text-[#9b9b99] uppercase tracking-[0.05em]">Inspection</p>
                  <div className={`rounded-[6px] border p-3 text-center ${
                    tenantData.inspectionStatus === 'signed'
                      ? 'bg-[#e3f5e6] border-[#1a7a3a]/40'
                      : 'bg-[#fceae8] border-[#b3261e]/40'
                  }`}>
                    <p className={`text-[11px] font-semibold ${
                      tenantData.inspectionStatus === 'signed' ? 'text-[#1a7a3a]' : 'text-[#b3261e]'
                    }`}>
                      {tenantData.inspectionStatus === 'signed'
                        ? '✓ Move-in inspection signed'
                        : '⚠ No move-in inspection on file'}
                    </p>
                  </div>

                  <p className="text-[10px] font-semibold text-[#9b9b99] uppercase tracking-[0.05em]">Lease dates</p>
                  <div className="bg-[#f7f6f3] border border-[#e8e7e4] rounded-[6px] overflow-hidden">
                    <InfoRow label="Move-in" value={tenantData.moveInDate} />
                    <InfoRow label="Move-out" value={tenantData.moveOutDate} />
                    <InfoRow label="Paid through" value={tenantData.paidThroughDate || '—'} />
                    <InfoRow label="Lease end" value={tenantData.leaseEndDate} />
                    <InfoRow
                      label="Lease break"
                      value={tenantData.leaseBreak ? 'Yes — rent due after move-out' : 'No'}
                      highlight={tenantData.leaseBreak ? 'red' : undefined}
                    />
                    {tenantData.leaseBreak && tenantData.newTenantMoveInDate && (
                      <InfoRow label="New tenant in" value={tenantData.newTenantMoveInDate} />
                    )}
                  </div>

                  {tenantData.leaseBreak && (
                    <div className="bg-[#fceae8] border border-[#b3261e]/20 rounded-[6px] p-2.5 text-[11px] text-[#b3261e]">
                      <p className="font-semibold mb-0.5">⚠ Lease break</p>
                      <p>Rent is due until the new tenant moves in or the lease ends — whichever is first.</p>
                    </div>
                  )}
                </>
              )}

              {/* ── SECTION 2: Utility & Rates ── */}
              {activeSection === 'utility' && (
                <>
                  <p className="text-[10px] font-semibold text-[#9b9b99] uppercase tracking-[0.05em]">Deposits on file</p>
                  <div className="bg-[#f7f6f3] border border-[#e8e7e4] rounded-[6px] overflow-hidden">
                    <InfoRow label="Security deposit" value={formatCurrency(depositData.securityDeposit)} />
                    {depositData.petDeposit > 0 && (
                      <InfoRow label="Pet deposit" value={formatCurrency(depositData.petDeposit)} />
                    )}
                    {depositData.keyDeposit > 0 && (
                      <InfoRow label="Key deposit" value={formatCurrency(depositData.keyDeposit)} />
                    )}
                    {/* NRC = Non-Refundable Cleaning — pre-paid at move-in, offsets cleaning charge at move-out */}
                    <InfoRow label="NRC cleaning fee" value={formatCurrency(depositData.nrcCleaningFee)} />
                  </div>

                  {utilityData.utilityType === 'RUBS' && (
                    <>
                      <p className="text-[10px] font-semibold text-[#9b9b99] uppercase tracking-[0.05em]">RUBS billing</p>
                      <p className="text-[10px] text-[#9b9b99]">
                        RUBS = Ratio Utility Billing System. The building's water bill is split across units by square footage ratio.
                      </p>
                      <div className="space-y-1.5">
                        {[
                          ['Building water bill', formatCurrency(utilityData.rubsBuildingTotal)],
                          ['Unit share', (utilityData.rubsUnitRatio * 100).toFixed(1) + '%'],
                          ['Chargeback', formatCurrency(calculatedCharges.utilityCharge)],
                        ].map(([label, val]) => (
                          <div key={label} className="flex justify-between px-2.5 py-1.5 bg-[#e6efff] border border-[#2383e2]/25 rounded-[4px]">
                            <span className="text-[11px] text-[#6b6b6a]">{label}</span>
                            <span className="text-[11px] font-semibold text-[#1858b8]">{val}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  {utilityData.utilityType === 'flat_fee' && (
                    <>
                      <p className="text-[10px] font-semibold text-[#9b9b99] uppercase tracking-[0.05em]">Flat fee billing</p>
                      <div className="space-y-1.5">
                        {[
                          ['Rate', formatCurrency(utilityData.flatFeeRate) + '/mo'],
                          ['Method', utilityData.flatFeeBillingMethod === 'included_in_rent' ? 'Included in rent' : 'Billed at move-out'],
                          ['Charge', formatCurrency(calculatedCharges.utilityCharge)],
                        ].map(([label, val]) => (
                          <div key={label} className="flex justify-between px-2.5 py-1.5 bg-[#e3f5e6] border border-[#1a7a3a]/25 rounded-[4px]">
                            <span className="text-[11px] text-[#6b6b6a]">{label}</span>
                            <span className="text-[11px] font-semibold text-[#1a7a3a]">{val}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  <p className="text-[10px] font-semibold text-[#9b9b99] uppercase tracking-[0.05em]">Monthly rent</p>
                  <div className="bg-[#f7f6f3] border border-[#e8e7e4] rounded-[6px] overflow-hidden">
                    <InfoRow label="Monthly rent" value={formatCurrency(tenantData.monthlyRent) + '/mo'} />
                    {/* Daily rate = monthly ÷ 30. Used in lease break penalty calculations. */}
                    <InfoRow label="Daily rate (÷ 30)" value={formatCurrency(dailyRate) + '/day'} />
                  </div>
                </>
              )}

              {/* ── SECTION 3: Turnover Charges ── */}
              {activeSection === 'charges' && (
                <>
                  <p className="text-[10px] font-semibold text-[#9b9b99] uppercase tracking-[0.05em]">What's been entered</p>
                  <p className="text-[10px] text-[#9b9b99]">
                    Enter charges in the form on the right. This panel shows a running summary.
                  </p>
                  <div className="bg-[#f7f6f3] border border-[#e8e7e4] rounded-[6px] overflow-hidden">
                    {calculatedCharges.rentDue > 0 && (
                      <InfoRow label={tenantData.leaseBreak ? 'Rent (lease break)' : 'Rent due'} value={formatCurrency(calculatedCharges.rentDue)} highlight="red" />
                    )}
                    {calculatedCharges.utilityCharge > 0 && (
                      <InfoRow label="Utility chargeback" value={formatCurrency(calculatedCharges.utilityCharge)} />
                    )}
                    {manualCharges.generalCleaning > 0 && (
                      <InfoRow label="Cleaning (before NRC)" value={formatCurrency(manualCharges.generalCleaning)} />
                    )}
                    {nrcOffset > 0 && (
                      <InfoRow label="NRC offset" value={'−' + formatCurrency(nrcOffset)} highlight="amber" />
                    )}
                    {tenantCleaning > 0 && (
                      <InfoRow label="Cleaning (tenant owes)" value={formatCurrency(tenantCleaning)} />
                    )}
                    {manualCharges.carpetShampooing > 0 && (
                      <InfoRow label="Carpet" value={formatCurrency(manualCharges.carpetShampooing)} />
                    )}
                    {manualCharges.painting > 0 && (
                      <InfoRow label="Painting" value={formatCurrency(manualCharges.painting)} />
                    )}
                    {manualCharges.other1 > 0 && (
                      <InfoRow label={manualCharges.other1Label || 'Other'} value={formatCurrency(manualCharges.other1)} />
                    )}
                    {totalCharges === 0 && (
                      <div className="px-3 py-3 text-[11px] text-[#9b9b99] text-center">No charges entered yet</div>
                    )}
                  </div>

                  {totalCharges > 0 && (
                    <div className={`p-3 rounded-[6px] text-center ${balance >= 0 ? 'bg-[#e3f5e6]' : 'bg-[#fceae8]'}`}>
                      <p className="text-[10px] text-[#9b9b99] mb-0.5">
                        {balance >= 0 ? 'Balance due to tenant' : 'Balance owing landlord'}
                      </p>
                      <p className={`text-[18px] font-bold ${balance >= 0 ? 'text-[#1a7a3a]' : 'text-[#b3261e]'}`}>
                        {formatCurrency(Math.abs(balance))}
                      </p>
                    </div>
                  )}
                </>
              )}

              {/* ── SECTION 4: Notes ── */}
              {activeSection === 'notes' && (
                <>
                  <p className="text-[10px] font-semibold text-[#9b9b99] uppercase tracking-[0.05em]">Case notes</p>
                  <textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Add notes about this return — special circumstances, follow-ups, reminders..."
                    className="w-full min-h-[200px] text-[12px] text-[#1a1a19] bg-white border border-[#e8e7e4] rounded-[6px] p-3 resize-none focus:outline-none focus:border-[#2383e2]"
                  />
                  <p className="text-[10px] text-[#9b9b99]">Notes are saved for this browser session only.</p>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════
            RIGHT PANEL — 60% — AGM Checkout Report.
            Auto-filled from AppFolio data. All fields are editable.
            ══════════════════════════════════════════ */}
        <div className="flex flex-col overflow-hidden bg-[#f7f6f3]" style={{ width: '60%' }}>

          {/* Form header */}
          <div className="px-4 py-2 border-b border-[#e8e7e4] flex items-center justify-between bg-white shrink-0">
            <span className="text-[11px] font-semibold text-[#6b6b6a]">📄 AGM Checkout Report</span>
            <span className="text-[10px] text-[#9b9b99]">{autoFilledCount} / {TOTAL_FIELDS} fields auto-filled</span>
          </div>

          {/* Scrollable form body */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">

            {/* ── Property & Tenant (auto-filled, editable) ── */}
            <div>
              <p className="text-[9px] font-semibold text-[#9b9b99] uppercase tracking-[0.06em] mb-2">Property &amp; Tenant</p>
              <div className="bg-white border border-[#e8e7e4] rounded-[6px] p-3 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <FormDisplayField label="Property" value={fieldVal('property', session.propertyName || '—')} onChange={v => setField('property', v)} />
                  <FormDisplayField label="Unit" value={fieldVal('unit', tenantData.unit)} onChange={v => setField('unit', v)} />
                </div>
                <FormDisplayField label="Tenant name" value={fieldVal('tenantName', tenantData.tenantName)} onChange={v => setField('tenantName', v)} />
                <FormDisplayField label="Co-tenant / co-signer" value={fieldVal('coTenant', tenantData.coTenant || '')} onChange={v => setField('coTenant', v)} />
                <FormDisplayField label="Forwarding address" value={fieldVal('fwdAddr', fwdAddr)} onChange={v => setField('fwdAddr', v)} />
                <div>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                    tenantData.inspectionStatus === 'signed'
                      ? 'bg-[#e3f5e6] text-[#1a7a3a]'
                      : 'bg-[#fceae8] text-[#b3261e]'
                  }`}>
                    {tenantData.inspectionStatus === 'signed'
                      ? '📋 Move-in inspection: signed'
                      : '⚠ Move-in inspection: missing'}
                  </span>
                </div>
              </div>
            </div>

            {/* ── RUBS chargeback — blue, calculated automatically ── */}
            {utilityData.utilityType === 'RUBS' && calculatedCharges.utilityCharge > 0 && (
              <div>
                <p className="text-[9px] font-semibold text-[#9b9b99] uppercase tracking-[0.06em] mb-2">RUBS chargeback</p>
                <div className="bg-[#e6efff] border border-[#2383e2]/30 rounded-[6px] p-3 space-y-1">
                  <div className="flex justify-between text-[12px]">
                    <span className="text-[#6b6b6a]">Building water bill</span>
                    <span className="font-semibold text-[#1858b8]">{formatCurrency(utilityData.rubsBuildingTotal)}</span>
                  </div>
                  <div className="flex justify-between text-[12px]">
                    <span className="text-[#6b6b6a]">Unit {tenantData.unit} share</span>
                    <span className="font-semibold text-[#1858b8]">{(utilityData.rubsUnitRatio * 100).toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between text-[12px] pt-1 border-t border-[#2383e2]/20">
                    <span className="text-[#6b6b6a]">Chargeback ({formatCurrency(utilityData.rubsBuildingTotal)} × {(utilityData.rubsUnitRatio * 100).toFixed(1)}%)</span>
                    <span className="font-bold text-[#1858b8]">{formatCurrency(calculatedCharges.utilityCharge)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* ── Flat fee utility ── */}
            {utilityData.utilityType === 'flat_fee' && calculatedCharges.utilityCharge > 0 && (
              <div>
                <p className="text-[9px] font-semibold text-[#9b9b99] uppercase tracking-[0.06em] mb-2">Flat fee utility</p>
                <div className="bg-[#e3f5e6] border border-[#1a7a3a]/30 rounded-[6px] p-3">
                  <div className="flex justify-between text-[12px]">
                    <span className="text-[#6b6b6a]">Utility charge</span>
                    <span className="font-bold text-[#1a7a3a]">{formatCurrency(calculatedCharges.utilityCharge)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* ── Lease break rent due — RED ── */}
            {tenantData.leaseBreak && calculatedCharges.rentDue > 0 && (
              <div>
                <p className="text-[9px] font-semibold text-[#9b9b99] uppercase tracking-[0.06em] mb-2">Lease break — rent due</p>
                <div className="bg-[#fceae8] border border-[#b3261e]/30 rounded-[6px] p-3 space-y-1">
                  <div className="flex justify-between text-[12px]">
                    <span className="text-[#6b6b6a]">{formatCurrency(tenantData.monthlyRent)} ÷ 30 days</span>
                    <span className="font-semibold text-[#b3261e]">{formatCurrency(dailyRate)}/day</span>
                  </div>
                  {calculatedCharges.rentDueDateRange && (
                    <div className="flex justify-between text-[12px]">
                      <span className="text-[#6b6b6a]">{calculatedCharges.rentDueDateRange}</span>
                      <span className="font-semibold text-[#b3261e]">
                        {Math.round(calculatedCharges.rentDue / dailyRate)} days
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-[12px] pt-1 border-t border-[#b3261e]/20">
                    <span className="text-[#6b6b6a]">Rent due</span>
                    <span className="font-bold text-[#b3261e]">{formatCurrency(calculatedCharges.rentDue)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* ── Turnover charges — manual input ── */}
            <div>
              <p className="text-[9px] font-semibold text-[#9b9b99] uppercase tracking-[0.06em] mb-2">Turnover charges</p>
              <div className="bg-white border border-[#e8e7e4] rounded-[6px] p-3">
                <div className="grid grid-cols-2 gap-3">
                  <ChargeInput
                    label="Cleaning ($)"
                    value={manualCharges.generalCleaning}
                    onChange={v => updateManual('generalCleaning', v)}
                    note={`NRC ${formatCurrency(depositData.nrcCleaningFee)} covers`}
                  />
                  <ChargeInput
                    label="Carpet ($)"
                    value={manualCharges.carpetShampooing}
                    onChange={v => updateManual('carpetShampooing', v)}
                  />
                  <ChargeInput
                    label="Painting ($)"
                    value={manualCharges.painting}
                    onChange={v => updateManual('painting', v)}
                  />
                  <ChargeInput
                    label="Other ($)"
                    value={manualCharges.other1}
                    onChange={v => updateManual('other1', v)}
                  />
                </div>
                <p className="text-[10px] text-[#9b9b99] mt-2">Type 0 to clear a charge — turns amber when a value is entered</p>
              </div>
            </div>

            {/* ── Balance summary ── */}
            <div>
              <p className="text-[9px] font-semibold text-[#9b9b99] uppercase tracking-[0.06em] mb-2">Balance</p>
              <div className="bg-white border border-[#e8e7e4] rounded-[6px] p-3 space-y-2">
                <div className="space-y-1">
                  <div className="flex justify-between text-[12px]">
                    <span className="text-[#6b6b6a]">Security deposit</span>
                    <span className="text-[#1a7a3a] font-medium">+{formatCurrency(depositData.securityDeposit)}</span>
                  </div>
                  {depositData.petDeposit > 0 && (
                    <div className="flex justify-between text-[12px]">
                      <span className="text-[#6b6b6a]">Pet deposit</span>
                      <span className="text-[#1a7a3a] font-medium">+{formatCurrency(depositData.petDeposit)}</span>
                    </div>
                  )}
                </div>
                <div className="pt-1 border-t border-[#e8e7e4] flex justify-between text-[12px]">
                  <span className="text-[#6b6b6a]">Total charges</span>
                  <span className="text-[#b3261e] font-medium">−{formatCurrency(totalCharges)}</span>
                </div>
                <div className={`rounded-[6px] p-3 text-center mt-1 ${balance >= 0 ? 'bg-[#e3f5e6]' : 'bg-[#fceae8]'}`}>
                  <p className="text-[10px] text-[#9b9b99] mb-0.5">
                    {balance >= 0 ? 'Balance due to tenant' : 'Balance owing landlord'}
                  </p>
                  <p className={`text-[20px] font-bold ${balance >= 0 ? 'text-[#1a7a3a]' : 'text-[#b3261e]'}`}>
                    {formatCurrency(Math.abs(balance))}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
