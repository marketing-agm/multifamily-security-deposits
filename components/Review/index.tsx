'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/context/SessionContext';
import { calcNRCOffset, calcTotalCharges, calcTotalCredits, calcBalance, formatCurrency } from '@/lib/calculations';
import { fillAGMCheckoutPDF } from '@/lib/pdfFiller';
import { InspectionBadge } from '@/components/shared/InspectionBadge';

interface Props {
  returnId: string;
}

export function ReviewScreen({ returnId }: Props) {
  const { session, updateReturn } = useSession();
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
      const filled = await fillAGMCheckoutPDF(templateBytes, tenantReturn!, session!.propertyName);
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
      <tr className="border-b border-gray-50">
        <td className="py-1.5 text-sm text-gray-700">{label}</td>
        <td className="py-1.5 text-sm text-gray-700 text-right">{formatCurrency(total)}</td>
        <td className="py-1.5 text-sm font-medium text-gray-900 text-right">{formatCurrency(tenant)}</td>
      </tr>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center gap-4">
          <button onClick={() => router.push(`/return/${returnId}`)} className="text-sm text-gray-500 hover:text-gray-700">
            ← Return Form
          </button>
          <h1 className="text-lg font-semibold text-gray-900">
            Review & Submit — {tenantData.tenantName} · Unit {tenantData.unit}
          </h1>
          <div className="ml-auto">
            <InspectionBadge status={tenantData.inspectionStatus} />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 grid grid-cols-2 gap-6">
        {/* Left — full breakdown */}
        <div className="space-y-4">
          {tenantData.inspectionStatus === 'missing' && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
              <strong>Small Claims Risk:</strong> Signed move-in inspection is not on file for this unit. Deductions may be challenged.
            </div>
          )}

          {/* Tenant / Lease summary */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-1">
            <h2 className="text-sm font-semibold text-gray-700 mb-2">Tenant & Lease</h2>
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
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Turnover Expenses</h2>
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-1.5 text-xs text-gray-500 font-medium">Item</th>
                  <th className="text-right py-1.5 text-xs text-gray-500 font-medium">Total Cost</th>
                  <th className="text-right py-1.5 text-xs text-gray-500 font-medium">Tenant Cost</th>
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
                  <tr className="border-b border-gray-50">
                    <td className="py-1.5 text-sm text-gray-700">
                      Rent Due<br />
                      <span className="text-xs text-gray-400">{calculatedCharges.rentDueDateRange}</span>
                    </td>
                    <td className="py-1.5 text-sm text-gray-700 text-right">{formatCurrency(calculatedCharges.rentDue)}</td>
                    <td className="py-1.5 text-sm font-medium text-gray-900 text-right">{formatCurrency(calculatedCharges.rentDue)}</td>
                  </tr>
                )}
                {calculatedCharges.utilityCharge > 0 && <LineItem label="Utility Charge" total={calculatedCharges.utilityCharge} tenant={calculatedCharges.utilityCharge} />}
                {manualCharges.legalCourtCosts > 0 && <LineItem label="Legal / Court Costs" total={manualCharges.legalCourtCosts} tenant={manualCharges.legalCourtCosts} />}
                <tr className="border-t border-gray-300">
                  <td className="py-2 text-sm font-bold text-gray-900">Totals</td>
                  <td className="py-2 text-sm font-bold text-gray-900 text-right">{formatCurrency(totalCharges)}</td>
                  <td className="py-2 text-sm font-bold text-gray-900 text-right">{formatCurrency(totalCharges)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Deposits / Credits */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-1">
            <h2 className="text-sm font-semibold text-gray-700 mb-2">Refunds / Credits</h2>
            <Row label="Security Deposit Paid" value={formatCurrency(depositData.securityDeposit)} />
            {depositData.petDeposit > 0 && <Row label="Pet Deposit" value={formatCurrency(depositData.petDeposit)} />}
            {depositData.keyDeposit > 0 && <Row label="Key Deposit" value={formatCurrency(depositData.keyDeposit)} />}
            {depositData.garageOpenerDeposit > 0 && <Row label="Garage Opener Deposit" value={formatCurrency(depositData.garageOpenerDeposit)} />}
            <div className="border-t border-gray-200 pt-2 mt-1">
              <Row label="Total Credits" value={formatCurrency(totalCredits)} bold />
            </div>
          </div>

          {/* Balance */}
          <div className={`rounded-xl border p-5 ${balance >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
            <div className="flex justify-between items-center">
              <span className={`font-semibold ${balance >= 0 ? 'text-green-800' : 'text-red-800'}`}>
                {balance === 0 ? '$0 Balance Due' : balance > 0 ? 'Return to Tenant' : 'Balance Owing Landlord'}
              </span>
              <span className={`text-xl font-bold ${balance >= 0 ? 'text-green-800' : 'text-red-800'}`}>
                {formatCurrency(Math.abs(balance))}
              </span>
            </div>
          </div>
        </div>

        {/* Right — compliance + PDF */}
        <div className="space-y-4 self-start sticky top-6">
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-700">Forwarding Address Confirmation</h2>
            <p className="text-sm text-gray-600">
              {[tenantData.forwardingAddress.street, tenantData.forwardingAddress.city, tenantData.forwardingAddress.state, tenantData.forwardingAddress.zip].filter(Boolean).join(', ') || 'No forwarding address on file'}
            </p>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-700">Compliance Check</h2>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={complianceChecked}
                onChange={e => setComplianceChecked(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-gray-300 accent-blue-600"
              />
              <span className="text-sm text-gray-700">
                I confirm all charges reflect company-approved rates and this return is accurate and complete.
              </span>
            </label>
          </div>

          {!pdfReady ? (
            <button
              onClick={handleCompliance}
              disabled={!complianceChecked || generating}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors"
            >
              {generating ? 'Generating PDF...' : 'Finalize & Generate PDF'}
            </button>
          ) : (
            <div className="space-y-3">
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-800 text-center font-medium">
                PDF Generated Successfully
              </div>
              <button
                onClick={handleDownload}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-xl transition-colors"
              >
                Download PDF
              </button>
              <button
                onClick={() => router.push('/dashboard')}
                className="w-full border border-gray-300 text-gray-700 font-medium py-2.5 rounded-xl hover:bg-gray-50 transition-colors"
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
    <div className="flex justify-between py-1 border-b border-gray-50">
      <span className={`text-sm text-gray-500 ${bold ? 'font-semibold text-gray-700' : ''}`}>{label}</span>
      <span className={`text-sm text-gray-900 ${bold ? 'font-semibold' : ''}`}>{value || '—'}</span>
    </div>
  );
}
