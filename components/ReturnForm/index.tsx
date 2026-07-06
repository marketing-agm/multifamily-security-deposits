'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/context/SessionContext';
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

  useEffect(() => {
    if (!session) router.replace('/');
  }, [session, router]);

  if (!tenantReturn) return null;

  const currentInspectionStatus: 'signed' | 'missing' = inspectionSigned ? 'signed' : 'missing';
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
  const cleaningTenant = calcNRCOffset(manualCharges.generalCleaning, tenantReturn.depositData.nrcCleaningFee);

  function saveProgress(extraStatus?: TenantReturn['processingStatus']) {
    updateReturn(returnId, {
      manualCharges,
      rubsManualInput: rubsInput,
      calculatedCharges,
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

  const { tenantData, depositData, utilityData } = tenantReturn;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="w-full flex items-center gap-4">
          <button onClick={() => router.push('/dashboard')} className="text-sm text-gray-500 hover:text-gray-700">
            ← Dashboard
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold text-gray-900">
              {tenantData.tenantName} · Unit {tenantData.unit}
            </h1>
          </div>
          <InspectionBadge status={currentInspectionStatus} />
          <UtilityTag type={utilityData.utilityType} />
        </div>
        {/* Step bar */}
        <div className="w-full mt-3 flex gap-0">
          {STEPS.map((label, i) => (
            <button
              key={label}
              onClick={() => setStep(i)}
              className={`flex-1 text-xs py-1.5 border-b-2 transition-colors font-medium ${
                i === step ? 'border-blue-600 text-blue-700' :
                i < step ? 'border-green-400 text-green-600' : 'border-gray-200 text-gray-400'
              }`}
            >
              {i < step ? '✓ ' : ''}{label}
            </button>
          ))}
        </div>
      </div>

      <div className="w-full px-6 py-6 grid grid-cols-2 gap-6">
        {/* Left panel — data entry / prompts */}
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
              utilityData={utilityData}
              rubsInput={rubsInput}
              onRubsChange={setRubsInput}
              utilityCharge={calculatedCharges.utilityCharge}
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
            <div className="bg-white rounded-xl border border-gray-200 p-6 text-center space-y-4">
              <p className="text-gray-700">All steps complete. Proceed to compliance review and PDF download.</p>
              <button
                onClick={goToReview}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg transition-colors"
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
                  className="flex-1 border border-gray-300 text-gray-700 font-medium py-2.5 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Back
                </button>
              )}
              <button
                onClick={saveAndContinue}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg transition-colors"
              >
                {step === 4 ? 'Go to Submit →' : 'Continue →'}
              </button>
            </div>
          )}
        </div>

        {/* Right panel — live form summary */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3 self-start sticky top-6">
          <h2 className="text-sm font-semibold text-gray-700 border-b border-gray-100 pb-2">Live Form Preview</h2>
          <SummaryRow label="Tenant" value={tenantData.tenantName} />
          <SummaryRow label="Unit" value={tenantData.unit} />
          <SummaryRow label="Move-Out" value={tenantData.moveOutDate} />
          <SummaryRow label="Monthly Rent" value={formatCurrency(tenantData.monthlyRent)} />
          <SummaryRow label="Security Deposit" value={formatCurrency(depositData.securityDeposit)} />
          {depositData.petDeposit > 0 && <SummaryRow label="Pet Deposit" value={formatCurrency(depositData.petDeposit)} />}
          {depositData.nrcCleaningFee > 0 && <SummaryRow label="NRC Cleaning" value={formatCurrency(depositData.nrcCleaningFee)} />}
          <div className="border-t border-gray-100 pt-2 space-y-1">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Charges</h3>
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
          <div className="border-t border-gray-200 pt-2 space-y-1">
            <SummaryRow label="Total Charges" value={formatCurrency(totalCharges)} bold />
            <SummaryRow label="Total Credits" value={formatCurrency(totalCredits)} bold />
            <div className={`flex justify-between text-sm font-bold ${balance >= 0 ? 'text-green-700' : 'text-red-700'}`}>
              <span>{balance >= 0 ? 'Return to Tenant' : 'Balance Owed'}</span>
              <span>{formatCurrency(Math.abs(balance))}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Step sub-components

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1 border-b border-gray-50">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-900">{value || '—'}</span>
    </div>
  );
}

function SummaryRow({ label, value, bold, sub }: { label: string; value: string; bold?: boolean; sub?: boolean }) {
  return (
    <div className={`flex justify-between ${sub ? 'pl-3' : ''}`}>
      <span className={`text-sm ${bold ? 'font-semibold text-gray-800' : 'text-gray-500'}`}>{label}</span>
      <span className={`text-sm ${bold ? 'font-semibold text-gray-800' : 'text-gray-700'}`}>{value}</span>
    </div>
  );
}

function StepTenant({
  t, inspectionSigned, onInspectionChange,
}: {
  t: TenantReturn['tenantData'];
  inspectionSigned: boolean;
  onInspectionChange: (v: boolean) => void;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-1">
      <h2 className="text-sm font-semibold text-gray-700 mb-3">Tenant Information</h2>
      <Field label="Tenant Name" value={t.tenantName} />
      <Field label="Co-Tenant" value={t.coTenant} />
      <Field label="Unit" value={t.unit} />
      <Field label="Forwarding Street" value={t.forwardingAddress.street} />
      <Field label="City / State / ZIP" value={[t.forwardingAddress.city, t.forwardingAddress.state, t.forwardingAddress.zip].filter(Boolean).join(', ')} />

      <div className="pt-3 border-t border-gray-100 mt-2">
        <label className="flex items-start gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={inspectionSigned}
            onChange={e => onInspectionChange(e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded border-gray-300 accent-blue-600"
          />
          <div>
            <span className="text-sm font-medium text-gray-800">Signed move-in inspection is on file</span>
            {!inspectionSigned && (
              <p className="text-xs text-red-600 mt-0.5">
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
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-1">
      <h2 className="text-sm font-semibold text-gray-700 mb-3">Lease Details</h2>
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
  utilityData, rubsInput, onRubsChange, utilityCharge,
}: {
  utilityData: TenantReturn['utilityData'];
  rubsInput: RUBSManualInput;
  onRubsChange: (v: RUBSManualInput) => void;
  utilityCharge: number;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      <h2 className="text-sm font-semibold text-gray-700">Utility</h2>
      <div className="flex items-center gap-2">
        <UtilityTag type={utilityData.utilityType} />
        {utilityData.utilityType === 'flat_fee' && (
          <span className="text-sm text-gray-600">
            Rate: {formatCurrency(utilityData.flatFeeRate)} ·{' '}
            {utilityData.flatFeeBillingMethod === 'included_in_rent' ? 'Included in rent (no charge at move-out)' : 'Billed at move-out'}
          </span>
        )}
      </div>

      {utilityData.utilityType === 'RUBS' && (
        <div className="space-y-3 border-t border-gray-100 pt-4">
          <p className="text-sm text-gray-600">
            Enter the final water bill from the city. RUBS charge = Building Total × Unit Ratio.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs text-gray-500 font-medium">Building Total ($)</span>
              <input
                type="number"
                min={0}
                step={0.01}
                value={rubsInput.buildingTotal}
                onChange={e => onRubsChange({ ...rubsInput, buildingTotal: parseFloat(e.target.value) || 0 })}
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
            <label className="block">
              <span className="text-xs text-gray-500 font-medium">Unit Ratio (e.g. 0.08)</span>
              <input
                type="number"
                min={0}
                max={1}
                step={0.0001}
                value={rubsInput.unitRatio}
                onChange={e => onRubsChange({ ...rubsInput, unitRatio: parseFloat(e.target.value) || 0 })}
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
          </div>
          <p className="text-sm font-medium text-blue-700">
            Calculated Tenant Share: {formatCurrency(utilityCharge)}
          </p>
        </div>
      )}

      {utilityData.utilityType === 'flat_fee' && utilityCharge === 0 && (
        <p className="text-sm text-gray-500">Utility included in rent — no charge at move-out.</p>
      )}
      {utilityData.utilityType === 'flat_fee' && utilityCharge > 0 && (
        <p className="text-sm font-medium text-blue-700">Calculated Utility Charge: {formatCurrency(utilityCharge)}</p>
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
      <span className="flex-1 text-sm text-gray-700">{label}</span>
      <div className="relative w-32">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
        <input
          type="number"
          min={0}
          step={0.01}
          value={value}
          onChange={e => onChange(chargeKey, parseFloat(e.target.value) || 0)}
          className="w-full border border-gray-300 rounded-lg pl-7 pr-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-right"
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
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
      <h2 className="text-sm font-semibold text-gray-700">Turnover Charges</h2>
      <p className="text-xs text-gray-500">Enter total cost for each item. NRC offset is applied automatically to cleaning.</p>
      <div className="space-y-2">
        <ChargeInput label="General Cleaning" chargeKey="generalCleaning" value={manualCharges.generalCleaning} onChange={onChange} />
        {nrcCleaning > 0 && (
          <p className="text-xs text-green-700 pl-1">
            NRC offset: {formatCurrency(nrcCleaning)} → Tenant pays {formatCurrency(cleaningTenant)}
          </p>
        )}
        <ChargeInput label="Blind / Drape Cleaning" chargeKey="blindDrapeCleaning" value={manualCharges.blindDrapeCleaning} onChange={onChange} />
        <ChargeInput label="Window Covering Replacement" chargeKey="windowCoveringReplacement" value={manualCharges.windowCoveringReplacement} onChange={onChange} />
        <ChargeInput label="Carpet Shampooing" chargeKey="carpetShampooing" value={manualCharges.carpetShampooing} onChange={onChange} />
        <ChargeInput label="Flooring Restoration" chargeKey="flooringRestoration" value={manualCharges.flooringRestoration} onChange={onChange} />
        <ChargeInput label="Painting" chargeKey="painting" value={manualCharges.painting} onChange={onChange} />
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={manualCharges.other1Label}
            onChange={e => onChange('other1Label', e.target.value)}
            placeholder="Other label"
            className="flex-1 border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="relative w-32">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
            <input
              type="number" min={0} step={0.01} value={manualCharges.other1}
              onChange={e => onChange('other1', parseFloat(e.target.value) || 0)}
              className="w-full border border-gray-300 rounded-lg pl-7 pr-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-right"
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={manualCharges.other2Label}
            onChange={e => onChange('other2Label', e.target.value)}
            placeholder="Other label"
            className="flex-1 border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="relative w-32">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
            <input
              type="number" min={0} step={0.01} value={manualCharges.other2}
              onChange={e => onChange('other2', parseFloat(e.target.value) || 0)}
              className="w-full border border-gray-300 rounded-lg pl-7 pr-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-right"
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
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
      <h2 className="text-sm font-semibold text-gray-700">Calculation Summary</h2>
      <div className="space-y-1">
        <h3 className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Credits</h3>
        <SummaryRow label="Security Deposit" value={formatCurrency(displayReturn.depositData.securityDeposit)} />
        {displayReturn.depositData.petDeposit > 0 && <SummaryRow label="Pet Deposit" value={formatCurrency(displayReturn.depositData.petDeposit)} />}
        {displayReturn.depositData.keyDeposit > 0 && <SummaryRow label="Key Deposit" value={formatCurrency(displayReturn.depositData.keyDeposit)} />}
        {displayReturn.depositData.garageOpenerDeposit > 0 && <SummaryRow label="Garage Deposit" value={formatCurrency(displayReturn.depositData.garageOpenerDeposit)} />}
        <SummaryRow label="Total Credits" value={formatCurrency(totalCredits)} bold />
      </div>
      <div className="space-y-1 border-t border-gray-100 pt-2">
        <h3 className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Charges</h3>
        <SummaryRow label="Total Charges" value={formatCurrency(totalCharges)} bold />
      </div>
      <div className={`border-t border-gray-200 pt-2 text-sm font-bold flex justify-between ${balance >= 0 ? 'text-green-700' : 'text-red-700'}`}>
        <span>{balance >= 0 ? 'Return to Tenant' : 'Balance Owed to Landlord'}</span>
        <span>{formatCurrency(Math.abs(balance))}</span>
      </div>
      {displayReturn.tenantData.inspectionStatus === 'missing' && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          Warning: Signed move-in inspection is not on file. Deductions may be challenged in small claims court.
        </div>
      )}
    </div>
  );
}
