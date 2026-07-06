'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/context/SessionContext';
import { useTheme } from '@/context/ThemeContext';
import { calcNRCOffset, calcTotalCharges, calcTotalCredits, calcBalance, formatCurrency } from '@/lib/calculations';
import { fillAGMCheckoutPDF } from '@/lib/pdfFiller';
import { InspectionBadge } from '@/components/shared/InspectionBadge';

interface Props {
  returnId: string;
}

export function ReviewScreen({ returnId }: Props) {
  const { session, updateReturn } = useSession();
  const { theme, toggle } = useTheme();
  const router = useRouter();
  const [complianceChecked, setComplianceChecked] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [pdfReady, setPdfReady] = useState(false);
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);

  const tenantReturn = session?.returns.find(r => r.id === returnId);
  if (!tenantReturn || !session) {
    if (typeof window !== 'undefined') router.replace('/');
    return null;
  }

  const totalCharges = calcTotalCharges(tenantReturn);
  const totalCredits = calcTotalCredits(tenantReturn);
  const balance = calcBalance(tenantReturn);
  const cleaningTenant = calcNRCOffset(tenantReturn.manualCharges.generalCleaning, tenantReturn.depositData.nrcCleaningFee);
  const { tenantData, depositData, manualCharges, calculatedCharges } = tenantReturn;

  async function handleCompliance() {
    if (!complianceChecked) return;
    setGenerating(true);
    try {
      const templateRes = await fetch('/AGM_template.pdf');
      if (!templateRes.ok) throw new Error('PDF template not found. Please add AGM_template.pdf to /public.');
      const templateBytes = await templateRes.arrayBuffer();
      const filled = await fillAGMCheckoutPDF(templateBytes, tenantReturn!, session!.propertyName, session!.propertyConfig);
      setPdfBytes(filled);
      setPdfReady(true);
      updateReturn(returnId, { processingStatus: 'complete', complianceChecked: true, pdfGenerated: true });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'PDF generation failed.');
    } finally {
      setGenerating(false);
    }
  }

  function handleDownload() {
    if (!pdfBytes) return;
    const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AGM_Checkout_${tenantData.unit}_${tenantData.tenantName.replace(/\s+/g, '_')}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function LineItem({ label, total, tenant }: { label: string; total: number; tenant: number }) {
    if (total === 0 && tenant === 0) return null;
    return (
      <tr className="border-b border-[#f2f2f7] dark:border-[#38383a]">
        <td className="py-1.5 text-sm text-[#8e8e93]">{label}</td>
        <td className="py-1.5 text-sm text-[#1c1c1e] dark:text-[#ebebf5] text-right">{formatCurrency(total)}</td>
        <td className="py-1.5 text-sm font-medium text-[#1c1c1e] dark:text-white text-right">{formatCurrency(tenant)}</td>
      </tr>
    );
  }

  return (
    <div className="min-h-screen bg-[#f2f2f7] dark:bg-[#1c1c1e]">
      {/* Header */}
      <div className="bg-white dark:bg-[#2c2c2e] border-b border-[#e5e5ea] dark:border-[#38383a] px-6 py-4">
        <div className="w-full flex items-center gap-4">
          <button
            onClick={() => router.push(`/return/${returnId}`)}
            className="text-sm text-[#8e8e93] hover:text-[#1c1c1e] dark:hover:text-white transition-colors"
          >
            ← Return Form
          </button>
          <h1 className="text-lg font-semibold text-[#1c1c1e] dark:text-white">
            Review & Submit — {tenantData.tenantName} · Unit {tenantData.unit}
          </h1>
          <div className="ml-auto flex items-center gap-3">
            <InspectionBadge status={tenantData.inspectionStatus} />
            {/* Dark mode toggle */}
            <button
              onClick={toggle}
              className="w-9 h-9 rounded-full bg-[#f2f2f7] dark:bg-[#3a3a3c] flex items-center justify-center text-base hover:bg-[#e5e5ea] dark:hover:bg-[#48484a] transition-colors"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
          </div>
        </div>
      </div>

      <div className="w-full px-6 py-6 grid grid-cols-2 gap-6">
        {/* Left — full breakdown */}
        <div className="space-y-4">
          {tenantData.inspectionStatus === 'missing' && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-4 text-sm text-red-700 dark:text-red-400">
              <strong>Small Claims Risk:</strong> Signed move-in inspection is not on file for this unit. Deductions may be challenged.
            </div>
          )}

          {/* Tenant / Lease summary */}
          <div className="bg-white dark:bg-[#2c2c2e] rounded-2xl border border-[#e5e5ea] dark:border-[#38383a] p-5 space-y-1">
            <p className="text-xs font-semibold text-[#8e8e93] uppercase tracking-wider mb-2">Tenant & Lease</p>
            <Row label="Tenant" value={tenantData.tenantName} />
            {tenantData.coTenant && <Row label="Co-Tenant" value={tenantData.coTenant} />}
            <Row label="Unit" value={tenantData.unit} />
            <Row label="Forwarding Address" value={[tenantData.forwardingAddress.street, tenantData.forwardingAddress.city, tenantData.forwardingAddress.state, tenantData.forwardingAddress.zip].filter(Boolean).join(', ')} />
            <Row label="Move-In" value={tenantData.moveInDate} />
            <Row label="Move-Out" value={tenantData.moveOutDate} />
            <Row label="Paid Through" value={tenantData.paidThroughDate} />
            <Row label="Monthly Rent" value={formatCurrency(tenantData.monthlyRent)} />
            <Row label="Lease Break" value={tenantData.leaseBreak ? 'Yes' : 'No'} />
            {tenantData.leaseBreak && <Row label="New Tenant Move-In" value={tenantData.newTenantMoveInDate ?? 'None'} />}
          </div>

          {/* Charges table */}
          <div className="bg-white dark:bg-[#2c2c2e] rounded-2xl border border-[#e5e5ea] dark:border-[#38383a] p-5">
            <p className="text-xs font-semibold text-[#8e8e93] uppercase tracking-wider mb-3">Turnover Expenses</p>
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#e5e5ea] dark:border-[#38383a]">
                  <th className="text-left py-1.5 text-xs text-[#8e8e93] font-medium">Item</th>
                  <th className="text-right py-1.5 text-xs text-[#8e8e93] font-medium">Total Cost</th>
                  <th className="text-right py-1.5 text-xs text-[#8e8e93] font-medium">Tenant Cost</th>
                </tr>
              </thead>
              <tbody>
                <LineItem label="General Cleaning" total={manualCharges.generalCleaning} tenant={cleaningTenant} />
                <LineItem label="Blind / Drape Cleaning" total={manualCharges.blindDrapeCleaning} tenant={manualCharges.blindDrapeCleaning} />
                <LineItem label="Window Covering Replacement" total={manualCharges.windowCoveringReplacement} tenant={manualCharges.windowCoveringReplacement} />
                <LineItem label="Carpet Shampooing" total={manualCharges.carpetShampooing} tenant={manualCharges.carpetShampooing} />
                <LineItem label="Flooring Restoration" total={manualCharges.flooringRestoration} tenant={manualCharges.flooringRestoration} />
                <LineItem label="Painting" total={manualCharges.painting} tenant={manualCharges.painting} />
                {manualCharges.other1 > 0 && <LineItem label={manualCharges.other1Label} total={manualCharges.other1} tenant={manualCharges.other1} />}
                {manualCharges.other2 > 0 && <LineItem label={manualCharges.other2Label} total={manualCharges.other2} tenant={manualCharges.other2} />}
                {calculatedCharges.rentDue > 0 && (
                  <tr className="border-b border-[#f2f2f7] dark:border-[#38383a]">
                    <td className="py-1.5 text-sm text-[#8e8e93]">
                      Rent Due<br />
                      <span className="text-xs text-[#8e8e93]/70">{calculatedCharges.rentDueDateRange}</span>
                    </td>
                    <td className="py-1.5 text-sm text-[#1c1c1e] dark:text-[#ebebf5] text-right">{formatCurrency(calculatedCharges.rentDue)}</td>
                    <td className="py-1.5 text-sm font-medium text-[#1c1c1e] dark:text-white text-right">{formatCurrency(calculatedCharges.rentDue)}</td>
                  </tr>
                )}
                {calculatedCharges.utilityCharge > 0 && <LineItem label="Utility Charge" total={calculatedCharges.utilityCharge} tenant={calculatedCharges.utilityCharge} />}
                {manualCharges.legalCourtCosts > 0 && <LineItem label="Legal / Court Costs" total={manualCharges.legalCourtCosts} tenant={manualCharges.legalCourtCosts} />}
                <tr className="border-t border-[#e5e5ea] dark:border-[#48484a]">
                  <td className="py-2 text-sm font-bold text-[#1c1c1e] dark:text-white">Totals</td>
                  <td className="py-2 text-sm font-bold text-[#1c1c1e] dark:text-white text-right">{formatCurrency(totalCharges)}</td>
                  <td className="py-2 text-sm font-bold text-[#1c1c1e] dark:text-white text-right">{formatCurrency(totalCharges)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Deposits / Credits */}
          <div className="bg-white dark:bg-[#2c2c2e] rounded-2xl border border-[#e5e5ea] dark:border-[#38383a] p-5 space-y-1">
            <p className="text-xs font-semibold text-[#8e8e93] uppercase tracking-wider mb-2">Refunds / Credits</p>
            <Row label="Security Deposit Paid" value={formatCurrency(depositData.securityDeposit)} />
            {depositData.petDeposit > 0 && <Row label="Pet Deposit" value={formatCurrency(depositData.petDeposit)} />}
            {depositData.keyDeposit > 0 && <Row label="Key Deposit" value={formatCurrency(depositData.keyDeposit)} />}
            {depositData.garageOpenerDeposit > 0 && <Row label="Garage Opener Deposit" value={formatCurrency(depositData.garageOpenerDeposit)} />}
            <div className="border-t border-[#e5e5ea] dark:border-[#38383a] pt-2 mt-1">
              <Row label="Total Credits" value={formatCurrency(totalCredits)} bold />
            </div>
          </div>

          {/* Balance */}
          <div className={`rounded-2xl border p-5 ${
            balance >= 0
              ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
              : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
          }`}>
            <div className="flex justify-between items-center">
              <span className={`font-semibold ${balance >= 0 ? 'text-green-800 dark:text-green-400' : 'text-red-800 dark:text-red-400'}`}>
                {balance === 0 ? '$0 Balance Due' : balance > 0 ? 'Return to Tenant' : 'Balance Owing Landlord'}
              </span>
              <span className={`text-xl font-bold ${balance >= 0 ? 'text-green-800 dark:text-green-400' : 'text-red-800 dark:text-red-400'}`}>
                {formatCurrency(Math.abs(balance))}
              </span>
            </div>
          </div>
        </div>

        {/* Right — compliance + PDF */}
        <div className="space-y-4 self-start sticky top-6">
          <div className="bg-white dark:bg-[#2c2c2e] rounded-2xl border border-[#e5e5ea] dark:border-[#38383a] p-5 space-y-4">
            <p className="text-xs font-semibold text-[#8e8e93] uppercase tracking-wider">Forwarding Address Confirmation</p>
            <p className="text-sm text-[#1c1c1e] dark:text-[#ebebf5]">
              {[tenantData.forwardingAddress.street, tenantData.forwardingAddress.city, tenantData.forwardingAddress.state, tenantData.forwardingAddress.zip].filter(Boolean).join(', ') || 'No forwarding address on file'}
            </p>
          </div>

          <div className="bg-white dark:bg-[#2c2c2e] rounded-2xl border border-[#e5e5ea] dark:border-[#38383a] p-5 space-y-4">
            <p className="text-xs font-semibold text-[#8e8e93] uppercase tracking-wider">Compliance Check</p>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={complianceChecked}
                onChange={e => setComplianceChecked(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-gray-300 accent-blue-600"
              />
              <span className="text-sm text-[#1c1c1e] dark:text-[#ebebf5]">
                I confirm all charges reflect company-approved rates and this return is accurate and complete.
              </span>
            </label>
          </div>

          {!pdfReady ? (
            <button
              onClick={handleCompliance}
              disabled={!complianceChecked || generating}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-[#e5e5ea] dark:disabled:bg-[#3a3a3c] disabled:text-[#8e8e93] disabled:cursor-not-allowed text-white font-semibold py-3 rounded-2xl transition-colors"
            >
              {generating ? 'Generating PDF...' : 'Finalize & Generate PDF'}
            </button>
          ) : (
            <div className="space-y-3">
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-2xl p-4 text-sm text-green-800 dark:text-green-400 text-center font-medium">
                PDF Generated Successfully
              </div>
              <button
                onClick={handleDownload}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-2xl transition-colors"
              >
                Download PDF
              </button>
              <button
                onClick={() => router.push('/dashboard')}
                className="w-full border border-[#e5e5ea] dark:border-[#48484a] text-[#1c1c1e] dark:text-[#ebebf5] font-medium py-2.5 rounded-2xl hover:bg-[#f2f2f7] dark:hover:bg-[#3a3a3c] transition-colors"
              >
                Back to Dashboard
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between py-1 border-b border-[#f2f2f7] dark:border-[#38383a]">
      <span className={`text-sm ${bold ? 'font-semibold text-[#1c1c1e] dark:text-white' : 'text-[#8e8e93]'}`}>{label}</span>
      <span className={`text-sm ${bold ? 'font-semibold text-[#1c1c1e] dark:text-white' : 'text-[#1c1c1e] dark:text-[#ebebf5]'}`}>{value || '—'}</span>
    </div>
  );
}
