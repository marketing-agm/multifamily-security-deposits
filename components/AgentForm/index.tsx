// components/AgentForm/index.tsx
// Screen 2 — Return form (redesigned)
//
// Layout has 4 vertical panels side by side:
//   [Icon rail] [Slide panel] [Controls — charges & calculations] [Live form preview]
//
// The "icon rail" is a narrow left sidebar with icons for each section.
// Clicking an icon opens the "slide panel" (tenant info, inspection, etc.).
// The controls panel lets you enter or adjust charges.
// The live form panel shows the AGM Checkout Report filling in as you work.
//
// This replaces the old chat-based interface.

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/context/SessionContext';
import { formatCurrency } from '@/lib/calculations';
import { TenantReturn } from '@/types';

// STEP_LABELS: progress bar at the top of the page.
// These match the 5-step workflow from the HTML mockup.
const STEP_LABELS = ['1. Upload', '2. Select', '3. Form', '4. Review', '5. Download'];
const CURRENT_STEP = 2; // zero-indexed; step 3 = index 2

// TOTAL_FIELDS: the AGM Checkout Report PDF has 72 fillable fields.
const TOTAL_FIELDS = 72;

// --- Icon rail section types ---
// Each icon in the rail corresponds to one view in the slide panel.
type RailSection = 'tenant' | 'inspection' | 'rates' | 'notes';

interface Props {
  returnId: string;
}

// ============================================================
// ChargeInput: a labeled number input used in the charges grid.
// "label" is the field name, "value" is the current number,
// "onChange" is called when the user types a new value.
// "highlighted" makes the field amber (like a manual entry) when true.
// ============================================================
function ChargeInput({
  label,
  value,
  onChange,
  highlighted = false,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  highlighted?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] text-[#9b9b99]">{label}</label>
      <input
        type="number"
        min={0}
        step={0.01}
        value={value || ''}
        placeholder="0"
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
        className={`h-7 text-xs px-2 rounded-[4px] border w-full ${
          highlighted && value > 0
            ? 'bg-[#fdf3da] border-[#8b6a00] text-[#8b6a00]'
            : 'bg-white border-[#e8e7e4] text-[#1a1a19]'
        }`}
      />
    </div>
  );
}

// ============================================================
// FormField: a read-only display field in the live form preview.
// variant colors match the AGM field-color legend:
//   auto = green (came from Excel), calc = blue (calculated),
//   manual = amber (typed by user), empty = gray placeholder
// ============================================================
function FormField({
  label,
  value,
  variant = 'empty',
}: {
  label: string;
  value: string;
  variant?: 'auto' | 'calc' | 'manual' | 'empty';
}) {
  const styles: Record<string, string> = {
    auto:   'bg-[#e3f5e6] border-[#1a7a3a] text-[#1a7a3a]',
    calc:   'bg-[#e6efff] border-[#1858b8] text-[#1858b8] font-medium',
    manual: 'bg-[#fdf3da] border-[#8b6a00] text-[#8b6a00]',
    empty:  'bg-[#f7f6f3] border-[#e8e7e4] text-[#9b9b99] italic',
  };
  return (
    <div className="flex flex-col gap-0.5">
      <label className="text-[9px] text-[#9b9b99]">{label}</label>
      <div className={`text-[11px] h-[22px] px-1.5 flex items-center rounded-[3px] border w-full ${styles[variant]}`}>
        {value || '—'}
      </div>
    </div>
  );
}

// ============================================================
// SectionLabel: a small uppercase divider label used in the live form.
// ============================================================
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[9px] font-semibold text-[#9b9b99] uppercase tracking-[0.05em] border-b border-[#eeeeec] pb-0.5 mt-3 mb-1">
      {children}
    </div>
  );
}

export function AgentForm({ returnId }: Props) {
  const { session, updateReturn } = useSession();
  const router = useRouter();

  // activeSection: which slide panel is open. null = panel collapsed.
  const [activeSection, setActiveSection] = useState<RailSection | null>('tenant');

  const trMaybe = session?.returns.find(r => r.id === returnId);

  if (!session || !trMaybe) {
    router.replace('/dashboard');
    return null;
  }

  // After the guard above, trMaybe is guaranteed non-null.
  // We reassign to `tr` so TypeScript knows it's a TenantReturn everywhere below.
  const tr: TenantReturn = trMaybe;

  const { tenantData, depositData, utilityData, calculatedCharges, manualCharges } = tr;

  // NRC = Non-Refundable Cleaning fee paid at move-in.
  // It offsets the cleaning charge — tenant only pays the excess above NRC.
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

  // filledCount: rough estimate of how many fields are filled.
  // Starts at 14 (basic auto-fills), goes up as manual charges are entered.
  const filledCount = Math.min(
    TOTAL_FIELDS,
    14 +
      (calculatedCharges.rentDue > 0 ? 4 : 0) +
      (calculatedCharges.utilityCharge > 0 ? 3 : 0) +
      (manualCharges.generalCleaning > 0 ? 2 : 0) +
      (manualCharges.carpetShampooing > 0 ? 2 : 0) +
      (manualCharges.painting > 0 ? 2 : 0) +
      (manualCharges.other1 > 0 ? 2 : 0),
  );

  // toggleSection: clicking the same icon again collapses the panel.
  function toggleSection(section: RailSection) {
    setActiveSection(prev => prev === section ? null : section);
  }

  // updateManual: updates one manual charge field.
  // Uses spread (...) to keep all other fields the same, like Object.assign() in Java.
  function updateManual(field: keyof typeof manualCharges, value: number) {
    updateReturn(tr.id, {
      manualCharges: { ...manualCharges, [field]: value },
    });
  }

  // handleContinue: marks this return as in-progress and goes to the Review screen.
  function handleContinue() {
    updateReturn(tr.id, { processingStatus: 'in_progress' });
    router.push(`/review/${encodeURIComponent(tr.id)}`);
  }

  // RailIcon: one button in the left icon rail.
  // "flagged" = amber background (something needs attention).
  // "active" = blue background (currently selected).
  function RailIcon({
    section,
    icon,
    label,
    flagged = false,
    dot = false,
  }: {
    section: RailSection;
    icon: string;
    label: string;
    flagged?: boolean;
    dot?: boolean;
  }) {
    const isActive = activeSection === section;
    return (
      <button
        title={label}
        onClick={() => toggleSection(section)}
        className={`w-10 h-10 rounded-[6px] flex flex-col items-center justify-center gap-0.5 border relative transition-colors ${
          flagged
            ? 'bg-[#fdf3da] border-[#e8c840]/40'
            : isActive
            ? 'bg-[#e6efff] border-[#2383e2]/40'
            : 'bg-transparent border-transparent hover:bg-[#f1f1ef] hover:border-[#e8e7e4]'
        }`}
      >
        <span className={`text-[18px] leading-none ${flagged ? 'text-[#8b6a00]' : isActive ? 'text-[#1858b8]' : 'text-[#9b9b99]'}`}>
          {icon}
        </span>
        <span className={`text-[9px] ${flagged ? 'text-[#8b6a00]' : isActive ? 'text-[#1858b8]' : 'text-[#9b9b99]'}`}>
          {label}
        </span>
        {dot && (
          // Small orange dot signals a flag/issue on this section
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#f0a500] border border-white" />
        )}
      </button>
    );
  }

  return (
    // h-screen + overflow-hidden = the whole page stays viewport-height, panels scroll internally.
    <div className="h-screen flex flex-col bg-[#fbfbfa] overflow-hidden">

      {/* ── Top nav bar ── */}
      <div className="bg-white border-b border-[#e8e7e4] px-4 py-2 flex items-center justify-between shrink-0">

        {/* Left: back link + tenant name */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/dashboard')}
            className="text-[12px] text-[#2383e2] flex items-center gap-1 hover:underline"
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
              {tenantData.leaseBreak ? ' · Lease break' : ''}
            </p>
          </div>
        </div>

        {/* Center: step progress bar */}
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

        {/* Right: continue button */}
        <button
          onClick={handleContinue}
          className="px-4 py-1.5 text-sm font-medium bg-[#1a1a19] text-white rounded-[6px] hover:bg-[#333]"
        >
          Continue to review →
        </button>
      </div>

      {/* ── Main 4-panel layout ── */}
      {/* flex-1 takes all remaining height; overflow-hidden prevents page scroll */}
      <div className="flex-1 flex overflow-hidden">

        {/* ── 1. Icon rail ── */}
        {/* Narrow left sidebar — 52px wide. Each icon button opens the slide panel. */}
        <div className="w-[52px] bg-white border-r border-[#e8e7e4] flex flex-col items-center py-2.5 gap-1 shrink-0">
          <RailIcon
            section="inspection"
            icon="📷"
            label="Photos"
            flagged={tenantData.inspectionStatus === 'missing'}
            dot={tenantData.inspectionStatus === 'missing'}
          />
          <RailIcon section="tenant" icon="👤" label="Tenant" />
          <RailIcon section="rates" icon="🧾" label="Rates" />
          {/* Divider line between main sections and notes */}
          <div className="w-7 border-t border-[#e8e7e4] my-1" />
          <RailIcon section="notes" icon="📝" label="Notes" />
        </div>

        {/* ── 2. Slide panel ── */}
        {/* Appears when a rail icon is active. 220px wide. Scrollable inside. */}
        {activeSection && (
          <div className="w-[220px] border-r border-[#e8e7e4] bg-white flex flex-col shrink-0">
            {/* Panel header */}
            <div className="px-3 py-2.5 border-b border-[#e8e7e4] flex items-center justify-between shrink-0">
              <span className="text-[11px] font-semibold text-[#1a1a19]">
                {activeSection === 'tenant' && '👤 Tenant details'}
                {activeSection === 'inspection' && '📷 Inspection'}
                {activeSection === 'rates' && '🧾 Rates'}
                {activeSection === 'notes' && '📝 Notes'}
              </span>
              <button
                onClick={() => setActiveSection(null)}
                className="w-5 h-5 rounded-[4px] border border-[#e8e7e4] flex items-center justify-center text-[#9b9b99] hover:bg-[#f1f1ef] text-xs"
              >
                ✕
              </button>
            </div>

            {/* Panel body — scrollable */}
            <div className="flex-1 overflow-y-auto p-2.5 space-y-3">

              {/* TENANT section: lease info card */}
              {activeSection === 'tenant' && (
                <>
                  <div className="text-[10px] font-semibold text-[#9b9b99] uppercase tracking-[0.05em]">Lease</div>
                  <div className="bg-[#f7f6f3] border border-[#e8e7e4] rounded-[6px] overflow-hidden">
                    {[
                      ['Name', tenantData.tenantName],
                      ['Unit', tenantData.unit],
                      ['Rent', formatCurrency(tenantData.monthlyRent) + '/mo'],
                      ['Deposit', formatCurrency(depositData.securityDeposit)],
                      ['NRC', formatCurrency(depositData.nrcCleaningFee)],
                      ['Move-in', tenantData.moveInDate],
                      ['Move-out', tenantData.moveOutDate],
                      ['Lease end', tenantData.leaseEndDate],
                      ['New tenant', tenantData.newTenantMoveInDate || '—'],
                      ['Utility', utilityData.utilityType === 'RUBS' ? 'RUBS' : 'Flat fee'],
                    ].map(([label, val]) => (
                      <div key={label} className="flex justify-between px-2.5 py-1.5 border-b border-[#e8e7e4] last:border-b-0">
                        <span className="text-[11px] text-[#9b9b99]">{label}</span>
                        <span className="text-[11px] font-medium text-[#1a1a19]">{val}</span>
                      </div>
                    ))}
                  </div>
                  {tenantData.leaseBreak && (
                    <div className="bg-[#fdf3da] border border-[#e8c840]/40 rounded-[6px] px-2.5 py-2 text-[11px] text-[#8b6a00]">
                      <div className="font-semibold mb-0.5">⚠ Lease break detected</div>
                      Tenant moved out before lease ended. Rent due until new tenant or lease end.
                    </div>
                  )}
                </>
              )}

              {/* INSPECTION section: move-in vs move-out status */}
              {activeSection === 'inspection' && (
                <>
                  <div className="text-[10px] font-semibold text-[#9b9b99] uppercase tracking-[0.05em]">Inspection status</div>
                  <div className="grid grid-cols-2 gap-2">
                    {/* Move-in inspection */}
                    <div className="flex flex-col gap-1">
                      <div className="text-[9px] text-[#9b9b99] font-semibold">Move-in</div>
                      <div
                        className={`aspect-video rounded-[4px] border flex items-center justify-center text-2xl ${
                          tenantData.inspectionStatus === 'signed'
                            ? 'bg-[#e3f5e6] border-[#1a7a3a]/40'
                            : 'bg-[#fceae8] border-[#b3261e]/40'
                        }`}
                      >
                        🏠
                        <span
                          className={`absolute bottom-1 left-1 text-[9px] px-1 py-0.5 rounded-full ${
                            tenantData.inspectionStatus === 'signed'
                              ? 'bg-[#1a7a3a] text-white'
                              : 'bg-[#b3261e] text-white'
                          }`}
                        >
                          {tenantData.inspectionStatus === 'signed' ? '✓ Signed' : '⚠ Missing'}
                        </span>
                      </div>
                    </div>
                    {/* Move-out inspection placeholder */}
                    <div className="flex flex-col gap-1">
                      <div className="text-[9px] text-[#9b9b99] font-semibold">Move-out</div>
                      <div className="aspect-video rounded-[4px] border bg-[#f7f6f3] border-[#e8e7e4] flex items-center justify-center text-2xl relative">
                        🔑
                      </div>
                    </div>
                  </div>
                  {tenantData.inspectionStatus === 'missing' && (
                    <div className="bg-[#fceae8] border border-[#b3261e]/20 rounded-[6px] px-2.5 py-2 text-[11px] text-[#b3261e]">
                      <div className="font-semibold mb-0.5">Move-in inspection missing</div>
                      Without a signed inspection, deducting for damage is legally risky. Consult your manager.
                    </div>
                  )}
                </>
              )}

              {/* RATES section: RUBS or flat fee billing details */}
              {activeSection === 'rates' && (
                <>
                  <div className="text-[10px] font-semibold text-[#9b9b99] uppercase tracking-[0.05em]">
                    {utilityData.utilityType === 'RUBS' ? 'RUBS billing' : 'Flat fee billing'}
                  </div>
                  {utilityData.utilityType === 'RUBS' ? (
                    <div className="space-y-1.5">
                      {[
                        ['Building total', formatCurrency(utilityData.rubsBuildingTotal)],
                        ['Unit share', (utilityData.rubsUnitRatio * 100).toFixed(1) + '%'],
                        ['Chargeback', formatCurrency(calculatedCharges.utilityCharge)],
                      ].map(([label, val]) => (
                        <div key={label} className="flex justify-between px-2 py-1.5 bg-[#f7f6f3] rounded-[4px] border border-[#e8e7e4]">
                          <span className="text-[11px] text-[#6b6b6a]">{label}</span>
                          <span className="text-[11px] font-semibold text-[#1a1a19]">{val}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {[
                        ['Rate', formatCurrency(utilityData.flatFeeRate) + '/mo'],
                        ['Billing', utilityData.flatFeeBillingMethod === 'included_in_rent' ? 'Included in rent' : 'Billed at move-out'],
                        ['Charge', formatCurrency(calculatedCharges.utilityCharge)],
                      ].map(([label, val]) => (
                        <div key={label} className="flex justify-between px-2 py-1.5 bg-[#f7f6f3] rounded-[4px] border border-[#e8e7e4]">
                          <span className="text-[11px] text-[#6b6b6a]">{label}</span>
                          <span className="text-[11px] font-semibold text-[#1a1a19]">{val}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* NOTES section: placeholder */}
              {activeSection === 'notes' && (
                <>
                  <div className="text-[10px] font-semibold text-[#9b9b99] uppercase tracking-[0.05em]">Case notes</div>
                  <div className="bg-[#f7f6f3] border border-[#e8e7e4] rounded-[6px] p-2.5 text-[11px] text-[#9b9b99] italic">
                    No notes yet. Add case notes here.
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── 3. Controls panel (left half of split) ── */}
        {/* Charges & calculations — auto-calculated values shown as cards, manual ones as inputs. */}
        <div className="flex-1 border-r border-[#e8e7e4] flex flex-col overflow-hidden bg-white">
          {/* Panel header */}
          <div className="px-3 py-2 border-b border-[#e8e7e4] flex items-center justify-between bg-white shrink-0">
            <span className="text-[11px] font-semibold text-[#6b6b6a] flex items-center gap-1.5">
              ⚙ Charges &amp; calculations
            </span>
            <span className="text-[10px] text-[#1a7a3a]">{filledCount} / {TOTAL_FIELDS} fields</span>
          </div>

          {/* Scrollable charges body */}
          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">

            {/* RUBS chargeback card — calculated automatically from utility data */}
            {utilityData.utilityType === 'RUBS' && calculatedCharges.utilityCharge > 0 && (
              <div>
                <div className="text-[10px] font-semibold text-[#9b9b99] uppercase tracking-[0.05em] mb-1.5">RUBS chargeback</div>
                <div className="bg-[#e6efff] border border-[#2383e2]/30 rounded-[6px] p-2.5">
                  {[
                    ['Building water bill', formatCurrency(utilityData.rubsBuildingTotal)],
                    [`Unit ${tenantData.unit} share`, (utilityData.rubsUnitRatio * 100).toFixed(1) + '%'],
                    ['Chargeback', formatCurrency(calculatedCharges.utilityCharge)],
                  ].map(([label, val]) => (
                    <div key={label} className="flex justify-between text-[12px] py-0.5 border-b border-[#2383e2]/15 last:border-b-0">
                      <span className="text-[#6b6b6a]">{label}</span>
                      <span className="font-semibold text-[#1858b8]">{val}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Flat fee utility card */}
            {utilityData.utilityType === 'flat_fee' && calculatedCharges.utilityCharge > 0 && (
              <div>
                <div className="text-[10px] font-semibold text-[#9b9b99] uppercase tracking-[0.05em] mb-1.5">Flat fee utility</div>
                <div className="bg-[#e3f5e6] border border-[#1a7a3a]/30 rounded-[6px] p-2.5">
                  <div className="flex justify-between text-[12px]">
                    <span className="text-[#6b6b6a]">Charge</span>
                    <span className="font-semibold text-[#1a7a3a]">{formatCurrency(calculatedCharges.utilityCharge)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Lease break — rent due card */}
            {tenantData.leaseBreak && calculatedCharges.rentDue > 0 && (
              <div>
                <div className="text-[10px] font-semibold text-[#9b9b99] uppercase tracking-[0.05em] mb-1.5">Lease break — rent due</div>
                <div className="bg-[#e3f5e6] border border-[#1a7a3a]/30 rounded-[6px] p-2.5">
                  {[
                    ['Daily rate', formatCurrency(tenantData.monthlyRent / 30) + '/day'],
                    ['Period', calculatedCharges.rentDueDateRange || '—'],
                    ['Rent due', formatCurrency(calculatedCharges.rentDue)],
                  ].map(([label, val]) => (
                    <div key={label} className="flex justify-between text-[12px] py-0.5 border-b border-[#1a7a3a]/15 last:border-b-0">
                      <span className="text-[#6b6b6a]">{label}</span>
                      <span className="font-semibold text-[#1a7a3a]">{val}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Turnover charges — manual inputs */}
            <div>
              <div className="text-[10px] font-semibold text-[#9b9b99] uppercase tracking-[0.05em] mb-1.5">
                Turnover charges — enter or edit
              </div>
              <div className="border border-[#e8e7e4] rounded-[6px] p-2.5">
                <div className="grid grid-cols-2 gap-2">
                  {/* Cleaning: NRC (non-refundable cleaning fee) auto-offsets this */}
                  <ChargeInput
                    label={`Cleaning (NRC covers ${formatCurrency(depositData.nrcCleaningFee)})`}
                    value={manualCharges.generalCleaning}
                    onChange={v => updateManual('generalCleaning', v)}
                    highlighted={manualCharges.generalCleaning > 0}
                  />
                  <ChargeInput
                    label="Carpet / flooring ($)"
                    value={manualCharges.carpetShampooing}
                    onChange={v => updateManual('carpetShampooing', v)}
                    highlighted={manualCharges.carpetShampooing > 0}
                  />
                  <ChargeInput
                    label="Painting ($)"
                    value={manualCharges.painting}
                    onChange={v => updateManual('painting', v)}
                    highlighted={manualCharges.painting > 0}
                  />
                  <ChargeInput
                    label={manualCharges.other1Label || 'Other ($)'}
                    value={manualCharges.other1}
                    onChange={v => updateManual('other1', v)}
                    highlighted={manualCharges.other1 > 0}
                  />
                </div>
                <p className="text-[10px] text-[#9b9b99] mt-2">All fields editable — auto-filled values can be changed</p>
              </div>
            </div>

            {/* Balance summary */}
            <div>
              <div className="text-[10px] font-semibold text-[#9b9b99] uppercase tracking-[0.05em] mb-1.5">Balance summary</div>
              <div className="border border-[#e8e7e4] rounded-[6px] p-2.5">
                {[
                  { label: 'Total credits', val: formatCurrency(totalCredits), color: 'text-[#1a7a3a]' },
                  { label: 'Total charges', val: formatCurrency(totalCharges), color: 'text-[#b3261e]' },
                  {
                    label: balance >= 0 ? 'Balance due to tenant' : 'Balance owing landlord',
                    val: formatCurrency(Math.abs(balance)),
                    color: balance >= 0 ? 'text-[#1a7a3a]' : 'text-[#b3261e]',
                  },
                ].map(({ label, val, color }) => (
                  <div key={label} className="flex justify-between text-[12px] py-0.5 border-b border-[#eeeeec] last:border-b-0">
                    <span className="text-[#6b6b6a]">{label}</span>
                    <span className={`font-semibold ${color}`}>{val}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Continue button — pinned to bottom of controls panel */}
          <div className="px-3 py-2.5 border-t border-[#e8e7e4] shrink-0">
            <button
              onClick={handleContinue}
              className="w-full py-2 text-[12px] font-semibold bg-[#1a1a19] text-white rounded-[6px] hover:bg-[#333] transition-colors"
            >
              Continue to review →
            </button>
          </div>
        </div>

        {/* ── 4. Live form preview (right half of split) ── */}
        {/* Shows the AGM Checkout Report form filling in as values are entered. */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[#f7f6f3]">
          {/* Panel header */}
          <div className="px-3 py-2 border-b border-[#e8e7e4] flex items-center justify-between bg-white shrink-0">
            <span className="text-[11px] font-semibold text-[#6b6b6a] flex items-center gap-1.5">
              📄 AGM Checkout Report
            </span>
            <span className="text-[10px] text-[#9b9b99]">{filledCount} / {TOTAL_FIELDS} fields</span>
          </div>

          {/* Scrollable live form */}
          <div className="flex-1 overflow-y-auto px-3 py-2">
            {/* Form title */}
            <p className="text-[11px] font-semibold text-center text-[#6b6b6a] border-b border-[#eeeeec] pb-1.5 mb-2 tracking-[0.04em]">
              Checkout Report · AGM Real Estate
            </p>

            {/* Header fields */}
            <div className="grid grid-cols-2 gap-1.5 mb-1.5">
              <FormField label="Property name" value={session.propertyName || 'Westlake Commons'} variant="auto" />
              <FormField label="Unit #" value={tenantData.unit} variant="auto" />
            </div>
            <div className="mb-1.5">
              <FormField label="Tenant name" value={tenantData.tenantName} variant="auto" />
            </div>
            <div className="mb-1.5">
              <FormField label="Forwarding address" value={fwdAddr} variant="auto" />
            </div>

            {/* Inspection badge */}
            <div className="mb-1.5">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                tenantData.inspectionStatus === 'signed'
                  ? 'bg-[#e3f5e6] text-[#1a7a3a]'
                  : 'bg-[#fceae8] text-[#b3261e]'
              }`}>
                {tenantData.inspectionStatus === 'signed' ? '✓ Move-in inspection: signed' : '⚠ Move-in inspection: missing'}
              </span>
            </div>

            <SectionLabel>Lease summary</SectionLabel>
            <div className="grid grid-cols-4 gap-1 mb-1.5">
              <FormField label="Monthly rent" value={formatCurrency(tenantData.monthlyRent)} variant="auto" />
              <FormField label="Security dep." value={formatCurrency(depositData.securityDeposit)} variant="auto" />
              <FormField label="NRC" value={formatCurrency(depositData.nrcCleaningFee)} variant="auto" />
              <FormField label="Utility" value={utilityData.utilityType === 'RUBS' ? 'RUBS' : 'Flat fee'} variant="auto" />
            </div>
            <div className="grid grid-cols-3 gap-1 mb-1.5">
              <FormField label="Move-in" value={tenantData.moveInDate} variant="auto" />
              <FormField label="Move-out" value={tenantData.moveOutDate} variant="auto" />
              <FormField
                label="New tenant in"
                value={tenantData.newTenantMoveInDate || (tenantData.leaseBreak ? tenantData.leaseEndDate : '—')}
                variant={tenantData.leaseBreak ? 'calc' : 'auto'}
              />
            </div>

            {/* Charges section — table format */}
            <SectionLabel>Charges</SectionLabel>

            {/* Utility tag */}
            {calculatedCharges.utilityCharge > 0 && (
              <div className="mb-1.5">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                  utilityData.utilityType === 'RUBS'
                    ? 'bg-[#e6efff] text-[#1858b8]'
                    : 'bg-[#e3f5e6] text-[#1a7a3a]'
                }`}>
                  {utilityData.utilityType === 'RUBS' ? 'RUBS' : 'Flat fee'} {formatCurrency(calculatedCharges.utilityCharge)} applied
                </span>
              </div>
            )}

            {/* Charges table: Item | Total cost | Tenant cost */}
            <table className="w-full text-[11px] border-collapse mb-2" style={{ tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  <th className="text-left text-[9px] font-semibold text-[#9b9b99] pb-1 border-b border-[#eeeeec]">Item</th>
                  <th className="text-right text-[9px] font-semibold text-[#9b9b99] pb-1 border-b border-[#eeeeec]">Total cost</th>
                  <th className="text-right text-[9px] font-semibold text-[#9b9b99] pb-1 border-b border-[#eeeeec]">Tenant cost</th>
                </tr>
              </thead>
              <tbody>
                {/* Rent due (lease break) */}
                {calculatedCharges.rentDue > 0 && (
                  <tr>
                    <td className="py-1 border-b border-[#eeeeec] text-[#6b6b6a]">Rent due (pro-rated)</td>
                    <td className="py-1 border-b border-[#eeeeec] text-right font-medium text-[#1858b8]">{formatCurrency(calculatedCharges.rentDue)}</td>
                    <td className="py-1 border-b border-[#eeeeec] text-right font-medium text-[#1858b8]">{formatCurrency(calculatedCharges.rentDue)}</td>
                  </tr>
                )}
                {/* Utility */}
                {calculatedCharges.utilityCharge > 0 && (
                  <tr>
                    <td className="py-1 border-b border-[#eeeeec] text-[#6b6b6a]">Utility ({utilityData.utilityType === 'RUBS' ? 'RUBS' : 'Flat fee'})</td>
                    <td className="py-1 border-b border-[#eeeeec] text-right font-medium text-[#1858b8]">{formatCurrency(calculatedCharges.utilityCharge)}</td>
                    <td className="py-1 border-b border-[#eeeeec] text-right font-medium text-[#1858b8]">{formatCurrency(calculatedCharges.utilityCharge)}</td>
                  </tr>
                )}
                {/* Cleaning (NRC offsets this) */}
                <tr>
                  <td className="py-1 border-b border-[#eeeeec] text-[#6b6b6a]">Cleaning (NRC −{formatCurrency(nrcOffset)})</td>
                  <td className="py-1 border-b border-[#eeeeec] text-right text-[#8b6a00]">{formatCurrency(manualCharges.generalCleaning)}</td>
                  <td className="py-1 border-b border-[#eeeeec] text-right text-[#8b6a00]">{formatCurrency(tenantCleaning)}</td>
                </tr>
                {/* Carpet */}
                <tr>
                  <td className="py-1 border-b border-[#eeeeec] text-[#6b6b6a]">Carpet / flooring</td>
                  <td className="py-1 border-b border-[#eeeeec] text-right text-[#8b6a00]">{formatCurrency(manualCharges.carpetShampooing)}</td>
                  <td className="py-1 border-b border-[#eeeeec] text-right text-[#8b6a00]">{formatCurrency(manualCharges.carpetShampooing)}</td>
                </tr>
                {/* Painting */}
                <tr>
                  <td className="py-1 border-b border-[#eeeeec] text-[#6b6b6a]">Painting</td>
                  <td className="py-1 border-b border-[#eeeeec] text-right text-[#8b6a00]">{formatCurrency(manualCharges.painting)}</td>
                  <td className="py-1 border-b border-[#eeeeec] text-right text-[#8b6a00]">{formatCurrency(manualCharges.painting)}</td>
                </tr>
                {/* Other */}
                {(manualCharges.other1 > 0 || manualCharges.other2 > 0) && (
                  <tr>
                    <td className="py-1 border-b border-[#eeeeec] text-[#6b6b6a]">{manualCharges.other1Label || 'Other'}</td>
                    <td className="py-1 border-b border-[#eeeeec] text-right text-[#8b6a00]">{formatCurrency(manualCharges.other1 + manualCharges.other2)}</td>
                    <td className="py-1 border-b border-[#eeeeec] text-right text-[#8b6a00]">{formatCurrency(manualCharges.other1 + manualCharges.other2)}</td>
                  </tr>
                )}
                {/* Total row */}
                <tr className="bg-white">
                  <td className="py-1 font-semibold text-[#1a1a19]">Total charges</td>
                  <td className="py-1 text-right font-semibold text-[#1a1a19]">{formatCurrency(totalCharges)}</td>
                  <td className="py-1 text-right font-semibold text-[#1a1a19]">{formatCurrency(totalCharges)}</td>
                </tr>
              </tbody>
            </table>

            {/* Credits section */}
            <SectionLabel>Credits</SectionLabel>
            <div className="grid grid-cols-2 gap-1 mb-2">
              <FormField label="Security deposit" value={formatCurrency(depositData.securityDeposit)} variant="auto" />
              <FormField label="Total credits" value={formatCurrency(totalCredits)} variant="calc" />
            </div>

            {/* Balance totals */}
            <div className="grid grid-cols-2 gap-1.5 mt-1">
              <div className={`rounded-[4px] p-2 border ${
                dueToTenant > 0 ? 'bg-[#e3f5e6] border-[#1a7a3a]/40' : 'bg-[#f7f6f3] border-[#e8e7e4]'
              }`}>
                <div className="text-[9px] text-[#9b9b99] mb-0.5">Balance due to tenant</div>
                <div className={`text-[14px] font-semibold ${dueToTenant > 0 ? 'text-[#1a7a3a]' : 'text-[#9b9b99]'}`}>
                  {formatCurrency(dueToTenant)}
                </div>
              </div>
              <div className={`rounded-[4px] p-2 border ${
                owingLandlord > 0 ? 'bg-[#fceae8] border-[#b3261e]/40' : 'bg-[#f7f6f3] border-[#e8e7e4]'
              }`}>
                <div className="text-[9px] text-[#9b9b99] mb-0.5">Balance owing landlord</div>
                <div className={`text-[14px] font-semibold ${owingLandlord > 0 ? 'text-[#b3261e]' : 'text-[#9b9b99]'}`}>
                  {formatCurrency(owingLandlord)}
                </div>
              </div>
            </div>
          </div>

          {/* Legend — color key for the form field variants */}
          <div className="flex gap-3 flex-wrap px-3 py-2 border-t border-[#e8e7e4] bg-white shrink-0">
            {[
              { color: 'bg-[#1a7a3a]', label: 'Auto-filled (editable)' },
              { color: 'bg-[#1858b8]', label: 'Calculated' },
              { color: 'bg-[#8b6a00]', label: 'Manual entry' },
            ].map(({ color, label }) => (
              <div key={label} className="flex items-center gap-1">
                <div className={`w-1.5 h-1.5 rounded-sm ${color}`} />
                <span className="text-[10px] text-[#9b9b99]">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
