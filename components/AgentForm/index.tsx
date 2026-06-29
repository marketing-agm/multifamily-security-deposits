// components/AgentForm/index.tsx
// Return form — two-column layout.
//
// Layout (left to right):
//   [56px icon sidebar] | [300px tab content panel] | [flex-1 checkout form]
//
// The LEFT panel switches based on which tab is active:
//   📷 Photos  — move-in / move-out inspection status and photo grid
//   👤 Tenant  — tenant info, lease dates (lease break shown in RED)
//   🧾 Rates   — property rates, deposits, RUBS/flat-fee billing details
//   📝 Notes   — freeform notes textarea
//
// The RIGHT panel is ALWAYS the AGM Checkout Report form.
// It shows auto-filled read-only fields plus editable charge inputs.

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/context/SessionContext';
import { formatCurrency } from '@/lib/calculations';
import { TenantReturn } from '@/types';

const STEP_LABELS = ['1. Upload', '2. Select', '3. Form', '4. Review', '5. Download'];
const CURRENT_STEP = 2; // zero-indexed — "Form" is index 2
const TOTAL_FIELDS = 72;

// Which sidebar tab is showing in the left panel
type SidebarTab = 'photos' | 'tenant' | 'rates' | 'notes';

interface Props {
  returnId: string;
}

// ============================================================
// SidebarTabButton — one icon tab on the left strip.
// "flagged" = amber (needs attention), "active" = blue, idle = transparent.
// ============================================================
function SidebarTabButton({
  icon, label, active, flagged, dot, onClick,
}: {
  icon: string; label: string; active: boolean; flagged?: boolean; dot?: boolean; onClick: () => void;
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
        // Orange dot = something needs attention on this tab
        <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#f0a500] border-2 border-white" />
      )}
    </button>
  );
}

// ============================================================
// InfoRow — a label + value pair inside a panel card.
// highlight='red' makes the value stand out in red — used for lease break.
// ============================================================
function InfoRow({ label, value, highlight }: { label: string; value: string; highlight?: 'red' | 'amber' }) {
  return (
    <div className="flex justify-between px-2.5 py-1.5 border-b border-[#e8e7e4] last:border-b-0">
      <span className="text-[10px] text-[#9b9b99]">{label}</span>
      <span className={`text-[10px] font-medium text-right max-w-[55%] ${
        highlight === 'red' ? 'text-[#b3261e] font-semibold' :
        highlight === 'amber' ? 'text-[#8b6a00] font-semibold' :
        'text-[#1a1a19]'
      }`}>{value}</span>
    </div>
  );
}

// ============================================================
// FormDisplayField — editable input in the checkout form.
// Pre-filled from tenant data but the user can type to override it.
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
        className="h-[26px] text-[11px] px-2 rounded-[4px] border border-[#e8e7e4] text-[#1a1a19] focus:outline-none focus:border-[#2383e2] transition-colors"
        style={{ background: onChange ? '#fff' : '#f7f6f3', color: onChange ? '#1a1a19' : '#6b6b6a' }}
      />
    </div>
  );
}

// ============================================================
// ChargeInput — editable number field for manual charges.
// Turns amber when the user enters a non-zero value.
// ============================================================
function ChargeInput({
  label, value, onChange, note,
}: {
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

  // Default to "tenant" tab so something always shows on first load
  const [activeTab, setActiveTab] = useState<SidebarTab>('tenant');
  // Notes live in local state for this session — not saved to the session context
  const [notes, setNotes] = useState('');
  // formOverrides: editable field values. Start empty so the displayed value falls back to tenant data.
  // When the user types, their override is stored here.
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

  // NRC = Non-Refundable Cleaning fee (paid at move-in).
  // It offsets how much the tenant owes for general cleaning at move-out.
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

  // Daily rate used in the lease break calculation
  const dailyRate = tenantData.monthlyRent / 30;

  // Rough count of how many PDF fields have been filled in so far
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

        {/* Left: back button + tenant name */}
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
              {/* Lease break shown in red in the nav bar too */}
              {tenantData.leaseBreak && (
                <span className="text-[#b3261e] font-medium"> · Lease break</span>
              )}{' '}
              · {formatCurrency(depositData.securityDeposit)} deposit
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
          className="px-4 py-1.5 text-sm font-medium bg-[#1a1a19] text-white rounded-[6px] hover:bg-[#333] shrink-0"
        >
          Continue to review →
        </button>
      </div>

      {/* ── Main layout: [40% left: sidebar + tab panel] [60% right: checkout form] ── */}
      <div className="flex-1 flex overflow-hidden">

        {/* Left 40%: sidebar + tab panel together */}
        <div className="flex shrink-0 overflow-hidden" style={{ width: '40%' }}>

        {/* ══════════════════════════════════════════
            SIDEBAR — 56px strip of icon tabs.
            Clicking a tab switches the left panel content.
            ══════════════════════════════════════════ */}
        <div className="w-[56px] bg-white border-r border-[#e8e7e4] flex flex-col items-center py-3 gap-2 shrink-0">
          <SidebarTabButton
            icon="📷"
            label="Photos"
            active={activeTab === 'photos'}
            // Amber + orange dot when inspection is missing — needs attention
            flagged={tenantData.inspectionStatus === 'missing'}
            dot={tenantData.inspectionStatus === 'missing'}
            onClick={() => setActiveTab('photos')}
          />
          <SidebarTabButton
            icon="👤"
            label="Tenant"
            active={activeTab === 'tenant'}
            onClick={() => setActiveTab('tenant')}
          />
          <SidebarTabButton
            icon="🧾"
            label="Rates"
            active={activeTab === 'rates'}
            onClick={() => setActiveTab('rates')}
          />
          <div className="w-8 border-t border-[#e8e7e4] my-1" />
          <SidebarTabButton
            icon="📝"
            label="Notes"
            active={activeTab === 'notes'}
            onClick={() => setActiveTab('notes')}
          />
        </div>

        {/* ══════════════════════════════════════════
            LEFT PANEL — fills remaining space inside the 40% container.
            Scrollable independently of the right panel.
            ══════════════════════════════════════════ */}
        <div className="flex-1 bg-white border-r border-[#e8e7e4] flex flex-col overflow-hidden">

          {/* Panel title row */}
          <div className="px-3 py-2.5 border-b border-[#e8e7e4] shrink-0">
            <span className="text-[11px] font-semibold text-[#1a1a19]">
              {activeTab === 'photos' && '📷 Inspection Photos'}
              {activeTab === 'tenant' && '👤 Tenant & Lease'}
              {activeTab === 'rates' && '🧾 Property Rates'}
              {activeTab === 'notes' && '📝 Case Notes'}
            </span>
          </div>

          {/* Scrollable panel body */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">

            {/* ── PHOTOS TAB ── */}
            {activeTab === 'photos' && (
              <>
                <p className="text-[10px] font-semibold text-[#9b9b99] uppercase tracking-[0.05em]">Move-in inspection</p>
                {/* Green if signed, red if missing */}
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

                {/* Photo grid — placeholder tiles for each room */}
                {tenantData.inspectionStatus === 'signed' && (
                  <>
                    <p className="text-[10px] font-semibold text-[#9b9b99] uppercase tracking-[0.05em]">Photos on file</p>
                    <div className="grid grid-cols-3 gap-1.5">
                      {['Living room', 'Kitchen', 'Bedroom', 'Bathroom', 'Hallway', 'Entry'].map(room => (
                        <div
                          key={room}
                          className="aspect-square bg-[#f1f1ef] border border-[#e8e7e4] rounded-[4px] flex flex-col items-center justify-center"
                        >
                          <span className="text-[18px]">🖼</span>
                          <span className="text-[8px] text-[#9b9b99] mt-0.5 text-center px-1">{room}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                <p className="text-[10px] font-semibold text-[#9b9b99] uppercase tracking-[0.05em]">Move-out inspection</p>
                <div className="bg-[#f7f6f3] border border-[#e8e7e4] rounded-[6px] p-3 text-center">
                  <div className="text-3xl mb-1">🔑</div>
                  <p className="text-[11px] text-[#9b9b99]">Not yet completed</p>
                </div>

                {/* Risk warning when there's no signed inspection */}
                {tenantData.inspectionStatus === 'missing' && (
                  <div className="bg-[#fceae8] border border-[#b3261e]/20 rounded-[6px] p-2.5 text-[11px] text-[#b3261e]">
                    <p className="font-semibold mb-1">Risk: no move-in inspection</p>
                    <p>Without a signed inspection, charging for damage is legally risky. Consult your manager before adding repair charges.</p>
                  </div>
                )}
              </>
            )}

            {/* ── TENANT TAB ── */}
            {activeTab === 'tenant' && (
              <>
                <p className="text-[10px] font-semibold text-[#9b9b99] uppercase tracking-[0.05em]">Tenant</p>
                <div className="bg-[#f7f6f3] border border-[#e8e7e4] rounded-[6px] overflow-hidden">
                  <InfoRow label="Name" value={tenantData.tenantName} />
                  <InfoRow label="Co-tenant" value={tenantData.coTenant || '—'} />
                  <InfoRow label="Unit" value={tenantData.unit} />
                  <InfoRow label="Forwarding address" value={tenantData.forwardingAddress.street} />
                </div>

                <p className="text-[10px] font-semibold text-[#9b9b99] uppercase tracking-[0.05em]">Lease dates</p>
                <div className="bg-[#f7f6f3] border border-[#e8e7e4] rounded-[6px] overflow-hidden">
                  <InfoRow label="Move-in" value={tenantData.moveInDate} />
                  <InfoRow label="Move-out" value={tenantData.moveOutDate} />
                  <InfoRow label="Paid through" value={tenantData.paidThroughDate || '—'} />
                  <InfoRow label="Notice date" value={tenantData.noticeDate || '—'} />
                  <InfoRow label="Lease end" value={tenantData.leaseEndDate} />
                  {/* Lease break shown in RED — it's a penalty situation */}
                  <InfoRow
                    label="Lease break"
                    value={tenantData.leaseBreak ? 'Yes — rent due after move-out' : 'No'}
                    highlight={tenantData.leaseBreak ? 'red' : undefined}
                  />
                  {tenantData.leaseBreak && tenantData.newTenantMoveInDate && (
                    <InfoRow label="New tenant in" value={tenantData.newTenantMoveInDate} />
                  )}
                </div>

                {/* Red warning card for lease break */}
                {tenantData.leaseBreak && (
                  <div className="bg-[#fceae8] border border-[#b3261e]/20 rounded-[6px] p-2.5 text-[11px] text-[#b3261e]">
                    <p className="font-semibold mb-0.5">⚠ Lease break</p>
                    <p>Tenant moved out before lease ended. Rent is due until the new tenant moves in or the lease ends — whichever is first.</p>
                  </div>
                )}
              </>
            )}

            {/* ── RATES TAB ── */}
            {activeTab === 'rates' && (
              <>
                <p className="text-[10px] font-semibold text-[#9b9b99] uppercase tracking-[0.05em]">Property</p>
                <div className="bg-[#f7f6f3] border border-[#e8e7e4] rounded-[6px] overflow-hidden">
                  <InfoRow label="Property" value={session.propertyName || '—'} />
                  <InfoRow label="Unit" value={tenantData.unit} />
                  {/* Monthly rent / 30 = the daily rate used in lease break calculations */}
                  <InfoRow label="Monthly rent" value={formatCurrency(tenantData.monthlyRent) + '/mo'} />
                  <InfoRow label="Daily rate (÷30)" value={formatCurrency(dailyRate) + '/day'} />
                </div>

                <p className="text-[10px] font-semibold text-[#9b9b99] uppercase tracking-[0.05em]">Deposits</p>
                <div className="bg-[#f7f6f3] border border-[#e8e7e4] rounded-[6px] overflow-hidden">
                  <InfoRow label="Security deposit" value={formatCurrency(depositData.securityDeposit)} />
                  {depositData.petDeposit > 0 && (
                    <InfoRow label="Pet deposit" value={formatCurrency(depositData.petDeposit)} />
                  )}
                  {depositData.keyDeposit > 0 && (
                    <InfoRow label="Key deposit" value={formatCurrency(depositData.keyDeposit)} />
                  )}
                  {/* NRC = Non-Refundable Cleaning fee — pre-paid, reduces cleaning charge at move-out */}
                  <InfoRow label="NRC cleaning fee" value={formatCurrency(depositData.nrcCleaningFee)} />
                </div>

                {/* RUBS billing details */}
                {utilityData.utilityType === 'RUBS' && (
                  <>
                    <p className="text-[10px] font-semibold text-[#9b9b99] uppercase tracking-[0.05em]">RUBS billing</p>
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

                {/* Flat fee utility details */}
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
              </>
            )}

            {/* ── NOTES TAB ── */}
            {activeTab === 'notes' && (
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
        </div>{/* end left 40% wrapper */}

        {/* ══════════════════════════════════════════
            RIGHT PANEL — 60% — AGM Checkout Report form.
            Always visible. Auto-filled fields show tenant data.
            Charge inputs are editable by the user.
            ══════════════════════════════════════════ */}
        <div className="flex flex-col overflow-hidden bg-[#f7f6f3]" style={{ width: '60%' }}>

          {/* Form header */}
          <div className="px-4 py-2 border-b border-[#e8e7e4] flex items-center justify-between bg-white shrink-0">
            <span className="text-[11px] font-semibold text-[#6b6b6a]">📄 AGM Checkout Report</span>
            <span className="text-[10px] text-[#9b9b99]">{autoFilledCount} / {TOTAL_FIELDS} fields auto-filled</span>
          </div>

          {/* Scrollable form body */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">

            {/* ── Property & tenant (auto-filled, read-only display) ── */}
            <div>
              <p className="text-[9px] font-semibold text-[#9b9b99] uppercase tracking-[0.06em] mb-2">Property & tenant</p>
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

            {/* ── RUBS chargeback card — blue, calculated automatically ── */}
            {utilityData.utilityType === 'RUBS' && calculatedCharges.utilityCharge > 0 && (
              <div>
                <p className="text-[9px] font-semibold text-[#9b9b99] uppercase tracking-[0.06em] mb-2">RUBS chargeback</p>
                {/* Blue = auto-calculated value */}
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
                    <span className="text-[#6b6b6a]">
                      Chargeback ({formatCurrency(utilityData.rubsBuildingTotal)} × {(utilityData.rubsUnitRatio * 100).toFixed(1)}%)
                    </span>
                    <span className="font-bold text-[#1858b8]">{formatCurrency(calculatedCharges.utilityCharge)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* ── Flat fee utility card ── */}
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

            {/* ── Lease break — rent due card. RED because it's a penalty situation. ── */}
            {tenantData.leaseBreak && calculatedCharges.rentDue > 0 && (
              <div>
                <p className="text-[9px] font-semibold text-[#9b9b99] uppercase tracking-[0.06em] mb-2">Lease break — rent due</p>
                {/* Red = warning / penalty situation. Lease break = tenant owed extra rent. */}
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

            {/* ── Turnover charges — manual input grid ── */}
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

                {/* Credits (deposits paid by tenant) */}
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

                {/* Charges line */}
                <div className="pt-1 border-t border-[#e8e7e4] flex justify-between text-[12px]">
                  <span className="text-[#6b6b6a]">Total charges</span>
                  <span className="text-[#b3261e] font-medium">−{formatCurrency(totalCharges)}</span>
                </div>

                {/* Result card — green if tenant gets money back, red if tenant owes */}
                <div className={`rounded-[6px] p-3 text-center mt-1 ${
                  balance >= 0 ? 'bg-[#e3f5e6]' : 'bg-[#fceae8]'
                }`}>
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
