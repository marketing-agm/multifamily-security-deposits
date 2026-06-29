// components/AgentForm/index.tsx
// Screen 2 — Return form with sidebar tabs
//
// Layout (left to right):
//   [Sidebar tabs] | [Charges & calculations] | [Live AGM Checkout Report preview]
//
// The sidebar has clickable tabs — Photos, Tenant, Rates, Notes.
// Each tab opens a panel with relevant info for that section.
// This replaces the old chat-based interface.

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/context/SessionContext';
import { formatCurrency } from '@/lib/calculations';
import { TenantReturn } from '@/types';

const STEP_LABELS = ['1. Upload', '2. Select', '3. Form', '4. Review', '5. Download'];
const CURRENT_STEP = 2; // zero-indexed — step 3 "Form" is index 2
const TOTAL_FIELDS = 72;

// Which tab in the sidebar is active
type SidebarTab = 'photos' | 'tenant' | 'rates' | 'notes';

interface Props {
  returnId: string;
}

// ============================================================
// SidebarTabButton — one clickable tab in the left sidebar.
// "flagged" = amber background (something needs attention).
// "active" = blue highlight.
// "dot" = small orange indicator dot in the corner.
// ============================================================
function SidebarTabButton({
  icon,
  label,
  active,
  flagged,
  dot,
  onClick,
}: {
  icon: string;
  label: string;
  active: boolean;
  flagged?: boolean;
  dot?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`relative w-12 h-12 rounded-[8px] flex flex-col items-center justify-center gap-0.5 border transition-colors ${
        flagged
          ? 'bg-[#fdf3da] border-[#e8c840]/50 text-[#8b6a00]'
          : active
          ? 'bg-[#e6efff] border-[#2383e2]/40 text-[#1858b8]'
          : 'bg-transparent border-transparent text-[#9b9b99] hover:bg-[#f1f1ef] hover:border-[#e8e7e4] hover:text-[#6b6b6a]'
      }`}
    >
      <span className="text-[20px] leading-none">{icon}</span>
      <span className="text-[9px] font-medium">{label}</span>
      {dot && (
        // Orange dot = flag / something needs attention
        <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#f0a500] border-2 border-white" />
      )}
    </button>
  );
}

// ============================================================
// FormField — read-only color-coded field in the live form preview.
// auto=green (Excel), calc=blue (math), manual=amber (user typed)
// ============================================================
function FormField({
  label,
  value,
  variant = 'empty',
  fullWidth = false,
}: {
  label: string;
  value: string;
  variant?: 'auto' | 'calc' | 'manual' | 'empty';
  fullWidth?: boolean;
}) {
  const styles: Record<string, string> = {
    auto:   'bg-[#e3f5e6] border-[#1a7a3a]/60 text-[#1a7a3a]',
    calc:   'bg-[#e6efff] border-[#1858b8]/60 text-[#1858b8] font-medium',
    manual: 'bg-[#fdf3da] border-[#8b6a00]/60 text-[#8b6a00]',
    empty:  'bg-white border-[#e8e7e4] text-[#9b9b99]',
  };
  return (
    <div className={`flex flex-col gap-0.5 ${fullWidth ? 'col-span-full' : ''}`}>
      <label className="text-[9px] font-medium text-[#9b9b99] uppercase tracking-[0.04em]">{label}</label>
      <div className={`text-[11px] h-[24px] px-2 flex items-center rounded-[4px] border w-full overflow-hidden ${styles[variant]}`}>
        <span className="truncate">{value || '—'}</span>
      </div>
    </div>
  );
}

// ============================================================
// SectionDivider — uppercase label used to break up the live form
// ============================================================
function SectionDivider({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[9px] font-semibold text-[#9b9b99] uppercase tracking-[0.06em] border-b border-[#e8e7e4] pb-1 mt-3 mb-2">
      {children}
    </div>
  );
}

export function AgentForm({ returnId }: Props) {
  const { session, updateReturn } = useSession();
  const router = useRouter();

  // activeTab: which sidebar tab is expanded. null = sidebar collapsed.
  const [activeTab, setActiveTab] = useState<SidebarTab | null>('tenant');

  const trMaybe = session?.returns.find(r => r.id === returnId);
  if (!session || !trMaybe) {
    router.replace('/dashboard');
    return null;
  }
  const tr: TenantReturn = trMaybe;

  const { tenantData, depositData, utilityData, calculatedCharges, manualCharges } = tr;

  // NRC (Non-Refundable Cleaning fee) offsets the cleaning charge.
  // Tenant only pays the cleaning amount above what NRC already covered.
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
  const dueToTenant = balance >= 0 ? balance : 0;
  const owingLandlord = balance < 0 ? Math.abs(balance) : 0;

  const fwdAddr = `${tenantData.forwardingAddress.street}, ${tenantData.forwardingAddress.city} ${tenantData.forwardingAddress.state} ${tenantData.forwardingAddress.zip}`;

  // Auto-fill count estimate — goes up as more charges are entered
  const autoFilledCount = Math.min(
    TOTAL_FIELDS,
    16 +
      (calculatedCharges.rentDue > 0 ? 4 : 0) +
      (calculatedCharges.utilityCharge > 0 ? 3 : 0) +
      (manualCharges.generalCleaning > 0 ? 2 : 0) +
      (manualCharges.carpetShampooing > 0 ? 2 : 0) +
      (manualCharges.painting > 0 ? 2 : 0),
  );

  function toggleTab(tab: SidebarTab) {
    setActiveTab(prev => prev === tab ? null : tab);
  }

  function updateManual(field: keyof typeof manualCharges, value: number) {
    updateReturn(tr.id, {
      manualCharges: { ...manualCharges, [field]: value },
    });
  }

  function handleContinue() {
    updateReturn(tr.id, { processingStatus: 'in_progress' });
    router.push(`/review/${encodeURIComponent(tr.id)}`);
  }

  // Daily rent = monthly ÷ 30 (simplified — actual uses days in month)
  const dailyRate = tenantData.monthlyRent / 30;

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
              {tenantData.leaseBreak ? ' · Lease break' : ''} ·{' '}
              {formatCurrency(depositData.securityDeposit)} deposit
            </p>
          </div>
        </div>

        {/* Center: step bar */}
        <div className="flex overflow-hidden rounded-[6px] border border-[#e8e7e4]">
          {STEP_LABELS.map((label, i) => (
            <div
              key={label}
              className={`px-3 py-1 text-[10px] border-r border-[#e8e7e4] last:border-r-0 whitespace-nowrap ${
                i < CURRENT_STEP
                  ? 'bg-[#e3f5e6] text-[#1a7a3a]'
                  : i === CURRENT_STEP
                  ? 'bg-[#e6efff] text-[#1858b8] font-semibold'
                  : 'bg-[#f7f6f3] text-[#9b9b99]'
              }`}
            >
              {label}
            </div>
          ))}
        </div>

        {/* Right: continue */}
        <button
          onClick={handleContinue}
          className="px-4 py-1.5 text-sm font-medium bg-[#1a1a19] text-white rounded-[6px] hover:bg-[#333] shrink-0"
        >
          Continue to review →
        </button>
      </div>

      {/* ── Main layout ── */}
      <div className="flex-1 flex overflow-hidden">

        {/* ══════════════════════════════════════════
            SIDEBAR — icon tabs on the left
            Each icon is a tab. Clicking it opens/closes
            the detail panel next to it.
            ══════════════════════════════════════════ */}
        <div className="w-[56px] bg-white border-r border-[#e8e7e4] flex flex-col items-center py-3 gap-2 shrink-0">
          <SidebarTabButton
            icon="📷"
            label="Photos"
            active={activeTab === 'photos'}
            flagged={tenantData.inspectionStatus === 'missing'}
            dot={tenantData.inspectionStatus === 'missing'}
            onClick={() => toggleTab('photos')}
          />
          <SidebarTabButton
            icon="👤"
            label="Tenant"
            active={activeTab === 'tenant'}
            onClick={() => toggleTab('tenant')}
          />
          <SidebarTabButton
            icon="🧾"
            label="Rates"
            active={activeTab === 'rates'}
            onClick={() => toggleTab('rates')}
          />
          {/* Divider between main tabs and notes */}
          <div className="w-8 border-t border-[#e8e7e4] my-1" />
          <SidebarTabButton
            icon="📝"
            label="Notes"
            active={activeTab === 'notes'}
            onClick={() => toggleTab('notes')}
          />
        </div>

        {/* ══════════════════════════════════════════
            SIDEBAR DETAIL PANEL
            Slides in when a tab is active.
            220px wide, scrollable, shows tab content.
            ══════════════════════════════════════════ */}
        {activeTab && (
          <div className="w-[220px] bg-white border-r border-[#e8e7e4] flex flex-col shrink-0 overflow-hidden">
            {/* Panel header with title + close button */}
            <div className="px-3 py-2.5 border-b border-[#e8e7e4] flex items-center justify-between shrink-0">
              <span className="text-[11px] font-semibold text-[#1a1a19]">
                {activeTab === 'photos' && '📷 Inspection'}
                {activeTab === 'tenant' && '👤 Tenant details'}
                {activeTab === 'rates' && '🧾 Rates'}
                {activeTab === 'notes' && '📝 Notes'}
              </span>
              <button
                onClick={() => setActiveTab(null)}
                className="w-5 h-5 rounded-[4px] border border-[#e8e7e4] text-[#9b9b99] hover:bg-[#f1f1ef] text-[10px] flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            {/* Panel body — scrolls independently */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3">

              {/* ── PHOTOS / INSPECTION TAB ── */}
              {activeTab === 'photos' && (
                <>
                  <p className="text-[10px] font-semibold text-[#9b9b99] uppercase tracking-[0.05em]">Move-in inspection</p>
                  <div className={`rounded-[6px] border p-3 text-center ${
                    tenantData.inspectionStatus === 'signed'
                      ? 'bg-[#e3f5e6] border-[#1a7a3a]/40'
                      : 'bg-[#fceae8] border-[#b3261e]/40'
                  }`}>
                    <div className="text-3xl mb-1">🏠</div>
                    <p className={`text-[11px] font-semibold ${
                      tenantData.inspectionStatus === 'signed' ? 'text-[#1a7a3a]' : 'text-[#b3261e]'
                    }`}>
                      {tenantData.inspectionStatus === 'signed'
                        ? '✓ Signed · 6 photos on file'
                        : '⚠ Missing — no inspection on file'}
                    </p>
                  </div>
                  <p className="text-[10px] font-semibold text-[#9b9b99] uppercase tracking-[0.05em]">Move-out inspection</p>
                  <div className="bg-[#f7f6f3] border border-[#e8e7e4] rounded-[6px] p-3 text-center">
                    <div className="text-3xl mb-1">🔑</div>
                    <p className="text-[11px] text-[#9b9b99]">Not yet completed</p>
                  </div>
                  {tenantData.inspectionStatus === 'missing' && (
                    <div className="bg-[#fceae8] border border-[#b3261e]/20 rounded-[6px] p-2.5 text-[11px] text-[#b3261e]">
                      <p className="font-semibold mb-1">Risk: no move-in inspection</p>
                      <p>Without a signed move-in inspection, deducting for damage is legally risky. Consult your manager before charging for repairs.</p>
                    </div>
                  )}
                </>
              )}

              {/* ── TENANT TAB ── */}
              {activeTab === 'tenant' && (
                <>
                  <p className="text-[10px] font-semibold text-[#9b9b99] uppercase tracking-[0.05em]">Lease</p>
                  {/* Lease info card — one row per field */}
                  <div className="bg-[#f7f6f3] border border-[#e8e7e4] rounded-[6px] overflow-hidden">
                    {[
                      ['Name', tenantData.tenantName],
                      ['Co-tenant', tenantData.coTenant || '—'],
                      ['Unit', tenantData.unit],
                      ['Monthly rent', formatCurrency(tenantData.monthlyRent) + '/mo'],
                      ['Security deposit', formatCurrency(depositData.securityDeposit)],
                      ['NRC cleaning fee', formatCurrency(depositData.nrcCleaningFee)],
                      ['Move-in', tenantData.moveInDate],
                      ['Move-out', tenantData.moveOutDate],
                      ['Paid through', tenantData.paidThroughDate || '—'],
                      ['Notice date', tenantData.noticeDate || '—'],
                      ['Lease end', tenantData.leaseEndDate],
                      ['New tenant in', tenantData.newTenantMoveInDate || '—'],
                      ['Utility billing', utilityData.utilityType === 'RUBS' ? 'RUBS' : 'Flat fee'],
                    ].map(([label, val]) => (
                      <div key={label} className="flex justify-between px-2.5 py-1.5 border-b border-[#e8e7e4] last:border-b-0">
                        <span className="text-[10px] text-[#9b9b99]">{label}</span>
                        <span className="text-[10px] font-medium text-[#1a1a19] text-right max-w-[55%]">{val}</span>
                      </div>
                    ))}
                  </div>
                  {tenantData.leaseBreak && (
                    <div className="bg-[#fdf3da] border border-[#e8c840]/40 rounded-[6px] p-2.5 text-[11px] text-[#8b6a00]">
                      <p className="font-semibold mb-0.5">⚠ Lease break detected</p>
                      <p>Tenant moved out before lease ended. Rent is due until the new tenant moves in or the lease ends, whichever is first.</p>
                    </div>
                  )}
                </>
              )}

              {/* ── RATES TAB ── */}
              {activeTab === 'rates' && (
                <>
                  <p className="text-[10px] font-semibold text-[#9b9b99] uppercase tracking-[0.05em]">
                    {utilityData.utilityType === 'RUBS' ? 'RUBS billing' : 'Flat fee billing'}
                  </p>
                  {utilityData.utilityType === 'RUBS' ? (
                    <div className="space-y-1.5">
                      {[
                        ['Building total', formatCurrency(utilityData.rubsBuildingTotal)],
                        ['Unit share', (utilityData.rubsUnitRatio * 100).toFixed(1) + '%'],
                        ['Chargeback', formatCurrency(calculatedCharges.utilityCharge)],
                      ].map(([label, val]) => (
                        <div key={label} className="flex justify-between px-2.5 py-1.5 bg-[#e6efff] border border-[#2383e2]/25 rounded-[4px]">
                          <span className="text-[11px] text-[#6b6b6a]">{label}</span>
                          <span className="text-[11px] font-semibold text-[#1858b8]">{val}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
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
                  )}
                </>
              )}

              {/* ── NOTES TAB ── */}
              {activeTab === 'notes' && (
                <>
                  <p className="text-[10px] font-semibold text-[#9b9b99] uppercase tracking-[0.05em]">Case notes</p>
                  <div className="bg-[#f7f6f3] border border-[#e8e7e4] rounded-[6px] p-3 text-[11px] text-[#9b9b99] italic min-h-[80px]">
                    No notes yet.
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════
            CHARGES & CALCULATIONS PANEL
            Left side of the main split.
            Shows auto-calculated values (RUBS, lease break)
            and manual charge inputs (cleaning, carpet, etc).
            ══════════════════════════════════════════ */}
        <div className="flex-1 border-r border-[#e8e7e4] flex flex-col overflow-hidden bg-white min-w-0">
          {/* Panel header */}
          <div className="px-4 py-2 border-b border-[#e8e7e4] flex items-center justify-between shrink-0">
            <span className="text-[11px] font-semibold text-[#6b6b6a]">⚙ Charges &amp; calculations</span>
            <span className="text-[10px] text-[#1a7a3a]">{autoFilledCount} / {TOTAL_FIELDS} auto-filled</span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">

            {/* RUBS chargeback — calculated, read-only card */}
            {utilityData.utilityType === 'RUBS' && calculatedCharges.utilityCharge > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-[#9b9b99] uppercase tracking-[0.05em] mb-2">RUBS chargeback</p>
                {/* Blue card = calculated value */}
                <div className="bg-[#e6efff] border border-[#2383e2]/30 rounded-[6px] p-3 space-y-1">
                  <div className="flex justify-between text-[12px]">
                    <span className="text-[#6b6b6a]">Building water bill</span>
                    <span className="font-semibold text-[#1858b8]">{formatCurrency(utilityData.rubsBuildingTotal)}</span>
                  </div>
                  <div className="flex justify-between text-[12px]">
                    <span className="text-[#6b6b6a]">Unit {tenantData.unit} share</span>
                    <span className="font-semibold text-[#1858b8]">{(utilityData.rubsUnitRatio * 100).toFixed(1)}%</span>
                  </div>
                  {/* Shows the actual formula so it's transparent */}
                  <div className="flex justify-between text-[12px] pt-1 border-t border-[#2383e2]/20">
                    <span className="text-[#6b6b6a]">
                      Chargeback ({formatCurrency(utilityData.rubsBuildingTotal)} × {(utilityData.rubsUnitRatio * 100).toFixed(1)}%)
                    </span>
                    <span className="font-bold text-[#1858b8]">{formatCurrency(calculatedCharges.utilityCharge)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Flat fee utility — calculated card */}
            {utilityData.utilityType === 'flat_fee' && calculatedCharges.utilityCharge > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-[#9b9b99] uppercase tracking-[0.05em] mb-2">Flat fee utility</p>
                <div className="bg-[#e3f5e6] border border-[#1a7a3a]/30 rounded-[6px] p-3">
                  <div className="flex justify-between text-[12px]">
                    <span className="text-[#6b6b6a]">Utility charge</span>
                    <span className="font-bold text-[#1a7a3a]">{formatCurrency(calculatedCharges.utilityCharge)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Lease break — rent due. Green card with day-by-day formula shown. */}
            {tenantData.leaseBreak && calculatedCharges.rentDue > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-[#9b9b99] uppercase tracking-[0.05em] mb-2">Lease break — rent due</p>
                <div className="bg-[#e3f5e6] border border-[#1a7a3a]/30 rounded-[6px] p-3 space-y-1">
                  {/* Shows the daily rate calculation */}
                  <div className="flex justify-between text-[12px]">
                    <span className="text-[#6b6b6a]">
                      {formatCurrency(tenantData.monthlyRent)} ÷ 30 days
                    </span>
                    <span className="font-semibold text-[#1a7a3a]">{formatCurrency(dailyRate)}/day</span>
                  </div>
                  {/* Shows the date range and day count */}
                  {calculatedCharges.rentDueDateRange && (
                    <div className="flex justify-between text-[12px]">
                      <span className="text-[#6b6b6a]">{calculatedCharges.rentDueDateRange}</span>
                      <span className="font-semibold text-[#1a7a3a]">
                        {Math.round(calculatedCharges.rentDue / dailyRate)} days
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-[12px] pt-1 border-t border-[#1a7a3a]/20">
                    <span className="text-[#6b6b6a]">Rent due</span>
                    <span className="font-bold text-[#1a7a3a]">{formatCurrency(calculatedCharges.rentDue)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Turnover charges — manual input grid */}
            <div>
              <p className="text-[10px] font-semibold text-[#9b9b99] uppercase tracking-[0.05em] mb-2">
                Turnover charges — enter or edit
              </p>
              <div className="border border-[#e8e7e4] rounded-[6px] p-3">
                <div className="grid grid-cols-2 gap-3">
                  {/* Each input shows amber highlight when it has a non-zero value */}
                  {[
                    { label: `Cleaning ($)`, field: 'generalCleaning' as const, note: `NRC ${formatCurrency(depositData.nrcCleaningFee)} covers` },
                    { label: 'Carpet ($)', field: 'carpetShampooing' as const },
                    { label: 'Painting ($)', field: 'painting' as const },
                    { label: 'Other ($)', field: 'other1' as const },
                  ].map(({ label, field, note }) => (
                    <div key={field} className="flex flex-col gap-1">
                      <label className="text-[10px] text-[#9b9b99]">
                        {label}
                        {note && <span className="block text-[9px] text-[#9b9b99]">{note}</span>}
                      </label>
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={manualCharges[field] || ''}
                        placeholder="0"
                        onChange={e => updateManual(field, parseFloat(e.target.value) || 0)}
                        className={`h-8 text-sm px-2 rounded-[4px] border w-full ${
                          manualCharges[field] > 0
                            ? 'bg-[#fdf3da] border-[#8b6a00] text-[#8b6a00]'
                            : 'bg-white border-[#e8e7e4] text-[#1a1a19]'
                        }`}
                      />
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-[#9b9b99] mt-2">All fields editable — auto-filled values can be changed</p>
              </div>
            </div>

            {/* Balance summary */}
            <div>
              <p className="text-[10px] font-semibold text-[#9b9b99] uppercase tracking-[0.05em] mb-2">Balance</p>
              <div className="border border-[#e8e7e4] rounded-[6px] p-3 space-y-1.5">
                <div className="flex justify-between text-[13px]">
                  <span className="text-[#6b6b6a]">Total credits</span>
                  <span className="font-semibold text-[#1a7a3a]">{formatCurrency(totalCredits)}</span>
                </div>
                <div className="flex justify-between text-[13px]">
                  <span className="text-[#6b6b6a]">Total charges</span>
                  <span className="font-semibold text-[#b3261e]">{formatCurrency(totalCharges)}</span>
                </div>
                <div className="flex justify-between text-[13px] pt-1.5 border-t border-[#e8e7e4]">
                  <span className="text-[#1a1a19] font-medium">Result</span>
                  <span className={`font-bold ${balance >= 0 ? 'text-[#1a7a3a]' : 'text-[#b3261e]'}`}>
                    {formatCurrency(Math.abs(balance))} {balance >= 0 ? 'due to tenant' : 'owing landlord'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Continue button — pinned to panel bottom */}
          <div className="px-4 py-3 border-t border-[#e8e7e4] shrink-0">
            <button
              onClick={handleContinue}
              className="w-full py-2 text-[13px] font-semibold text-[#1a1a19] bg-white border border-[#e8e7e4] rounded-[6px] hover:bg-[#f7f6f3] transition-colors"
            >
              Continue to review →
            </button>
          </div>
        </div>

        {/* ══════════════════════════════════════════
            LIVE FORM PREVIEW (AGM Checkout Report)
            Right side of the main split.
            Shows the actual PDF form fields filling in
            with color-coded variants as values are set.
            ══════════════════════════════════════════ */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[#f7f6f3] min-w-0">
          {/* Panel header */}
          <div className="px-4 py-2 border-b border-[#e8e7e4] flex items-center justify-between bg-white shrink-0">
            <span className="text-[11px] font-semibold text-[#6b6b6a]">📄 AGM Checkout Report</span>
            <span className="text-[10px] text-[#9b9b99]">{autoFilledCount} / {TOTAL_FIELDS} fields</span>
          </div>

          {/* Scrollable form preview */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1.5">
            <p className="text-[11px] font-semibold text-center text-[#6b6b6a] border-b border-[#e8e7e4] pb-2 mb-2 tracking-[0.04em]">
              Checkout Report · AGM Real Estate
            </p>

            {/* Header: property + unit */}
            <div className="grid grid-cols-2 gap-1.5">
              <FormField label="Property name" value={session.propertyName || '—'} variant="auto" />
              <FormField label="Unit #" value={tenantData.unit} variant="auto" />
            </div>
            <FormField label="Tenant name" value={tenantData.tenantName} variant="auto" fullWidth />
            <FormField label="Co-tenant / co-signer" value={tenantData.coTenant || ''} variant={tenantData.coTenant ? 'auto' : 'empty'} fullWidth />
            <FormField label="Forwarding address" value={fwdAddr} variant="auto" fullWidth />

            {/* Move-in inspection badge */}
            <div>
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium ${
                tenantData.inspectionStatus === 'signed'
                  ? 'bg-[#e3f5e6] text-[#1a7a3a]'
                  : 'bg-[#fceae8] text-[#b3261e]'
              }`}>
                {tenantData.inspectionStatus === 'signed'
                  ? '📋 Move-in inspection: signed · 6 photos on file'
                  : '⚠ Move-in inspection: missing'}
              </span>
            </div>

            {/* Lease summary */}
            <SectionDivider>Lease summary</SectionDivider>
            <div className="grid grid-cols-4 gap-1">
              <FormField label="Monthly rent" value={formatCurrency(tenantData.monthlyRent)} variant="auto" />
              <FormField label="Security dep." value={formatCurrency(depositData.securityDeposit)} variant="auto" />
              <FormField label="NRC cleaning" value={formatCurrency(depositData.nrcCleaningFee)} variant="auto" />
              <FormField label="Utility type" value={utilityData.utilityType === 'RUBS' ? 'RUBS' : 'Flat fee'} variant="auto" />
            </div>
            <div className="grid grid-cols-4 gap-1">
              <FormField label="Move-in" value={tenantData.moveInDate} variant="auto" />
              <FormField label="Move-out" value={tenantData.moveOutDate} variant="auto" />
              <FormField
                label="Lease break"
                value={tenantData.leaseBreak ? 'Yes' : 'No'}
                variant={tenantData.leaseBreak ? 'calc' : 'auto'}
              />
              <FormField
                label="New tenant in"
                value={tenantData.newTenantMoveInDate || (tenantData.leaseBreak ? tenantData.leaseEndDate : '—')}
                variant={tenantData.leaseBreak ? 'calc' : 'auto'}
              />
            </div>
            {/* Extra lease dates */}
            <div className="grid grid-cols-3 gap-1">
              <FormField label="Paid through" value={tenantData.paidThroughDate || '—'} variant={tenantData.paidThroughDate ? 'auto' : 'empty'} />
              <FormField label="Notice date" value={tenantData.noticeDate || '—'} variant={tenantData.noticeDate ? 'auto' : 'empty'} />
              <FormField label="Lease end" value={tenantData.leaseEndDate} variant="auto" />
            </div>

            {/* Turnover charges section */}
            <SectionDivider>Turnover charges</SectionDivider>

            {/* Utility tag */}
            {calculatedCharges.utilityCharge > 0 && (
              <div>
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium mb-1 ${
                  utilityData.utilityType === 'RUBS'
                    ? 'bg-[#e6efff] text-[#1858b8]'
                    : 'bg-[#e3f5e6] text-[#1a7a3a]'
                }`}>
                  🔵 {utilityData.utilityType === 'RUBS' ? 'RUBS' : 'Flat fee'} {formatCurrency(calculatedCharges.utilityCharge)} applied
                </span>
              </div>
            )}

            {/* Charges table: Item | Total cost | Tenant cost */}
            <table className="w-full text-[11px] border-collapse" style={{ tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  <th className="text-left text-[9px] font-semibold text-[#9b9b99] pb-1 border-b border-[#e8e7e4]">Item</th>
                  <th className="text-right text-[9px] font-semibold text-[#9b9b99] pb-1 border-b border-[#e8e7e4]">Total cost</th>
                  <th className="text-right text-[9px] font-semibold text-[#9b9b99] pb-1 border-b border-[#e8e7e4]">Tenant cost</th>
                </tr>
              </thead>
              <tbody>
                {calculatedCharges.rentDue > 0 && (
                  <tr>
                    <td className="py-1 border-b border-[#f1f1ef] text-[#6b6b6a]">
                      Rent due ({Math.round(calculatedCharges.rentDue / dailyRate)} days pro-rated)
                    </td>
                    <td className="py-1 border-b border-[#f1f1ef] text-right font-medium text-[#1858b8]">
                      {formatCurrency(calculatedCharges.rentDue)}
                    </td>
                    <td className="py-1 border-b border-[#f1f1ef] text-right font-medium text-[#1858b8]">
                      {formatCurrency(calculatedCharges.rentDue)}
                    </td>
                  </tr>
                )}
                {calculatedCharges.utilityCharge > 0 && (
                  <tr>
                    <td className="py-1 border-b border-[#f1f1ef] text-[#6b6b6a]">
                      {utilityData.utilityType === 'RUBS'
                        ? `RUBS chargeback (${formatCurrency(utilityData.rubsBuildingTotal)} × ${(utilityData.rubsUnitRatio * 100).toFixed(1)}%)`
                        : 'Flat fee utility'}
                    </td>
                    <td className="py-1 border-b border-[#f1f1ef] text-right font-medium text-[#1858b8]">
                      {formatCurrency(calculatedCharges.utilityCharge)}
                    </td>
                    <td className="py-1 border-b border-[#f1f1ef] text-right font-medium text-[#1858b8]">
                      {formatCurrency(calculatedCharges.utilityCharge)}
                    </td>
                  </tr>
                )}
                <tr>
                  <td className="py-1 border-b border-[#f1f1ef] text-[#6b6b6a]">
                    Cleaning — NRC {formatCurrency(depositData.nrcCleaningFee)} offsets
                  </td>
                  <td className="py-1 border-b border-[#f1f1ef] text-right text-[#8b6a00]">
                    {formatCurrency(manualCharges.generalCleaning)}
                  </td>
                  <td className="py-1 border-b border-[#f1f1ef] text-right text-[#8b6a00]">
                    {formatCurrency(tenantCleaning)}
                  </td>
                </tr>
                <tr>
                  <td className="py-1 border-b border-[#f1f1ef] text-[#6b6b6a]">Painting touch-up</td>
                  <td className="py-1 border-b border-[#f1f1ef] text-right text-[#8b6a00]">
                    {formatCurrency(manualCharges.painting)}
                  </td>
                  <td className="py-1 border-b border-[#f1f1ef] text-right text-[#8b6a00]">
                    {formatCurrency(manualCharges.painting)}
                  </td>
                </tr>
                {manualCharges.carpetShampooing > 0 && (
                  <tr>
                    <td className="py-1 border-b border-[#f1f1ef] text-[#6b6b6a]">Carpet / flooring</td>
                    <td className="py-1 border-b border-[#f1f1ef] text-right text-[#8b6a00]">
                      {formatCurrency(manualCharges.carpetShampooing)}
                    </td>
                    <td className="py-1 border-b border-[#f1f1ef] text-right text-[#8b6a00]">
                      {formatCurrency(manualCharges.carpetShampooing)}
                    </td>
                  </tr>
                )}
                {manualCharges.other1 > 0 && (
                  <tr>
                    <td className="py-1 border-b border-[#f1f1ef] text-[#6b6b6a]">
                      {manualCharges.other1Label || 'Other (key replacement)'}
                    </td>
                    <td className="py-1 border-b border-[#f1f1ef] text-right text-[#8b6a00]">
                      {formatCurrency(manualCharges.other1)}
                    </td>
                    <td className="py-1 border-b border-[#f1f1ef] text-right text-[#8b6a00]">
                      {formatCurrency(manualCharges.other1)}
                    </td>
                  </tr>
                )}
                {/* Total row */}
                <tr className="bg-white">
                  <td className="py-1.5 font-bold text-[#1a1a19]">Total charges</td>
                  <td className="py-1.5 text-right font-bold text-[#1a1a19]">{formatCurrency(totalCharges)}</td>
                  <td className="py-1.5 text-right font-bold text-[#1a1a19]">{formatCurrency(totalCharges)}</td>
                </tr>
              </tbody>
            </table>

            {/* Balance totals */}
            <div className="grid grid-cols-2 gap-1.5 mt-1">
              <div className={`rounded-[6px] p-2.5 border ${
                dueToTenant > 0 ? 'bg-[#e3f5e6] border-[#1a7a3a]/40' : 'bg-[#f7f6f3] border-[#e8e7e4]'
              }`}>
                <p className="text-[9px] text-[#9b9b99] mb-0.5">Balance due to tenant</p>
                <p className={`text-[15px] font-bold ${dueToTenant > 0 ? 'text-[#1a7a3a]' : 'text-[#9b9b99]'}`}>
                  {formatCurrency(dueToTenant)}
                </p>
              </div>
              <div className={`rounded-[6px] p-2.5 border ${
                owingLandlord > 0 ? 'bg-[#fceae8] border-[#b3261e]/40' : 'bg-[#f7f6f3] border-[#e8e7e4]'
              }`}>
                <p className="text-[9px] text-[#9b9b99] mb-0.5">Balance owing landlord</p>
                <p className={`text-[15px] font-bold ${owingLandlord > 0 ? 'text-[#b3261e]' : 'text-[#9b9b99]'}`}>
                  {formatCurrency(owingLandlord)}
                </p>
              </div>
            </div>
          </div>

          {/* Legend — color key */}
          <div className="flex gap-4 flex-wrap px-4 py-2 border-t border-[#e8e7e4] bg-white shrink-0">
            {[
              { color: 'bg-[#1a7a3a]', label: 'Auto-filled (editable)' },
              { color: 'bg-[#1858b8]', label: 'Calculated' },
              { color: 'bg-[#8b6a00]', label: 'Manual entry' },
            ].map(({ color, label }) => (
              <div key={label} className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-sm ${color}`} />
                <span className="text-[10px] text-[#9b9b99]">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
