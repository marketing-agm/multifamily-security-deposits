// components/AgentForm/index.tsx
// Return form — two-column layout.
//
// LEFT: Numbered progress steps matching the PDF form section order.
//   Clicking a step shows context info AND scrolls the right form to that section.
//   Steps:
//     1. Property & Tenant  — name, unit, forwarding address
//     2. Lease & Dates      — rent, NRC, move-in/out, lease break
//     3. Turnover Charges   — cleaning, carpet, painting, other
//     4. Utility & Rent Due — RUBS/flat fee, rent due date range
//     5. Inspection Photos  — move-in/out status and photo grid
//     6. Notes              — freeform case notes
//
// RIGHT: AGM Checkout Report — auto-filled and manually editable.
//   Sections are anchored so clicking a left step scrolls to them.

'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/context/SessionContext';
import { formatCurrency } from '@/lib/calculations';
import { TenantReturn } from '@/types';

const TOP_STEPS = ['1. Upload', '2. Form', '3. Review', '4. Download'];
const CURRENT_TOP_STEP = 1;
const TOTAL_FIELDS = 72;

type FormSection = 'tenant' | 'lease' | 'charges' | 'utility' | 'photos' | 'notes';

const FORM_SECTIONS: { key: FormSection; number: number; title: string; subtitle: string }[] = [
  { key: 'tenant',  number: 1, title: 'Property & Tenant',   subtitle: 'Name, unit, address' },
  { key: 'lease',   number: 2, title: 'Lease & Dates',       subtitle: 'Rent, NRC, move-in/out' },
  { key: 'charges', number: 3, title: 'Turnover Charges',    subtitle: 'Cleaning, carpet, repairs' },
  { key: 'utility', number: 4, title: 'Utility & Rent Due',  subtitle: 'RUBS, flat fee, rent owed' },
  { key: 'photos',  number: 5, title: 'Inspection Photos',   subtitle: 'Move-in / move-out condition' },
  { key: 'notes',   number: 6, title: 'Notes',               subtitle: 'Case notes & reminders' },
];

interface Props { returnId: string }

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

// Editable input pre-filled with tenant data. White = editable, gray = read-only.
function FormField({ label, value, onChange }: { label: string; value: string; onChange?: (v: string) => void }) {
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
        type="number" min={0} step={0.01}
        value={value || ''} placeholder="0"
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
        className={`h-8 text-sm px-2 rounded-[4px] border w-full ${
          value > 0 ? 'bg-[#fdf3da] border-[#8b6a00] text-[#8b6a00]' : 'bg-white border-[#e8e7e4] text-[#1a1a19]'
        }`}
      />
    </div>
  );
}

// Section anchor label used to scroll the right panel to a specific form section
function SectionAnchor({ label }: { label: string }) {
  return (
    <p className="text-[9px] font-semibold text-[#9b9b99] uppercase tracking-[0.06em] mb-2">{label}</p>
  );
}

export function AgentForm({ returnId }: Props) {
  const { session, updateReturn } = useSession();
  const router = useRouter();

  const [activeSection, setActiveSection] = useState<FormSection>('tenant');
  const [notes, setNotes] = useState('');
  const [formOverrides, setFormOverrides] = useState<Record<string, string>>({});

  // Refs for each right-panel section — used to scroll when a left step is clicked
  const tenantRef  = useRef<HTMLDivElement>(null);
  const leaseRef   = useRef<HTMLDivElement>(null);
  const chargesRef = useRef<HTMLDivElement>(null);
  const utilityRef = useRef<HTMLDivElement>(null);
  const rightScrollRef = useRef<HTMLDivElement>(null);

  function fieldVal(key: string, def: string) { return key in formOverrides ? formOverrides[key] : def; }
  function setField(key: string, val: string) { setFormOverrides(prev => ({ ...prev, [key]: val })); }

  const trMaybe = session?.returns.find(r => r.id === returnId);
  if (!session || !trMaybe) { router.replace('/dashboard'); return null; }
  const tr: TenantReturn = trMaybe;
  const { tenantData, depositData, utilityData, calculatedCharges, manualCharges } = tr;

  const nrcOffset    = Math.min(manualCharges.generalCleaning, depositData.nrcCleaningFee);
  const tenantCleaning = Math.max(0, manualCharges.generalCleaning - nrcOffset);
  const totalCredits = depositData.securityDeposit + depositData.petDeposit + depositData.keyDeposit;
  const totalCharges =
    calculatedCharges.rentDue + calculatedCharges.utilityCharge + tenantCleaning +
    manualCharges.carpetShampooing + manualCharges.painting +
    manualCharges.other1 + manualCharges.other2 + manualCharges.legalCourtCosts;
  const balance  = totalCredits - totalCharges;
  const fwdAddr  = `${tenantData.forwardingAddress.street}, ${tenantData.forwardingAddress.city} ${tenantData.forwardingAddress.state} ${tenantData.forwardingAddress.zip}`;
  const dailyRate = tenantData.monthlyRent / 30;

  const autoFilledCount = Math.min(TOTAL_FIELDS, 16 +
    (calculatedCharges.rentDue > 0 ? 4 : 0) +
    (calculatedCharges.utilityCharge > 0 ? 3 : 0) +
    (manualCharges.generalCleaning > 0 ? 2 : 0) +
    (manualCharges.carpetShampooing > 0 ? 2 : 0) +
    (manualCharges.painting > 0 ? 2 : 0));

  function updateManual(field: keyof typeof manualCharges, value: number) {
    updateReturn(tr.id, { manualCharges: { ...manualCharges, [field]: value } });
  }

  // Clicking a step: update active section AND scroll the right panel to the matching anchor
  function selectSection(key: FormSection) {
    setActiveSection(key);
    const refMap: Partial<Record<FormSection, React.RefObject<HTMLDivElement | null>>> = {
      tenant:  tenantRef,
      lease:   leaseRef,
      charges: chargesRef,
      utility: utilityRef,
    };
    const ref = refMap[key];
    if (ref?.current && rightScrollRef.current) {
      // Scroll the right panel so this section is near the top
      const top = ref.current.offsetTop - 12;
      rightScrollRef.current.scrollTo({ top, behavior: 'smooth' });
    } else if (rightScrollRef.current && (key === 'photos' || key === 'notes')) {
      // Photos and Notes don't correspond to a right-panel section — just show left content
      rightScrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function handleContinue() {
    updateReturn(tr.id, { processingStatus: 'in_progress' });
    router.push(`/review/${encodeURIComponent(tr.id)}`);
  }

  return (
    <div className="h-screen flex flex-col bg-[#fbfbfa] overflow-hidden">

      {/* ── Top nav ── */}
      <div className="bg-white border-b border-[#e8e7e4] px-4 py-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/dashboard')} className="text-[12px] text-[#2383e2] hover:underline shrink-0">
            ← All returns
          </button>
          <div className="w-px h-3.5 bg-[#d4d3d0]" />
          <div>
            <p className="text-[13px] font-semibold text-[#1a1a19]">{tenantData.tenantName} — Unit {tenantData.unit}</p>
            <p className="text-[11px] text-[#9b9b99]">
              {session.propertyName} · Move-out {tenantData.moveOutDate} · {utilityData.utilityType === 'RUBS' ? 'RUBS' : 'Flat fee'}
              {tenantData.leaseBreak && <span className="text-[#b3261e] font-medium"> · Lease break</span>}
              {' '}· {formatCurrency(depositData.securityDeposit)} deposit
            </p>
          </div>
        </div>

        {/* 4-step top progress bar */}
        <div className="flex overflow-hidden rounded-[6px] border border-[#e8e7e4]">
          {TOP_STEPS.map((label, i) => (
            <div key={label} className={`px-3 py-1 text-[10px] border-r border-[#e8e7e4] last:border-r-0 whitespace-nowrap ${
              i < CURRENT_TOP_STEP ? 'bg-[#e3f5e6] text-[#1a7a3a]' :
              i === CURRENT_TOP_STEP ? 'bg-[#e6efff] text-[#1858b8] font-semibold' :
              'bg-[#f7f6f3] text-[#9b9b99]'
            }`}>{label}</div>
          ))}
        </div>

        <button onClick={handleContinue} className="px-4 py-1.5 text-sm font-medium bg-[#1a1a19] text-white rounded-[6px] hover:bg-[#333] shrink-0">
          Continue to review →
        </button>
      </div>

      {/* ── Main layout ── */}
      <div className="flex-1 flex overflow-hidden">

        {/* Left 40%: progress steps + context panel */}
        <div className="flex shrink-0 overflow-hidden" style={{ width: '40%' }}>

          {/* Vertical numbered progress steps */}
          <div className="w-[190px] bg-white border-r border-[#e8e7e4] flex flex-col py-4 px-3 gap-1 shrink-0">
            <p className="text-[9px] font-semibold text-[#9b9b99] uppercase tracking-[0.06em] mb-2 px-1">Form sections</p>
            {FORM_SECTIONS.map(section => {
              const isActive = activeSection === section.key;
              // A section counts as "done" if the corresponding data exists
              const isDone = (
                section.key === 'tenant'  ? true :
                section.key === 'lease'   ? true :
                section.key === 'charges' ? totalCharges > 0 :
                section.key === 'utility' ? calculatedCharges.utilityCharge > 0 :
                section.key === 'photos'  ? tenantData.inspectionStatus === 'signed' :
                section.key === 'notes'   ? notes.trim().length > 0 : false
              );
              return (
                <button
                  key={section.key}
                  onClick={() => selectSection(section.key)}
                  className={`w-full text-left px-3 py-2.5 rounded-[8px] border transition-colors ${
                    isActive ? 'bg-[#e6efff] border-[#2383e2]/40' : 'bg-transparent border-transparent hover:bg-[#f1f1ef] hover:border-[#e8e7e4]'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                      isDone && !isActive ? 'bg-[#1a7a3a] text-white' :
                      isActive ? 'bg-[#2383e2] text-white' :
                      'bg-[#e8e7e4] text-[#9b9b99]'
                    }`}>
                      {isDone && !isActive ? '✓' : section.number}
                    </span>
                    <span className={`text-[11px] font-semibold leading-tight ${
                      isActive ? 'text-[#1858b8]' : isDone ? 'text-[#1a1a19]' : 'text-[#6b6b6a]'
                    }`}>{section.title}</span>
                  </div>
                  <p className="text-[9px] text-[#9b9b99] pl-7 leading-tight">{section.subtitle}</p>
                </button>
              );
            })}
          </div>

          {/* Context panel — content matches the active section */}
          <div className="flex-1 bg-white border-r border-[#e8e7e4] flex flex-col overflow-hidden">
            <div className="px-3 py-2.5 border-b border-[#e8e7e4] shrink-0">
              <span className="text-[11px] font-semibold text-[#1a1a19]">
                {FORM_SECTIONS.find(s => s.key === activeSection)?.title}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-3">

              {/* 1. Property & Tenant */}
              {activeSection === 'tenant' && (
                <>
                  <div className="bg-[#f7f6f3] border border-[#e8e7e4] rounded-[6px] overflow-hidden">
                    <InfoRow label="Property" value={session.propertyName || '—'} />
                    <InfoRow label="Unit" value={tenantData.unit} />
                    <InfoRow label="Tenant name" value={tenantData.tenantName} />
                    <InfoRow label="Co-tenant" value={tenantData.coTenant || '—'} />
                    <InfoRow label="Forwarding address" value={tenantData.forwardingAddress.street} />
                    <InfoRow label="City / State / Zip" value={`${tenantData.forwardingAddress.city} ${tenantData.forwardingAddress.state} ${tenantData.forwardingAddress.zip}`} />
                  </div>
                  <p className="text-[10px] text-[#9b9b99]">These fields are auto-filled from AppFolio and editable on the right.</p>
                </>
              )}

              {/* 2. Lease & Dates */}
              {activeSection === 'lease' && (
                <>
                  <div className="bg-[#f7f6f3] border border-[#e8e7e4] rounded-[6px] overflow-hidden">
                    <InfoRow label="Monthly rent" value={formatCurrency(tenantData.monthlyRent) + '/mo'} />
                    <InfoRow label="Daily rate (÷ 30)" value={formatCurrency(dailyRate) + '/day'} />
                    <InfoRow label="NRC cleaning fee" value={formatCurrency(depositData.nrcCleaningFee)} />
                    <InfoRow label="NRC pet fee" value={depositData.petDeposit > 0 ? formatCurrency(depositData.petDeposit) : '—'} />
                    <InfoRow label="Move-in" value={tenantData.moveInDate} />
                    <InfoRow label="Move-out" value={tenantData.moveOutDate} />
                    <InfoRow label="Paid through" value={tenantData.paidThroughDate || '—'} />
                    <InfoRow label="Notice date" value={tenantData.noticeDate || '—'} />
                    <InfoRow label="Lease end" value={tenantData.leaseEndDate} />
                    <InfoRow
                      label="Lease break"
                      value={tenantData.leaseBreak ? 'Yes' : 'No'}
                      highlight={tenantData.leaseBreak ? 'red' : undefined}
                    />
                    {tenantData.leaseBreak && tenantData.newTenantMoveInDate && (
                      <InfoRow label="New tenant move-in" value={tenantData.newTenantMoveInDate} />
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

              {/* 3. Turnover Charges */}
              {activeSection === 'charges' && (
                <>
                  <p className="text-[10px] text-[#9b9b99]">Enter charges in the form on the right. This panel shows a live summary.</p>
                  <div className="bg-[#f7f6f3] border border-[#e8e7e4] rounded-[6px] overflow-hidden">
                    {manualCharges.generalCleaning > 0 && <InfoRow label="Cleaning (gross)" value={formatCurrency(manualCharges.generalCleaning)} />}
                    {nrcOffset > 0 && <InfoRow label="NRC offset" value={'−' + formatCurrency(nrcOffset)} highlight="amber" />}
                    {tenantCleaning > 0 && <InfoRow label="Cleaning (tenant owes)" value={formatCurrency(tenantCleaning)} />}
                    {manualCharges.carpetShampooing > 0 && <InfoRow label="Carpet" value={formatCurrency(manualCharges.carpetShampooing)} />}
                    {manualCharges.painting > 0 && <InfoRow label="Painting" value={formatCurrency(manualCharges.painting)} />}
                    {manualCharges.other1 > 0 && <InfoRow label={manualCharges.other1Label || 'Other'} value={formatCurrency(manualCharges.other1)} />}
                    {manualCharges.other2 > 0 && <InfoRow label={manualCharges.other2Label || 'Other (2)'} value={formatCurrency(manualCharges.other2)} />}
                    {totalCharges === 0 && (
                      <div className="px-3 py-3 text-[11px] text-[#9b9b99] text-center">No charges entered yet</div>
                    )}
                  </div>
                </>
              )}

              {/* 4. Utility & Rent Due */}
              {activeSection === 'utility' && (
                <>
                  {utilityData.utilityType === 'RUBS' && (
                    <>
                      <p className="text-[10px] font-semibold text-[#9b9b99] uppercase tracking-[0.05em]">RUBS billing</p>
                      <p className="text-[10px] text-[#9b9b99]">Building water bill split across units by square footage ratio.</p>
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
                  {tenantData.leaseBreak && calculatedCharges.rentDue > 0 && (
                    <>
                      <p className="text-[10px] font-semibold text-[#9b9b99] uppercase tracking-[0.05em] mt-1">Rent due (lease break)</p>
                      <div className="bg-[#fceae8] border border-[#b3261e]/30 rounded-[6px] p-2.5 text-[11px]">
                        <div className="flex justify-between mb-1"><span className="text-[#6b6b6a]">Daily rate</span><span className="text-[#b3261e] font-semibold">{formatCurrency(dailyRate)}/day</span></div>
                        {calculatedCharges.rentDueDateRange && (
                          <div className="flex justify-between mb-1"><span className="text-[#6b6b6a]">{calculatedCharges.rentDueDateRange}</span><span className="text-[#b3261e] font-semibold">{Math.round(calculatedCharges.rentDue / dailyRate)} days</span></div>
                        )}
                        <div className="flex justify-between border-t border-[#b3261e]/20 pt-1"><span className="text-[#6b6b6a]">Rent due</span><span className="text-[#b3261e] font-bold">{formatCurrency(calculatedCharges.rentDue)}</span></div>
                      </div>
                    </>
                  )}
                </>
              )}

              {/* 5. Inspection Photos */}
              {activeSection === 'photos' && (
                <>
                  <p className="text-[10px] font-semibold text-[#9b9b99] uppercase tracking-[0.05em]">Move-in inspection</p>
                  <div className={`rounded-[6px] border p-3 text-center ${
                    tenantData.inspectionStatus === 'signed' ? 'bg-[#e3f5e6] border-[#1a7a3a]/40' : 'bg-[#fceae8] border-[#b3261e]/40'
                  }`}>
                    <div className="text-3xl mb-1">🏠</div>
                    <p className={`text-[11px] font-semibold ${tenantData.inspectionStatus === 'signed' ? 'text-[#1a7a3a]' : 'text-[#b3261e]'}`}>
                      {tenantData.inspectionStatus === 'signed' ? '✓ Signed · 6 photos on file' : '⚠ Missing — no inspection on file'}
                    </p>
                  </div>
                  {tenantData.inspectionStatus === 'signed' && (
                    <>
                      <p className="text-[10px] font-semibold text-[#9b9b99] uppercase tracking-[0.05em]">Photos on file</p>
                      <div className="grid grid-cols-3 gap-1.5">
                        {['Living room', 'Kitchen', 'Bedroom', 'Bathroom', 'Hallway', 'Entry'].map(room => (
                          <div key={room} className="aspect-square bg-[#f1f1ef] border border-[#e8e7e4] rounded-[4px] flex flex-col items-center justify-center">
                            <span className="text-[18px]">🖼</span>
                            <span className="text-[8px] text-[#9b9b99] mt-0.5 text-center px-1">{room}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                  {tenantData.inspectionStatus === 'missing' && (
                    <div className="bg-[#fceae8] border border-[#b3261e]/20 rounded-[6px] p-2.5 text-[11px] text-[#b3261e]">
                      <p className="font-semibold mb-1">Risk: no move-in inspection</p>
                      <p>Without a signed inspection, charging for damage is legally risky. Consult your manager before adding repair charges.</p>
                    </div>
                  )}
                  <p className="text-[10px] font-semibold text-[#9b9b99] uppercase tracking-[0.05em]">Move-out inspection</p>
                  <div className="bg-[#f7f6f3] border border-[#e8e7e4] rounded-[6px] p-3 text-center">
                    <div className="text-3xl mb-1">🔑</div>
                    <p className="text-[11px] text-[#9b9b99]">Not yet completed</p>
                  </div>
                </>
              )}

              {/* 6. Notes */}
              {activeSection === 'notes' && (
                <>
                  <p className="text-[10px] font-semibold text-[#9b9b99] uppercase tracking-[0.05em]">Case notes</p>
                  <textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Add notes — special circumstances, follow-ups, reminders..."
                    className="w-full min-h-[200px] text-[12px] text-[#1a1a19] bg-white border border-[#e8e7e4] rounded-[6px] p-3 resize-none focus:outline-none focus:border-[#2383e2]"
                  />
                  <p className="text-[10px] text-[#9b9b99]">Notes are saved for this browser session only.</p>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right 60%: AGM Checkout Report — scrollable, each section has a ref */}
        <div className="flex flex-col overflow-hidden bg-[#f7f6f3]" style={{ width: '60%' }}>
          <div className="px-4 py-2 border-b border-[#e8e7e4] flex items-center justify-between bg-white shrink-0">
            <span className="text-[11px] font-semibold text-[#6b6b6a]">📄 AGM Checkout Report</span>
            <span className="text-[10px] text-[#9b9b99]">{autoFilledCount} / {TOTAL_FIELDS} fields auto-filled</span>
          </div>

          <div ref={rightScrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">

            {/* ── Section 1: Property & Tenant ── */}
            <div ref={tenantRef}>
              <SectionAnchor label="Property & Tenant" />
              <div className="bg-white border border-[#e8e7e4] rounded-[6px] p-3 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <FormField label="Property" value={fieldVal('property', session.propertyName || '—')} onChange={v => setField('property', v)} />
                  <FormField label="Unit" value={fieldVal('unit', tenantData.unit)} onChange={v => setField('unit', v)} />
                </div>
                <FormField label="Tenant name" value={fieldVal('tenantName', tenantData.tenantName)} onChange={v => setField('tenantName', v)} />
                <FormField label="Co-tenant / co-signer" value={fieldVal('coTenant', tenantData.coTenant || '')} onChange={v => setField('coTenant', v)} />
                <FormField label="Forwarding address" value={fieldVal('fwdAddr', tenantData.forwardingAddress.street)} onChange={v => setField('fwdAddr', v)} />
                <FormField label="City / State / Zip" value={fieldVal('cityStateZip', `${tenantData.forwardingAddress.city} ${tenantData.forwardingAddress.state} ${tenantData.forwardingAddress.zip}`)} onChange={v => setField('cityStateZip', v)} />
              </div>
            </div>

            {/* ── Section 2: Lease & Dates ── */}
            <div ref={leaseRef}>
              <SectionAnchor label="Lease & Dates" />
              <div className="bg-white border border-[#e8e7e4] rounded-[6px] p-3 space-y-2">
                <div className="grid grid-cols-3 gap-2">
                  <FormField label="Monthly rent" value={fieldVal('monthlyRent', formatCurrency(tenantData.monthlyRent))} onChange={v => setField('monthlyRent', v)} />
                  <FormField label="NRC cleaning" value={fieldVal('nrcCleaning', formatCurrency(depositData.nrcCleaningFee))} onChange={v => setField('nrcCleaning', v)} />
                  <FormField label="NRC pet" value={fieldVal('nrcPet', depositData.petDeposit > 0 ? formatCurrency(depositData.petDeposit) : '—')} onChange={v => setField('nrcPet', v)} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <FormField label="Date of move-in" value={fieldVal('moveIn', tenantData.moveInDate)} onChange={v => setField('moveIn', v)} />
                  <FormField label="Date of move-out" value={fieldVal('moveOut', tenantData.moveOutDate)} onChange={v => setField('moveOut', v)} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <FormField label="Paid rent through" value={fieldVal('paidThrough', tenantData.paidThroughDate || '—')} onChange={v => setField('paidThrough', v)} />
                  <FormField label="Notice date" value={fieldVal('noticeDate', tenantData.noticeDate || '—')} onChange={v => setField('noticeDate', v)} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <FormField label="Lease break" value={fieldVal('leaseBreak', tenantData.leaseBreak ? 'Yes' : 'No')} onChange={v => setField('leaseBreak', v)} />
                  <FormField label="New tenant move-in" value={fieldVal('newTenantMoveIn', tenantData.newTenantMoveInDate || '—')} onChange={v => setField('newTenantMoveIn', v)} />
                </div>
                {tenantData.leaseBreak && (
                  <div className="bg-[#fceae8] border border-[#b3261e]/20 rounded-[4px] px-2.5 py-1.5 text-[10px] text-[#b3261e] font-medium">
                    ⚠ Lease break — rent due until new tenant or lease end
                  </div>
                )}
              </div>
            </div>

            {/* ── Section 3: Turnover Expenses/Charges (PDF order) ── */}
            <div ref={chargesRef}>
              <SectionAnchor label="Turnover Expenses / Charges" />
              <div className="bg-white border border-[#e8e7e4] rounded-[6px] p-3">
                <div className="grid grid-cols-2 gap-3">
                  <ChargeInput label="General cleaning ($)" value={manualCharges.generalCleaning} onChange={v => updateManual('generalCleaning', v)} note={`NRC ${formatCurrency(depositData.nrcCleaningFee)} applies`} />
                  <ChargeInput label="Carpet shampooing ($)" value={manualCharges.carpetShampooing} onChange={v => updateManual('carpetShampooing', v)} />
                  <ChargeInput label="Painting ($)" value={manualCharges.painting} onChange={v => updateManual('painting', v)} />
                  <ChargeInput label="Other — repairs/keys ($)" value={manualCharges.other1} onChange={v => updateManual('other1', v)} />
                  <ChargeInput label="Other (2) ($)" value={manualCharges.other2} onChange={v => updateManual('other2', v)} />
                  <ChargeInput label="Legal / court costs ($)" value={manualCharges.legalCourtCosts} onChange={v => updateManual('legalCourtCosts', v)} />
                </div>
                <p className="text-[10px] text-[#9b9b99] mt-2">Turns amber when a value is entered. Type 0 to clear.</p>
              </div>
            </div>

            {/* ── Section 4: Utility & Rent Due ── */}
            <div ref={utilityRef}>
              <SectionAnchor label="Utility & Rent Due" />

              {utilityData.utilityType === 'RUBS' && calculatedCharges.utilityCharge > 0 && (
                <div className="bg-[#e6efff] border border-[#2383e2]/30 rounded-[6px] p-3 space-y-1 mb-3">
                  <div className="flex justify-between text-[12px]">
                    <span className="text-[#6b6b6a]">Building water bill</span>
                    <span className="font-semibold text-[#1858b8]">{formatCurrency(utilityData.rubsBuildingTotal)}</span>
                  </div>
                  <div className="flex justify-between text-[12px]">
                    <span className="text-[#6b6b6a]">Unit {tenantData.unit} share</span>
                    <span className="font-semibold text-[#1858b8]">{(utilityData.rubsUnitRatio * 100).toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between text-[12px] pt-1 border-t border-[#2383e2]/20">
                    <span className="text-[#6b6b6a]">RUBS chargeback</span>
                    <span className="font-bold text-[#1858b8]">{formatCurrency(calculatedCharges.utilityCharge)}</span>
                  </div>
                </div>
              )}

              {utilityData.utilityType === 'flat_fee' && calculatedCharges.utilityCharge > 0 && (
                <div className="bg-[#e3f5e6] border border-[#1a7a3a]/30 rounded-[6px] p-3 mb-3">
                  <div className="flex justify-between text-[12px]">
                    <span className="text-[#6b6b6a]">Utility — flat fee</span>
                    <span className="font-bold text-[#1a7a3a]">{formatCurrency(calculatedCharges.utilityCharge)}</span>
                  </div>
                </div>
              )}

              {tenantData.leaseBreak && calculatedCharges.rentDue > 0 && (
                <div className="bg-[#fceae8] border border-[#b3261e]/30 rounded-[6px] p-3 space-y-1">
                  <div className="flex justify-between text-[12px]">
                    <span className="text-[#6b6b6a]">{formatCurrency(tenantData.monthlyRent)} ÷ 30 days</span>
                    <span className="font-semibold text-[#b3261e]">{formatCurrency(dailyRate)}/day</span>
                  </div>
                  {calculatedCharges.rentDueDateRange && (
                    <div className="flex justify-between text-[12px]">
                      <span className="text-[#6b6b6a]">{calculatedCharges.rentDueDateRange}</span>
                      <span className="font-semibold text-[#b3261e]">{Math.round(calculatedCharges.rentDue / dailyRate)} days</span>
                    </div>
                  )}
                  <div className="flex justify-between text-[12px] pt-1 border-t border-[#b3261e]/20">
                    <span className="text-[#6b6b6a]">Rent due (lease break)</span>
                    <span className="font-bold text-[#b3261e]">{formatCurrency(calculatedCharges.rentDue)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* ── Refunds / Credits & Balance ── */}
            <div>
              <SectionAnchor label="Refunds / Credits & Balance" />
              <div className="bg-white border border-[#e8e7e4] rounded-[6px] p-3 space-y-2">
                <div className="flex justify-between text-[12px]">
                  <span className="text-[#6b6b6a]">Security deposit</span>
                  <span className="text-[#1a7a3a] font-medium">+{formatCurrency(depositData.securityDeposit)}</span>
                </div>
                {depositData.petDeposit > 0 && (
                  <div className="flex justify-between text-[12px]">
                    <span className="text-[#6b6b6a]">Pet / key deposit</span>
                    <span className="text-[#1a7a3a] font-medium">+{formatCurrency(depositData.petDeposit)}</span>
                  </div>
                )}
                <div className="flex justify-between text-[12px] pt-1 border-t border-[#e8e7e4]">
                  <span className="text-[#6b6b6a]">Total charges</span>
                  <span className="text-[#b3261e] font-medium">−{formatCurrency(totalCharges)}</span>
                </div>
                <div className={`rounded-[6px] p-3 text-center mt-1 ${balance >= 0 ? 'bg-[#e3f5e6]' : 'bg-[#fceae8]'}`}>
                  <p className="text-[10px] text-[#9b9b99] mb-0.5">{balance >= 0 ? 'Balance due to tenant' : 'Balance owing landlord'}</p>
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
