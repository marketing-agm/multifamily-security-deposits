'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/context/SessionContext';
import { useTheme } from '@/context/ThemeContext';
import { ManualCharges, TenantReturn, RUBSManualInput } from '@/types';
import { computeCalculatedCharges, calcNRCOffset, calcTotalCharges, calcTotalCredits, calcBalance, formatCurrency } from '@/lib/calculations';
import { InspectionBadge } from '@/components/shared/InspectionBadge';
import { UtilityTag } from '@/components/shared/UtilityTag';

const STEPS = ['Tenant', 'Lease', 'Utility', 'Charges', 'Review', 'Submit'];

interface Props {
  returnId: string;
}

export function ReturnForm({ returnId }: Props) {
  const { session, updateReturn } = useSession();
  const { theme, toggle } = useTheme();
  const router = useRouter();
  const [step, setStep] = useState(0);

  const tenantReturn = session?.returns.find(r => r.id === returnId);

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
  // Pre-filled from property config via parser; editable per tenant
  const [utilityRate, setUtilityRate] = useState<number>(
    tenantReturn?.utilityData.flatFeeRate ?? 0
  );

  useEffect(() => {
    if (!session) router.replace('/');
  }, [session, router]);

  if (!tenantReturn) return null;

  const currentInspectionStatus: 'signed' | 'missing' = inspectionSigned ? 'signed' : 'missing';
  const liveUtilityData = { ...tenantReturn.utilityData, flatFeeRate: utilityRate };
  const withCharges = {
    ...tenantReturn,
    manualCharges,
    rubsManualInput: rubsInput,
    utilityData: liveUtilityData,
    tenantData: { ...tenantReturn.tenantData, inspectionStatus: currentInspectionStatus },
  };
  const calculatedCharges = computeCalculatedCharges(withCharges);
  const displayReturn: TenantReturn = { ...withCharges, calculatedCharges };

  const totalCharges = calcTotalCharges(displayReturn);
  const totalCredits = calcTotalCredits(displayReturn);
  const balance = calcBalance(displayReturn);
  const cleaningTenant = calcNRCOffset(manualCharges.generalCleaning, tenantReturn.depositData.nrcCleaningFee);

  function saveProgress(extraStatus?: TenantReturn['processingStatus']) {
    updateReturn(returnId, {
      manualCharges,
      rubsManualInput: rubsInput,
      calculatedCharges,
      utilityData: liveUtilityData,
      tenantData: { ...tenantReturn!.tenantData, inspectionStatus: currentInspectionStatus },
      processingStatus: extraStatus ?? (step < 4 ? 'in_progress' : tenantReturn!.processingStatus),
    });
  }

  function saveAndContinue() {
    saveProgress();
    if (step < STEPS.length - 1) setStep(s => s + 1);
  }

  function goToReview() {
    saveProgress('in_progress');
    router.push(`/review/${returnId}`);
  }

  function updateCharge(key: keyof ManualCharges, value: number | string) {
    setManualCharges(prev => ({ ...prev, [key]: value }));
  }

  const { tenantData, depositData } = tenantReturn;

  return (
    <div className="min-h-screen bg-[#f2f2f7] dark:bg-[#1c1c1e]">
      {/* Header */}
      <div className="bg-white dark:bg-[#2c2c2e] border-b border-[#e5e5ea] dark:border-[#38383a] px-6 py-4">
        <div className="w-full flex items-center gap-4">
          <button
            onClick={() => router.push('/dashboard')}
            className="text-sm text-[#8e8e93] hover:text-[#1c1c1e] dark:hover:text-white transition-colors"
          >
            ← Dashboard
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold text-[#1c1c1e] dark:text-white">
              {tenantData.tenantName} · Unit {tenantData.unit}
            </h1>
          </div>
          <InspectionBadge status={currentInspectionStatus} />
          <UtilityTag type={liveUtilityData.utilityType} />
          {/* Dark mode toggle */}
          <button
            onClick={toggle}
            className="w-9 h-9 rounded-full bg-[#f2f2f7] dark:bg-[#3a3a3c] flex items-center justify-center text-base hover:bg-[#e5e5ea] dark:hover:bg-[#48484a] transition-colors"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>
        {/* Step bar */}
        <div className="w-full mt-3 flex gap-0">
          {STEPS.map((label, i) => (
            <button
              key={label}
              onClick={() => setStep(i)}
              className={`flex-1 text-xs py-1.5 border-b-2 transition-colors font-medium ${
                i === step
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : i < step
                  ? 'border-green-400 text-green-600 dark:text-green-400'
                  : 'border-[#e5e5ea] dark:border-[#38383a] text-[#8e8e93]'
              }`}
            >
              {i < step ? '✓ ' : ''}{label}
            </button>
          ))}
        </div>
      </div>

      <div className="w-full px-6 py-6 grid grid-cols-2 gap-6">
        {/* Left panel — data entry */}
        <div className="space-y-4">
          {step === 0 && (
            <StepTenant
              t={tenantData}
              inspectionSigned={inspectionSigned}
              onInspectionChange={setInspectionSigned}
            />
          )}
          {step === 1 && <StepLease t={tenantData} />}
          {step === 2 && (
            <StepUtility
              utilityData={liveUtilityData}
              rubsInput={rubsInput}
              onRubsChange={setRubsInput}
              utilityCharge={calculatedCharges.utilityCharge}
              utilityRate={utilityRate}
              onRateChange={setUtilityRate}
            />
          )}
          {step === 3 && (
            <StepCharges
              manualCharges={manualCharges}
              onChange={updateCharge}
              nrcCleaning={depositData.nrcCleaningFee}
              cleaningTenant={cleaningTenant}
            />
          )}
          {step === 4 && (
            <StepReview
              displayReturn={displayReturn}
              totalCharges={totalCharges}
              totalCredits={totalCredits}
              balance={balance}
            />
          )}
          {step === 5 && (
            <div className="bg-white dark:bg-[#2c2c2e] rounded-2xl border border-[#e5e5ea] dark:border-[#38383a] p-6 text-center space-y-4">
              <p className="text-[#1c1c1e] dark:text-[#ebebf5]">All steps complete. Proceed to compliance review and PDF download.</p>
              <button
                onClick={goToReview}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl transition-colors"
              >
                Go to Review & Submit →
              </button>
            </div>
          )}

          {step < 5 && (
            <div className="flex gap-3">
              {step > 0 && (
                <button
                  onClick={() => setStep(s => s - 1)}
                  className="flex-1 border border-[#e5e5ea] dark:border-[#48484a] text-[#1c1c1e] dark:text-[#ebebf5] font-medium py-2.5 rounded-xl hover:bg-[#f2f2f7] dark:hover:bg-[#3a3a3c] transition-colors"
                >
                  Back
                </button>
              )}
              <button
                onClick={saveAndContinue}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl transition-colors"
              >
                {step === 4 ? 'Go to Submit →' : 'Continue →'}
              </button>
            </div>
          )}
        </div>

        {/* Right panel — live form summary */}
        <div className="bg-white dark:bg-[#2c2c2e] rounded-2xl border border-[#e5e5ea] dark:border-[#38383a] p-5 space-y-3 self-start sticky top-6">
          <p className="text-xs font-semibold text-[#8e8e93] uppercase tracking-wider pb-2 border-b border-[#e5e5ea] dark:border-[#38383a]">
            Live Preview
          </p>
          <SummaryRow label="Tenant" value={tenantData.tenantName} />
          <SummaryRow label="Unit" value={tenantData.unit} />
          <SummaryRow label="Move-Out" value={tenantData.moveOutDate} />
          <SummaryRow label="Monthly Rent" value={formatCurrency(tenantData.monthlyRent)} />
          <SummaryRow label="Security Deposit" value={formatCurrency(depositData.securityDeposit)} />
          {depositData.petDeposit > 0 && <SummaryRow label="Pet Deposit" value={formatCurrency(depositData.petDeposit)} />}
          {depositData.nrcCleaningFee > 0 && <SummaryRow label="NRC Cleaning" value={formatCurrency(depositData.nrcCleaningFee)} />}
          <div className="border-t border-[#e5e5ea] dark:border-[#38383a] pt-2 space-y-1">
            <p className="text-xs font-semibold text-[#8e8e93] uppercase tracking-wider">Charges</p>
            {manualCharges.generalCleaning > 0 && (
              <SummaryRow label="Cleaning (tenant)" value={formatCurrency(cleaningTenant)} sub />
            )}
            {manualCharges.carpetShampooing > 0 && (
              <SummaryRow label="Carpet" value={formatCurrency(manualCharges.carpetShampooing)} sub />
            )}
            {manualCharges.painting > 0 && (
              <SummaryRow label="Painting" value={formatCurrency(manualCharges.painting)} sub />
            )}
            {calculatedCharges.rentDue > 0 && (
              <SummaryRow label="Rent Due" value={formatCurrency(calculatedCharges.rentDue)} sub />
            )}
            {calculatedCharges.utilityCharge > 0 && (
              <SummaryRow label="Utility" value={formatCurrency(calculatedCharges.utilityCharge)} sub />
            )}
          </div>
          <div className="border-t border-[#e5e5ea] dark:border-[#38383a] pt-2 space-y-1">
            <SummaryRow label="Total Charges" value={formatCurrency(totalCharges)} bold />
            <SummaryRow label="Total Credits" value={formatCurrency(totalCredits)} bold />
            <div className={`flex justify-between text-sm font-bold ${balance >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              <span>{balance >= 0 ? 'Return to Tenant' : 'Balance Owed'}</span>
              <span>{formatCurrency(Math.abs(balance))}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Shared sub-components ──────────────────────────────────────────────────

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1.5 border-b border-[#f2f2f7] dark:border-[#38383a]">
      <span className="text-sm text-[#8e8e93]">{label}</span>
      <span className="text-sm font-medium text-[#1c1c1e] dark:text-[#ebebf5]">{value || '—'}</span>
    </div>
  );
}

function SummaryRow({ label, value, bold, sub }: { label: string; value: string; bold?: boolean; sub?: boolean }) {
  return (
    <div className={`flex justify-between ${sub ? 'pl-3' : ''}`}>
      <span className={`text-sm ${bold ? 'font-semibold text-[#1c1c1e] dark:text-white' : 'text-[#8e8e93]'}`}>{label}</span>
      <span className={`text-sm ${bold ? 'font-semibold text-[#1c1c1e] dark:text-white' : 'text-[#1c1c1e] dark:text-[#ebebf5]'}`}>{value}</span>
    </div>
  );
}

// ── Step sub-components ────────────────────────────────────────────────────

function StepTenant({
  t, inspectionSigned, onInspectionChange,
}: {
  t: TenantReturn['tenantData'];
  inspectionSigned: boolean;
  onInspectionChange: (v: boolean) => void;
}) {
  return (
    <div className="bg-white dark:bg-[#2c2c2e] rounded-2xl border border-[#e5e5ea] dark:border-[#38383a] p-5 space-y-1">
      <p className="text-xs font-semibold text-[#8e8e93] uppercase tracking-wider mb-3">Tenant Information</p>
      <Field label="Tenant Name" value={t.tenantName} />
      <Field label="Co-Tenant" value={t.coTenant} />
      <Field label="Unit" value={t.unit} />
      <Field label="Forwarding Street" value={t.forwardingAddress.street} />
      <Field label="City / State / ZIP" value={[t.forwardingAddress.city, t.forwardingAddress.state, t.forwardingAddress.zip].filter(Boolean).join(', ')} />

      <div className="pt-3 border-t border-[#e5e5ea] dark:border-[#38383a] mt-2">
        <label className="flex items-start gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={inspectionSigned}
            onChange={e => onInspectionChange(e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded border-gray-300 accent-blue-600"
          />
          <div>
            <span className="text-sm font-medium text-[#1c1c1e] dark:text-[#ebebf5]">Signed move-in inspection is on file</span>
            {!inspectionSigned && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">
                Without a signed inspection, deductions may be challenged in small claims court.
              </p>
            )}
          </div>
        </label>
      </div>
    </div>
  );
}

function StepLease({ t }: { t: TenantReturn['tenantData'] }) {
  return (
    <div className="bg-white dark:bg-[#2c2c2e] rounded-2xl border border-[#e5e5ea] dark:border-[#38383a] p-5 space-y-1">
      <p className="text-xs font-semibold text-[#8e8e93] uppercase tracking-wider mb-3">Lease Details</p>
      <Field label="Monthly Rent" value={formatCurrency(t.monthlyRent)} />
      <Field label="Move-In Date" value={t.moveInDate} />
      <Field label="Move-Out Date" value={t.moveOutDate} />
      <Field label="Paid Through" value={t.paidThroughDate} />
      <Field label="Notice Date" value={t.noticeDate} />
      <Field label="Lease End Date" value={t.leaseEndDate} />
      <Field label="Lease Break" value={t.leaseBreak ? 'Yes' : 'No'} />
      {t.leaseBreak && <Field label="New Tenant Move-In" value={t.newTenantMoveInDate ?? 'None confirmed'} />}
    </div>
  );
}

function StepUtility({
  utilityData, rubsInput, onRubsChange, utilityCharge, utilityRate, onRateChange,
}: {
  utilityData: TenantReturn['utilityData'];
  rubsInput: RUBSManualInput;
  onRubsChange: (v: RUBSManualInput) => void;
  utilityCharge: number;
  utilityRate: number;
  onRateChange: (v: number) => void;
}) {
  return (
    <div className="bg-white dark:bg-[#2c2c2e] rounded-2xl border border-[#e5e5ea] dark:border-[#38383a] p-5 space-y-4">
      <p className="text-xs font-semibold text-[#8e8e93] uppercase tracking-wider">Utility</p>
      <div className="flex items-center gap-2">
        <UtilityTag type={utilityData.utilityType} />
      </div>

      {utilityData.utilityType === 'flat_fee' && (
        <div className="space-y-3 border-t border-[#e5e5ea] dark:border-[#38383a] pt-4">
          <p className="text-sm text-[#8e8e93]">
            Monthly flat fee charged at move-out. Pre-filled from property config — edit if this unit differs.
          </p>
          <label className="block">
            <span className="text-xs text-[#8e8e93] font-medium">Flat Fee Rate ($/month)</span>
            <div className="relative mt-1 w-40">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8e8e93] text-sm">$</span>
              <input
                type="number"
                min={0}
                step={0.01}
                value={utilityRate}
                onChange={e => onRateChange(parseFloat(e.target.value) || 0)}
                className="w-full bg-[#f2f2f7] dark:bg-[#3a3a3c] border border-[#e5e5ea] dark:border-[#48484a] rounded-xl pl-7 pr-3 py-2 text-sm text-[#1c1c1e] dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </label>
          {utilityCharge === 0 ? (
            <p className="text-sm text-[#8e8e93]">Utility included in rent — no charge at move-out.</p>
          ) : (
            <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
              Calculated Utility Charge: {formatCurrency(utilityCharge)}
            </p>
          )}
        </div>
      )}

      {utilityData.utilityType === 'RUBS' && (
        <div className="space-y-3 border-t border-[#e5e5ea] dark:border-[#38383a] pt-4">
          <p className="text-sm text-[#8e8e93]">
            Enter the final water bill from the city. RUBS charge = Building Total × Unit Ratio.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs text-[#8e8e93] font-medium">Building Total ($)</span>
              <input
                type="number"
                min={0}
                step={0.01}
                value={rubsInput.buildingTotal}
                onChange={e => onRubsChange({ ...rubsInput, buildingTotal: parseFloat(e.target.value) || 0 })}
                className="mt-1 w-full bg-[#f2f2f7] dark:bg-[#3a3a3c] border border-[#e5e5ea] dark:border-[#48484a] rounded-xl px-3 py-2 text-sm text-[#1c1c1e] dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
            <label className="block">
              <span className="text-xs text-[#8e8e93] font-medium">Unit Ratio (e.g. 0.08)</span>
              <input
                type="number"
                min={0}
                max={1}
                step={0.0001}
                value={rubsInput.unitRatio}
                onChange={e => onRubsChange({ ...rubsInput, unitRatio: parseFloat(e.target.value) || 0 })}
                className="mt-1 w-full bg-[#f2f2f7] dark:bg-[#3a3a3c] border border-[#e5e5ea] dark:border-[#48484a] rounded-xl px-3 py-2 text-sm text-[#1c1c1e] dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
          </div>
          <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
            Calculated Tenant Share: {formatCurrency(utilityCharge)}
          </p>
        </div>
      )}
    </div>
  );
}

function ChargeInput({
  label, chargeKey, value, onChange,
}: {
  label: string;
  chargeKey: keyof ManualCharges;
  value: number;
  onChange: (key: keyof ManualCharges, v: number) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex-1 text-sm text-[#1c1c1e] dark:text-[#ebebf5]">{label}</span>
      <div className="relative w-32">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8e8e93] text-sm">$</span>
        <input
          type="number"
          min={0}
          step={0.01}
          value={value}
          onChange={e => onChange(chargeKey, parseFloat(e.target.value) || 0)}
          className="w-full bg-[#f2f2f7] dark:bg-[#3a3a3c] border border-[#e5e5ea] dark:border-[#48484a] rounded-xl pl-7 pr-3 py-1.5 text-sm text-[#1c1c1e] dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-right"
        />
      </div>
    </div>
  );
}

function StepCharges({
  manualCharges, onChange, nrcCleaning, cleaningTenant,
}: {
  manualCharges: ManualCharges;
  onChange: (key: keyof ManualCharges, v: number | string) => void;
  nrcCleaning: number;
  cleaningTenant: number;
}) {
  return (
    <div className="bg-white dark:bg-[#2c2c2e] rounded-2xl border border-[#e5e5ea] dark:border-[#38383a] p-5 space-y-3">
      <p className="text-xs font-semibold text-[#8e8e93] uppercase tracking-wider">Turnover Charges</p>
      <p className="text-xs text-[#8e8e93]">Enter total cost for each item. NRC offset is applied automatically to cleaning.</p>
      <div className="space-y-2">
        <ChargeInput label="General Cleaning" chargeKey="generalCleaning" value={manualCharges.generalCleaning} onChange={onChange} />
        {nrcCleaning > 0 && (
          <p className="text-xs text-green-600 dark:text-green-400 pl-1">
            NRC offset: {formatCurrency(nrcCleaning)} → Tenant pays {formatCurrency(cleaningTenant)}
          </p>
        )}
        <ChargeInput label="Blind / Drape Cleaning" chargeKey="blindDrapeCleaning" value={manualCharges.blindDrapeCleaning} onChange={onChange} />
        <ChargeInput label="Window Covering Replacement" chargeKey="windowCoveringReplacement" value={manualCharges.windowCoveringReplacement} onChange={onChange} />
        <ChargeInput label="Carpet Shampooing" chargeKey="carpetShampooing" value={manualCharges.carpetShampooing} onChange={onChange} />
        <ChargeInput label="Flooring Restoration" chargeKey="flooringRestoration" value={manualCharges.flooringRestoration} onChange={onChange} />
        <ChargeInput label="Painting" chargeKey="painting" value={manualCharges.painting} onChange={onChange} />
        {/* Other 1 — editable label + amount */}
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={manualCharges.other1Label}
            onChange={e => onChange('other1Label', e.target.value)}
            placeholder="Other label"
            className="flex-1 bg-[#f2f2f7] dark:bg-[#3a3a3c] border border-[#e5e5ea] dark:border-[#48484a] rounded-xl px-3 py-1.5 text-sm text-[#1c1c1e] dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="relative w-32">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8e8e93] text-sm">$</span>
            <input
              type="number" min={0} step={0.01} value={manualCharges.other1}
              onChange={e => onChange('other1', parseFloat(e.target.value) || 0)}
              className="w-full bg-[#f2f2f7] dark:bg-[#3a3a3c] border border-[#e5e5ea] dark:border-[#48484a] rounded-xl pl-7 pr-3 py-1.5 text-sm text-[#1c1c1e] dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-right"
            />
          </div>
        </div>
        {/* Other 2 — editable label + amount */}
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={manualCharges.other2Label}
            onChange={e => onChange('other2Label', e.target.value)}
            placeholder="Other label"
            className="flex-1 bg-[#f2f2f7] dark:bg-[#3a3a3c] border border-[#e5e5ea] dark:border-[#48484a] rounded-xl px-3 py-1.5 text-sm text-[#1c1c1e] dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="relative w-32">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8e8e93] text-sm">$</span>
            <input
              type="number" min={0} step={0.01} value={manualCharges.other2}
              onChange={e => onChange('other2', parseFloat(e.target.value) || 0)}
              className="w-full bg-[#f2f2f7] dark:bg-[#3a3a3c] border border-[#e5e5ea] dark:border-[#48484a] rounded-xl pl-7 pr-3 py-1.5 text-sm text-[#1c1c1e] dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-right"
            />
          </div>
        </div>
        <ChargeInput label="Legal / Court Costs" chargeKey="legalCourtCosts" value={manualCharges.legalCourtCosts} onChange={onChange} />
      </div>
    </div>
  );
}

function StepReview({
  displayReturn, totalCharges, totalCredits, balance,
}: {
  displayReturn: TenantReturn;
  totalCharges: number;
  totalCredits: number;
  balance: number;
}) {
  return (
    <div className="bg-white dark:bg-[#2c2c2e] rounded-2xl border border-[#e5e5ea] dark:border-[#38383a] p-5 space-y-3">
      <p className="text-xs font-semibold text-[#8e8e93] uppercase tracking-wider">Calculation Summary</p>
      <div className="space-y-1">
        <p className="text-xs text-[#8e8e93] font-semibold uppercase tracking-wide">Credits</p>
        <SummaryRow label="Security Deposit" value={formatCurrency(displayReturn.depositData.securityDeposit)} />
        {displayReturn.depositData.petDeposit > 0 && <SummaryRow label="Pet Deposit" value={formatCurrency(displayReturn.depositData.petDeposit)} />}
        {displayReturn.depositData.keyDeposit > 0 && <SummaryRow label="Key Deposit" value={formatCurrency(displayReturn.depositData.keyDeposit)} />}
        {displayReturn.depositData.garageOpenerDeposit > 0 && <SummaryRow label="Garage Deposit" value={formatCurrency(displayReturn.depositData.garageOpenerDeposit)} />}
        <SummaryRow label="Total Credits" value={formatCurrency(totalCredits)} bold />
      </div>
      <div className="space-y-1 border-t border-[#e5e5ea] dark:border-[#38383a] pt-2">
        <p className="text-xs text-[#8e8e93] font-semibold uppercase tracking-wide">Charges</p>
        <SummaryRow label="Total Charges" value={formatCurrency(totalCharges)} bold />
      </div>
      <div className={`border-t border-[#e5e5ea] dark:border-[#38383a] pt-2 text-sm font-bold flex justify-between ${balance >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
        <span>{balance >= 0 ? 'Return to Tenant' : 'Balance Owed to Landlord'}</span>
        <span>{formatCurrency(Math.abs(balance))}</span>
      </div>
      {displayReturn.tenantData.inspectionStatus === 'missing' && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 text-sm text-red-700 dark:text-red-400">
          Warning: Signed move-in inspection is not on file. Deductions may be challenged in small claims court.
        </div>
      )}
    </div>
  );
}
