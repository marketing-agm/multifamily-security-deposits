'use client';

// LiveFormPanel.tsx
// Right panel of the core processing screen.
// Shows a live color-coded preview of the AGM Checkout Report form.
// Green = auto-filled from Excel, Blue = calculated, Orange = manual entry, Purple = final result.

import { TenantReturn } from '@/types';
import { formatCurrency } from '@/lib/calculations';

interface Props {
  tr: TenantReturn;
  filledCount: number;
  totalFields: number;
}

function Field({
  label,
  value,
  variant = 'empty',
}: {
  label: string;
  value: string;
  variant?: 'auto' | 'calc' | 'manual' | 'result' | 'empty' | 'waiting';
}) {
  const variantStyles = {
    auto: 'bg-green-50 border-green-300 text-green-800',
    calc: 'bg-blue-50 border-blue-300 text-blue-800 font-medium',
    manual: 'bg-amber-50 border-amber-300 text-amber-800',
    result: 'bg-purple-50 border-purple-300 text-purple-800 font-medium',
    empty: 'bg-gray-50 border-gray-200 text-gray-400 italic',
    waiting: 'bg-gray-50 border-gray-200 text-gray-400 italic',
  };

  return (
    <div className="flex flex-col gap-0.5">
      <label className="text-xs text-gray-400">{label}</label>
      <div className={`text-xs px-2 py-1 rounded border ${variantStyles[variant]}`}>
        {value || '—'}
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100 pb-1 mb-2 mt-3">
      {children}
    </div>
  );
}

export function LiveFormPanel({ tr, filledCount, totalFields }: Props) {
  const { tenantData, depositData, utilityData, calculatedCharges, manualCharges } = tr;

  const nrcOffset = Math.min(manualCharges.generalCleaning, depositData.nrcCleaningFee);
  const tenantCleaning = Math.max(0, manualCharges.generalCleaning - nrcOffset);
  const totalDeposits = depositData.securityDeposit + depositData.petDeposit + depositData.keyDeposit;
  const totalCharges =
    calculatedCharges.rentDue +
    calculatedCharges.utilityCharge +
    tenantCleaning +
    manualCharges.carpetShampooing +
    manualCharges.painting +
    manualCharges.other1 +
    manualCharges.other2;
  const balance = totalDeposits - totalCharges;

  const fwdAddr = `${tenantData.forwardingAddress.street}, ${tenantData.forwardingAddress.city} ${tenantData.forwardingAddress.state} ${tenantData.forwardingAddress.zip}`;
  const utilityLabel = utilityData.utilityType === 'RUBS'
    ? `RUBS — ${(utilityData.rubsUnitRatio * 100).toFixed(1)}%`
    : 'Flat fee';

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
          AGM Checkout Report — live preview
        </span>
        <span className="text-xs text-gray-400">{filledCount} / {totalFields} fields</span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        <p className="text-xs font-semibold text-center text-gray-600 border-b border-gray-100 pb-2 mb-3">
          Checkout Report · AGM Real Estate
        </p>

        <div className="grid grid-cols-2 gap-2 mb-2">
          <Field label="Property" value="Westlake Commons" variant="auto" />
          <Field label="Unit #" value={tenantData.unit} variant="auto" />
        </div>
        <div className="mb-2">
          <Field label="Tenant" value={tenantData.tenantName} variant="auto" />
        </div>
        <div className="mb-2">
          <Field label="Forwarding address" value={fwdAddr} variant="auto" />
        </div>
        <div className="mb-2">
          <Field
            label="Move-in inspection"
            value={tenantData.inspectionStatus === 'signed' ? '✓ Signed — normal wear and tear confirmed' : '⚠️ Missing'}
            variant={tenantData.inspectionStatus === 'signed' ? 'auto' : 'manual'}
          />
        </div>

        <SectionLabel>Lease summary</SectionLabel>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <Field label="Monthly rent" value={formatCurrency(tenantData.monthlyRent)} variant="auto" />
          <Field label="Security dep." value={formatCurrency(depositData.securityDeposit)} variant="auto" />
          <Field label="NRC fee" value={formatCurrency(depositData.nrcCleaningFee)} variant="auto" />
          <Field label="Utility billing" value={utilityLabel} variant="auto" />
        </div>
        <div className="grid grid-cols-3 gap-2 mb-2">
          <Field label="Move-in" value={tenantData.moveInDate} variant="auto" />
          <Field label="Move-out" value={tenantData.moveOutDate} variant="auto" />
          <Field
            label="Lease break"
            value={tenantData.leaseBreak ? `Yes — ${tenantData.leaseEndDate}` : 'No'}
            variant={tenantData.leaseBreak ? 'calc' : 'auto'}
          />
        </div>

        <SectionLabel>Charges</SectionLabel>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <Field
            label="Rent due"
            value={calculatedCharges.rentDue > 0 ? formatCurrency(calculatedCharges.rentDue) : '$0.00'}
            variant={calculatedCharges.rentDue > 0 ? 'calc' : 'auto'}
          />
          <Field
            label={`Utility (${utilityData.utilityType === 'RUBS' ? 'RUBS' : 'Flat fee'})`}
            value={calculatedCharges.utilityCharge > 0 ? formatCurrency(calculatedCharges.utilityCharge) : '$0.00'}
            variant={calculatedCharges.utilityCharge > 0 ? 'calc' : 'auto'}
          />
          <Field
            label={`Cleaning (NRC −${formatCurrency(nrcOffset)})`}
            value={manualCharges.generalCleaning > 0 ? formatCurrency(tenantCleaning) : ''}
            variant={manualCharges.generalCleaning > 0 ? 'manual' : 'waiting'}
          />
          <Field
            label={manualCharges.other1Label || 'Other'}
            value={manualCharges.other1 > 0 ? formatCurrency(manualCharges.other1) : ''}
            variant={manualCharges.other1 > 0 ? 'manual' : 'waiting'}
          />
        </div>

        <SectionLabel>Deposit / credits</SectionLabel>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <Field label="Security deposit" value={formatCurrency(depositData.securityDeposit)} variant="auto" />
          {depositData.petDeposit > 0 && (
            <Field label="Pet deposit" value={formatCurrency(depositData.petDeposit)} variant="auto" />
          )}
          <Field label="Total credits" value={formatCurrency(totalDeposits)} variant="calc" />
        </div>

        <SectionLabel>Balance</SectionLabel>
        <Field
          label={balance >= 0 ? 'Balance due to tenant' : 'Balance owing landlord'}
          value={formatCurrency(Math.abs(balance))}
          variant="result"
        />

        <div className="flex flex-wrap gap-3 mt-4 pt-3 border-t border-gray-100">
          {[
            { color: 'bg-green-300', label: 'Auto-filled' },
            { color: 'bg-blue-300', label: 'Calculated' },
            { color: 'bg-amber-300', label: 'Manual entry' },
            { color: 'bg-purple-300', label: 'Final result' },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className={`w-2.5 h-2.5 rounded-sm ${color}`} />
              <span className="text-xs text-gray-400">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
