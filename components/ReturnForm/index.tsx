'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/context/SessionContext';
import { ManualCharges, TenantReturn, RUBSManualInput } from '@/types';
import {
  computeCalculatedCharges,
  calcNRCOffset,
  calcTotalCharges,
  calcTotalCredits,
  calcBalance,
  formatCurrency,
} from '@/lib/calculations';
import { UtilityTag } from '@/components/shared/UtilityTag';

// 9 sections matching the AGM Checkout Report PDF form order
const SECTIONS = [
  { num: 1, key: 'tenant',  title: 'Property & Tenant',    sub: 'Name, unit, forwarding address' },
  { num: 2, key: 'lease',   title: 'Lease & Dates',        sub: 'Rent, NRC, move-in / move-out' },
  { num: 3, key: 'nrc',     title: 'NRC Fees',             sub: 'Non-refundable cleaning & pet' },
  { num: 4, key: 'photos',  title: 'Move-In / Out Photos', sub: 'Inspection — drives repair charges' },
  { num: 5, key: 'rent',    title: 'Rent Due',             sub: 'Pro-rated / lease break' },
  { num: 6, key: 'utility', title: 'Utility Charges',      sub: 'RUBS or flat fee chargeback' },
  { num: 7, key: 'legal',   title: 'Legal / Court Costs',  sub: 'Court fees, attorney costs' },
  { num: 8, key: 'totals',  title: 'Total Charges',        sub: 'Summary of all deductions' },
  { num: 9, key: 'credits', title: 'Refunds & Credits',    sub: 'Deposits held — final balance' },
] as const;

type SectionKey = (typeof SECTIONS)[number]['key'];

interface Props {
  returnId: string;
}

export function ReturnForm({ returnId }: Props) {
  const { session, updateReturn } = useSession();
  const router = useRouter();

  const tenantReturn = session?.returns.find(r => r.id === returnId);

  const [activeSection, setActiveSection] = useState<SectionKey>('tenant');
  // fullFormMode = false → focused single-section view; true → all sections stacked
  const [fullFormMode, setFullFormMode] = useState(false);
  // Set of section numbers that are collapsed in full-form mode
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());

  const [manualCharges, setManualCharges] = useState<ManualCharges>(
    tenantReturn?.manualCharges ?? {
      generalCleaning: 0, blindDrapeCleaning: 0, windowCoveringReplacement: 0,
      carpetShampooing: 0, flooringRestoration: 0, painting: 0,
      other1Label: 'Other', other1: 0, other2Label: 'Other', other2: 0, legalCourtCosts: 0,
    }
  );
  const [inspectionSigned, setInspectionSigned] = useState(
    tenantReturn?.tenantData.inspectionStatus === 'signed'
  );
  const [rubsInput, setRubsInput] = useState<RUBSManualInput>(
    tenantReturn?.rubsManualInput ?? { buildingTotal: 0, unitRatio: 0 }
  );
  // Photo section condition checkboxes — drive carpet/painting charge suggestions
  const [carpetCondition, setCarpetCondition] = useState(false);
  const [paintCondition, setPaintCondition] = useState(false);
  const [photosApplied, setPhotosApplied] = useState(false);

  // Refs for scroll-to in full-form mode
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  if (!session || !tenantReturn) {
    if (typeof window !== 'undefined') router.replace('/');
    return null;
  }

  const currentInspectionStatus = inspectionSigned ? 'signed' as const : 'missing' as const;
  const withCharges = {
    ...tenantReturn,
    manualCharges,
    rubsManualInput: rubsInput,
    tenantData: { ...tenantReturn.tenantData, inspectionStatus: currentInspectionStatus },
  };
  const calculatedCharges = computeCalculatedCharges(withCharges);
  const displayReturn: TenantReturn = { ...withCharges, calculatedCharges };

  const totalCharges = calcTotalCharges(displayReturn);
  const totalCredits = calcTotalCredits(displayReturn);
  const balance = calcBalance(displayReturn);
  // NRC offset: the portion of cleaning covered by the NRC fee (not charged to tenant)
  const nrcOffset = Math.min(manualCharges.generalCleaning, tenantReturn.depositData.nrcCleaningFee);
  // cleaningTenant: what the tenant actually owes after the NRC credit
  const cleaningTenant = calcNRCOffset(manualCharges.generalCleaning, tenantReturn.depositData.nrcCleaningFee);

  function updateCharge(key: keyof ManualCharges, value: number | string) {
    setManualCharges(prev => ({ ...prev, [key]: value }));
  }

  // Apply photo conditions: pre-fills carpet/painting with suggested amounts
  function applyPhotoConditions() {
    setManualCharges(prev => ({
      ...prev,
      carpetShampooing: carpetCondition ? (prev.carpetShampooing || 250) : prev.carpetShampooing,
      painting: paintCondition ? (prev.painting || 350) : prev.painting,
    }));
    setPhotosApplied(true);
  }

  function saveAndProceed() {
    updateReturn(returnId, {
      manualCharges,
      rubsManualInput: rubsInput,
      calculatedCharges,
      tenantData: { ...tenantReturn!.tenantData, inspectionStatus: currentInspectionStatus },
      processingStatus: 'in_progress',
    });
    router.push(`/review/${returnId}`);
  }

  function goToSection(key: SectionKey) {
    setActiveSection(key);
    if (fullFormMode) {
      const el = sectionRefs.current[key];
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function toggleCollapsed(num: number) {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(num)) next.delete(num); else next.add(num);
      return next;
    });
  }

  const { tenantData, depositData, utilityData } = tenantReturn;
  const activeIdx = SECTIONS.findIndex(s => s.key === activeSection);
  const activeMeta = SECTIONS[activeIdx];

  // Renders a section's field content — called both in focused and full-form modes
  function renderSectionContent(key: SectionKey) {
    switch (key) {
      case 'tenant':
        return (
          <div className="space-y-1">
            <InfoRow label="Tenant Name" value={tenantData.tenantName} />
            {tenantData.coTenant && <InfoRow label="Co-Tenant" value={tenantData.coTenant} />}
            <InfoRow label="Unit" value={tenantData.unit} />
            <InfoRow label="Property" value={session!.propertyName} />
            <div className="pt-3 mt-1 border-t border-[#e8e7e4]">
              <p className="text-xs text-[#9b9b99] font-medium uppercase tracking-wide mb-2">Forwarding Address</p>
              <InfoRow label="Street" value={tenantData.forwardingAddress.street} />
              <InfoRow label="City" value={tenantData.forwardingAddress.city} />
              <InfoRow label="State / ZIP" value={[tenantData.forwardingAddress.state, tenantData.forwardingAddress.zip].filter(Boolean).join('  ')} />
            </div>
          </div>
        );

      case 'lease':
        return (
          <div className="space-y-1">
            <InfoRow label="Monthly Rent" value={formatCurrency(tenantData.monthlyRent)} variant="auto" />
            <InfoRow label="NRC Cleaning Fee" value={formatCurrency(depositData.nrcCleaningFee)} variant="auto" />
            {depositData.nrcPetFee > 0 && (
              <InfoRow label="NRC Pet Fee" value={formatCurrency(depositData.nrcPetFee)} variant="auto" />
            )}
            <div className="pt-3 mt-1 border-t border-[#e8e7e4] space-y-1">
              <InfoRow label="Move-In Date" value={tenantData.moveInDate} variant="auto" />
              <InfoRow label="Move-Out Date" value={tenantData.moveOutDate} variant="auto" />
              <InfoRow label="Paid Through" value={tenantData.paidThroughDate} variant="auto" />
              <InfoRow label="Notice Date" value={tenantData.noticeDate} variant="auto" />
              <InfoRow label="Lease End Date" value={tenantData.leaseEndDate} variant="auto" />
              <InfoRow label="Lease Break" value={tenantData.leaseBreak ? 'Yes' : 'No'} variant={tenantData.leaseBreak ? 'manual' : 'auto'} />
              {tenantData.leaseBreak && (
                <InfoRow label="New Tenant Move-In" value={tenantData.newTenantMoveInDate ?? 'None confirmed'} variant="auto" />
              )}
            </div>
          </div>
        );

      case 'nrc':
        return (
          <div className="space-y-3">
            <p className="text-sm text-[#9b9b99]">
              NRC (Non-Refundable Charge) fees are collected at move-in and applied as a credit against cleaning charges at move-out.
            </p>
            <CalcCard label="NRC Cleaning Fee" description="Applied as offset against general cleaning charge" amount={depositData.nrcCleaningFee} color="green" />
            {depositData.nrcPetFee > 0 && (
              <CalcCard label="NRC Pet Fee" description="Applied toward pet-related cleaning or damage" amount={depositData.nrcPetFee} color="green" />
            )}
            {depositData.nrcCleaningFee === 0 && depositData.nrcPetFee === 0 && (
              <p className="text-sm text-[#9b9b99] italic">No NRC fees on file for this tenant.</p>
            )}
          </div>
        );

      case 'photos':
        return (
          <div className="space-y-4">
            <div>
              <p className="text-xs text-[#9b9b99] font-medium uppercase tracking-wide mb-2">Move-In Inspection</p>
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={inspectionSigned}
                  onChange={e => setInspectionSigned(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-[#e8e7e4] accent-[#2383e2]"
                />
                <div>
                  <span className="text-sm font-medium text-[#1a1a19]">Signed move-in inspection is on file</span>
                  {!inspectionSigned && (
                    <p className="text-xs text-[#b3261e] mt-0.5">
                      Without a signed inspection, deductions may be challenged in small claims court.
                    </p>
                  )}
                </div>
              </label>
            </div>
            <div className="border-t border-[#e8e7e4] pt-3">
              <p className="text-xs text-[#9b9b99] font-medium uppercase tracking-wide mb-1">Move-Out Condition</p>
              <p className="text-sm text-[#9b9b99] mb-3">
                Check items needing repair. Click Apply to pre-fill suggested charge amounts.
              </p>
              <div className="space-y-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={carpetCondition}
                    onChange={e => { setCarpetCondition(e.target.checked); setPhotosApplied(false); }}
                    className="w-4 h-4 rounded border-[#e8e7e4] accent-[#2383e2]"
                  />
                  <span className="text-sm text-[#1a1a19]">Carpet needs shampooing or replacement</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={paintCondition}
                    onChange={e => { setPaintCondition(e.target.checked); setPhotosApplied(false); }}
                    className="w-4 h-4 rounded border-[#e8e7e4] accent-[#2383e2]"
                  />
                  <span className="text-sm text-[#1a1a19]">Walls or ceiling need repainting</span>
                </label>
              </div>
              <button
                onClick={applyPhotoConditions}
                className="mt-4 px-4 py-2 bg-[#2383e2] text-white text-sm font-medium rounded-lg hover:bg-[#1a6fc7] transition-colors"
              >
                Apply Conditions
              </button>
              {photosApplied && (
                <p className="mt-2 text-xs text-[#1a7a3a]">
                  Applied — suggested amounts added to Total Charges. Adjust as needed.
                </p>
              )}
            </div>
          </div>
        );

      case 'rent':
        return (
          <div className="space-y-3">
            {calculatedCharges.rentDue > 0 ? (
              <CalcCard label="Rent Due" description={calculatedCharges.rentDueDateRange} amount={calculatedCharges.rentDue} color="blue" />
            ) : (
              <p className="text-sm text-[#9b9b99]">No rent owed — tenant paid through move-out date.</p>
            )}
            <div className="bg-[#f5f5f3] rounded-lg p-3 text-xs text-[#9b9b99] space-y-1">
              <p className="font-medium">How this is calculated:</p>
              <p>Paid through: {tenantData.paidThroughDate} · Move-out: {tenantData.moveOutDate}</p>
              {tenantData.leaseBreak && (
                <p className="text-[#8b6a00]">Lease break — rent owed until new tenant moves in or lease ends.</p>
              )}
            </div>
          </div>
        );

      case 'utility':
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <UtilityTag type={utilityData.utilityType} />
              {utilityData.utilityType === 'flat_fee' && (
                <span className="text-sm text-[#9b9b99]">Rate: {formatCurrency(utilityData.flatFeeRate)}</span>
              )}
            </div>
            {utilityData.utilityType === 'RUBS' && (
              <div className="space-y-3">
                <p className="text-sm text-[#9b9b99]">
                  RUBS — enter the final water bill and this unit's ratio to calculate the tenant's share.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-xs text-[#9b9b99] font-medium">Building Total ($)</span>
                    <input
                      type="number" min={0} step={0.01}
                      value={rubsInput.buildingTotal}
                      onChange={e => setRubsInput(prev => ({ ...prev, buildingTotal: parseFloat(e.target.value) || 0 }))}
                      className="mt-1 w-full border border-[#e8e7e4] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2383e2] bg-white"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs text-[#9b9b99] font-medium">Unit Ratio (e.g. 0.08)</span>
                    <input
                      type="number" min={0} max={1} step={0.0001}
                      value={rubsInput.unitRatio}
                      onChange={e => setRubsInput(prev => ({ ...prev, unitRatio: parseFloat(e.target.value) || 0 }))}
                      className="mt-1 w-full border border-[#e8e7e4] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2383e2] bg-white"
                    />
                  </label>
                </div>
              </div>
            )}
            {calculatedCharges.utilityCharge > 0 && (
              <CalcCard
                label="Utility Charge"
                description={utilityData.utilityType === 'RUBS' ? `$${rubsInput.buildingTotal} × ${rubsInput.unitRatio}` : 'Flat fee — billed at move-out'}
                amount={calculatedCharges.utilityCharge}
                color="blue"
              />
            )}
            {utilityData.utilityType === 'flat_fee' && calculatedCharges.utilityCharge === 0 && (
              <p className="text-sm text-[#9b9b99]">Utility is included in rent — no charge at move-out.</p>
            )}
          </div>
        );

      case 'legal':
        return (
          <div className="space-y-3">
            <p className="text-sm text-[#9b9b99]">
              Enter any court filing fees or attorney costs being charged to the tenant.
            </p>
            <label className="block">
              <span className="text-xs text-[#9b9b99] font-medium">Legal / Court Costs ($)</span>
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9b9b99] text-sm">$</span>
                <input
                  type="number" min={0} step={0.01}
                  value={manualCharges.legalCourtCosts}
                  onChange={e => updateCharge('legalCourtCosts', parseFloat(e.target.value) || 0)}
                  className="w-full border border-[#e8e7e4] rounded-lg pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2383e2] bg-white text-right"
                />
              </div>
            </label>
          </div>
        );

      case 'totals': {
        const rows = [
          { label: 'General Cleaning (tenant share)', amount: cleaningTenant },
          { label: 'Blind / Drape Cleaning', amount: manualCharges.blindDrapeCleaning },
          { label: 'Window Covering Replacement', amount: manualCharges.windowCoveringReplacement },
          { label: 'Carpet Shampooing', amount: manualCharges.carpetShampooing },
          { label: 'Flooring Restoration', amount: manualCharges.flooringRestoration },
          { label: 'Painting', amount: manualCharges.painting },
          { label: manualCharges.other1Label || 'Other', amount: manualCharges.other1 },
          { label: manualCharges.other2Label || 'Other', amount: manualCharges.other2 },
          { label: 'Rent Due', amount: calculatedCharges.rentDue },
          { label: 'Utility Charge', amount: calculatedCharges.utilityCharge },
          { label: 'Legal / Court Costs', amount: manualCharges.legalCourtCosts },
        ];
        return (
          <div className="space-y-4">
            <div>
              <p className="text-xs text-[#9b9b99] font-medium uppercase tracking-wide mb-2">Enter Charges</p>
              <div className="space-y-2">
                <ChargeInput label="General Cleaning" chargeKey="generalCleaning" value={manualCharges.generalCleaning} onChange={updateCharge} />
                {depositData.nrcCleaningFee > 0 && manualCharges.generalCleaning > 0 && (
                  <p className="text-xs text-[#1a7a3a] pl-2">
                    NRC offset: {formatCurrency(nrcOffset)} → Tenant pays {formatCurrency(cleaningTenant)}
                  </p>
                )}
                <ChargeInput label="Blind / Drape Cleaning" chargeKey="blindDrapeCleaning" value={manualCharges.blindDrapeCleaning} onChange={updateCharge} />
                <ChargeInput label="Window Covering Replacement" chargeKey="windowCoveringReplacement" value={manualCharges.windowCoveringReplacement} onChange={updateCharge} />
                <ChargeInput label="Carpet Shampooing" chargeKey="carpetShampooing" value={manualCharges.carpetShampooing} onChange={updateCharge} />
                <ChargeInput label="Flooring Restoration" chargeKey="flooringRestoration" value={manualCharges.flooringRestoration} onChange={updateCharge} />
                <ChargeInput label="Painting" chargeKey="painting" value={manualCharges.painting} onChange={updateCharge} />
                <div className="flex items-center gap-2">
                  <input
                    type="text" value={manualCharges.other1Label}
                    onChange={e => updateCharge('other1Label', e.target.value)}
                    placeholder="Label"
                    className="flex-1 border border-[#e8e7e4] rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2383e2] bg-white"
                  />
                  <div className="relative w-28">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9b9b99] text-sm">$</span>
                    <input type="number" min={0} step={0.01} value={manualCharges.other1}
                      onChange={e => updateCharge('other1', parseFloat(e.target.value) || 0)}
                      className="w-full border border-[#e8e7e4] rounded-lg pl-7 pr-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2383e2] bg-white text-right"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text" value={manualCharges.other2Label}
                    onChange={e => updateCharge('other2Label', e.target.value)}
                    placeholder="Label"
                    className="flex-1 border border-[#e8e7e4] rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2383e2] bg-white"
                  />
                  <div className="relative w-28">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9b9b99] text-sm">$</span>
                    <input type="number" min={0} step={0.01} value={manualCharges.other2}
                      onChange={e => updateCharge('other2', parseFloat(e.target.value) || 0)}
                      className="w-full border border-[#e8e7e4] rounded-lg pl-7 pr-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2383e2] bg-white text-right"
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="border-t border-[#e8e7e4] pt-3">
              <p className="text-xs text-[#9b9b99] font-medium uppercase tracking-wide mb-2">Summary</p>
              <table className="w-full text-sm">
                <tbody>
                  {rows.filter(r => r.amount > 0).map(r => (
                    <tr key={r.label} className="border-b border-[#f5f5f3]">
                      <td className="py-1.5 text-[#9b9b99]">{r.label}</td>
                      <td className="py-1.5 text-[#1a1a19] font-medium text-right">{formatCurrency(r.amount)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td className="py-2 font-semibold text-[#1a1a19]">Total Charges</td>
                    <td className="py-2 font-semibold text-[#1a1a19] text-right">{formatCurrency(totalCharges)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        );
      }

      case 'credits':
        return (
          <div className="space-y-3">
            <p className="text-xs text-[#9b9b99] font-medium uppercase tracking-wide">Deposits Held</p>
            <div className="space-y-1">
              <InfoRow label="Security Deposit" value={formatCurrency(depositData.securityDeposit)} variant="auto" />
              {depositData.petDeposit > 0 && <InfoRow label="Pet Deposit" value={formatCurrency(depositData.petDeposit)} variant="auto" />}
              {depositData.keyDeposit > 0 && <InfoRow label="Key Deposit" value={formatCurrency(depositData.keyDeposit)} variant="auto" />}
              {depositData.garageOpenerDeposit > 0 && <InfoRow label="Garage Opener Deposit" value={formatCurrency(depositData.garageOpenerDeposit)} variant="auto" />}
            </div>
            <div className="border-t border-[#e8e7e4] pt-3 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-[#9b9b99]">Total Credits (deposits held)</span>
                <span className="font-medium text-[#1a1a19]">{formatCurrency(totalCredits)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[#9b9b99]">Total Charges</span>
                <span className="font-medium text-[#1a1a19]">{formatCurrency(totalCharges)}</span>
              </div>
              <div className={`flex justify-between text-sm font-bold pt-2 border-t border-[#e8e7e4] ${balance >= 0 ? 'text-[#1a7a3a]' : 'text-[#b3261e]'}`}>
                <span>{balance >= 0 ? 'Return to Tenant' : 'Balance Owed to Landlord'}</span>
                <span>{formatCurrency(Math.abs(balance))}</span>
              </div>
            </div>
          </div>
        );
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f5f3]">
      {/* Header */}
      <div className="bg-white border-b border-[#e8e7e4] px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center gap-4">
          <button
            onClick={() => router.push('/dashboard')}
            className="text-sm text-[#9b9b99] hover:text-[#1a1a19] transition-colors"
          >
            ← Dashboard
          </button>
          <div className="flex-1">
            <h1 className="text-base font-semibold text-[#1a1a19]">
              {tenantData.tenantName} · Unit {tenantData.unit}
            </h1>
            <p className="text-xs text-[#9b9b99]">{session.propertyName}</p>
          </div>
          {/* Toggle between focused section view and full form */}
          <button
            onClick={() => setFullFormMode(m => !m)}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors font-medium ${
              fullFormMode
                ? 'bg-[#1a1a19] text-white border-[#1a1a19]'
                : 'bg-white text-[#1a1a19] border-[#e8e7e4] hover:border-[#9b9b99]'
            }`}
          >
            {fullFormMode ? 'Section view' : 'View full form'}
          </button>
          <button
            onClick={saveAndProceed}
            className="text-sm px-4 py-2 bg-[#2383e2] text-white font-medium rounded-lg hover:bg-[#1a6fc7] transition-colors"
          >
            Review & Submit →
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto flex" style={{ minHeight: 'calc(100vh - 73px)' }}>
        {/* Left sidebar — section list */}
        <aside className="w-64 shrink-0 bg-white border-r border-[#e8e7e4] py-4">
          {SECTIONS.map(s => {
            const isActive = s.key === activeSection;
            return (
              <button
                key={s.key}
                onClick={() => goToSection(s.key)}
                className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors ${
                  isActive
                    ? 'bg-[#f5f5f3] border-r-2 border-[#2383e2]'
                    : 'hover:bg-[#f5f5f3] border-r-2 border-transparent'
                }`}
              >
                <span className={`mt-0.5 w-5 h-5 rounded-full text-xs flex items-center justify-center font-medium shrink-0 ${
                  isActive ? 'bg-[#2383e2] text-white' : 'bg-[#e8e7e4] text-[#9b9b99]'
                }`}>
                  {s.num}
                </span>
                <div className="min-w-0">
                  <p className={`text-sm font-medium truncate ${isActive ? 'text-[#2383e2]' : 'text-[#1a1a19]'}`}>
                    {s.title}
                  </p>
                  <p className="text-xs text-[#9b9b99] mt-0.5 truncate">{s.sub}</p>
                </div>
              </button>
            );
          })}
        </aside>

        {/* Right panel */}
        <main className="flex-1 p-6 overflow-auto">
          {!fullFormMode ? (
            // Focused view — one section at a time
            <div className="max-w-2xl">
              <div className="bg-white rounded-xl border border-[#e8e7e4] p-6">
                <h2 className="text-base font-semibold text-[#1a1a19] mb-0.5">{activeMeta.title}</h2>
                <p className="text-xs text-[#9b9b99] mb-5">{activeMeta.sub}</p>
                {renderSectionContent(activeSection)}
              </div>
              {/* Section prev / next nav */}
              <div className="flex justify-between mt-4">
                {activeIdx > 0 ? (
                  <button
                    onClick={() => goToSection(SECTIONS[activeIdx - 1].key)}
                    className="text-sm px-4 py-2 border border-[#e8e7e4] text-[#1a1a19] rounded-lg hover:bg-[#f5f5f3] transition-colors"
                  >
                    ← {SECTIONS[activeIdx - 1].title}
                  </button>
                ) : <div />}
                {activeIdx < SECTIONS.length - 1 ? (
                  <button
                    onClick={() => goToSection(SECTIONS[activeIdx + 1].key)}
                    className="text-sm px-4 py-2 bg-[#2383e2] text-white rounded-lg hover:bg-[#1a6fc7] transition-colors"
                  >
                    {SECTIONS[activeIdx + 1].title} →
                  </button>
                ) : (
                  <button
                    onClick={saveAndProceed}
                    className="text-sm px-4 py-2 bg-[#1a7a3a] text-white rounded-lg hover:bg-[#155f2e] transition-colors"
                  >
                    Review & Submit →
                  </button>
                )}
              </div>
            </div>
          ) : (
            // Full form — all 9 sections stacked with collapsible headers
            <div className="max-w-2xl space-y-3">
              {SECTIONS.map(s => {
                const isCollapsed = collapsed.has(s.num);
                return (
                  <div
                    key={s.key}
                    className="bg-white rounded-xl border border-[#e8e7e4] overflow-hidden"
                    ref={el => { sectionRefs.current[s.key] = el; }}
                  >
                    <button
                      onClick={() => toggleCollapsed(s.num)}
                      className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-[#f5f5f3] transition-colors"
                    >
                      <span className="w-5 h-5 rounded-full bg-[#e8e7e4] text-[#9b9b99] text-xs flex items-center justify-center font-medium shrink-0">
                        {s.num}
                      </span>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-[#1a1a19]">{s.title}</p>
                        <p className="text-xs text-[#9b9b99]">{s.sub}</p>
                      </div>
                      <span className="text-[#9b9b99] text-xs select-none">{isCollapsed ? '▸' : '▾'}</span>
                    </button>
                    {!isCollapsed && (
                      <div className="px-5 pb-5 border-t border-[#e8e7e4] pt-4">
                        {renderSectionContent(s.key)}
                      </div>
                    )}
                  </div>
                );
              })}
              <button
                onClick={saveAndProceed}
                className="w-full py-3 bg-[#2383e2] text-white font-semibold rounded-xl hover:bg-[#1a6fc7] transition-colors"
              >
                Review & Submit →
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

// --- Sub-components ---

// InfoRow: displays a label + read-only value pair with color coding by data source
// variant "auto" = green (from AppFolio), "calc" = blue (calculated), "manual" = amber (user-entered)
function InfoRow({
  label, value, variant,
}: {
  label: string;
  value: string;
  variant?: 'auto' | 'calc' | 'manual';
}) {
  const valueColor =
    variant === 'auto'   ? 'text-[#1a7a3a]' :
    variant === 'calc'   ? 'text-[#2383e2]' :
    variant === 'manual' ? 'text-[#8b6a00]' :
    'text-[#1a1a19]';
  return (
    <div className="flex justify-between py-1.5 border-b border-[#f5f5f3]">
      <span className="text-sm text-[#9b9b99]">{label}</span>
      <span className={`text-sm font-medium ${valueColor}`}>{value || '—'}</span>
    </div>
  );
}

// CalcCard: highlighted card for auto-calculated amounts
function CalcCard({
  label, description, amount, color,
}: {
  label: string;
  description: string;
  amount: number;
  color: 'green' | 'blue' | 'amber';
}) {
  const styles = {
    green: { bg: 'bg-green-50 border-green-200', text: 'text-[#1a7a3a]' },
    blue:  { bg: 'bg-blue-50 border-blue-200',   text: 'text-[#2383e2]' },
    amber: { bg: 'bg-amber-50 border-amber-200', text: 'text-[#8b6a00]' },
  }[color];
  return (
    <div className={`rounded-lg border p-3 ${styles.bg}`}>
      <div className="flex justify-between items-start">
        <div>
          <p className={`text-sm font-medium ${styles.text}`}>{label}</p>
          <p className="text-xs text-[#9b9b99] mt-0.5">{description}</p>
        </div>
        <span className={`text-sm font-semibold ${styles.text}`}>{formatCurrency(amount)}</span>
      </div>
    </div>
  );
}

// ChargeInput: dollar input for manual charge fields
function ChargeInput({
  label, chargeKey, value, onChange,
}: {
  label: string;
  chargeKey: keyof ManualCharges;
  value: number;
  onChange: (key: keyof ManualCharges, v: number | string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex-1 text-sm text-[#1a1a19]">{label}</span>
      <div className="relative w-28">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9b9b99] text-sm">$</span>
        <input
          type="number" min={0} step={0.01}
          value={value}
          onChange={e => onChange(chargeKey, parseFloat(e.target.value) || 0)}
          className="w-full border border-[#e8e7e4] rounded-lg pl-7 pr-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2383e2] bg-white text-right"
        />
      </div>
    </div>
  );
}
