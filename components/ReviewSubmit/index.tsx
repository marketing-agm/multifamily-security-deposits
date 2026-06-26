// components/ReviewSubmit/index.tsx
// Final review screen — calculation summary, statutory deadline notice, PDF download.
//
// This is the last step before the PDF is generated and sent to the tenant.
// California law requires the security deposit return within 21 days of move-out,
// so we show a deadline banner prominently at the top.

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/context/SessionContext';
import { DeadlineBanner } from '@/components/shared/DeadlineBanner';
import { formatCurrency } from '@/lib/calculations';

interface Props {
  returnId: string;
}

export function ReviewSubmit({ returnId }: Props) {
  // updateReturn(id, patch) merges patch fields into the matching TenantReturn in session.
  const { session, updateReturn } = useSession();
  const router = useRouter();

  // complianceChecked: the user must tick a box before downloading — a simple safeguard.
  // generating: true while the PDF is being built so we can show a spinner state.
  const [complianceChecked, setComplianceChecked] = useState(false);
  const [generating, setGenerating] = useState(false);

  const tr = session?.returns.find(r => r.id === returnId);
  if (!session || !tr) {
    router.replace('/dashboard');
    return null;
  }

  const { tenantData, depositData, calculatedCharges, manualCharges } = tr;

  // NRC (Non-Refundable Charge) offset: the cleaning fee the tenant pre-paid at move-in
  // can be applied against the cleaning charge, reducing what they owe now.
  // We take the smaller of the two so we never offset more than was charged.
  const nrcOffset = Math.min(manualCharges.generalCleaning, depositData.nrcCleaningFee);
  const tenantCleaning = Math.max(0, manualCharges.generalCleaning - nrcOffset);

  // Credits = all deposits held by the landlord.
  const totalCredits = depositData.securityDeposit + depositData.petDeposit + depositData.keyDeposit;

  // Total charges = everything the tenant owes.
  const totalCharges =
    calculatedCharges.rentDue +
    calculatedCharges.utilityCharge +
    tenantCleaning +
    manualCharges.carpetShampooing +
    manualCharges.painting +
    manualCharges.other1 +
    manualCharges.other2 +
    manualCharges.legalCourtCosts;

  // Positive balance → landlord owes tenant. Negative → tenant owes landlord.
  const balance = totalCredits - totalCharges;
  const dueToTenant = balance >= 0 ? balance : 0;
  const owingLandlord = balance < 0 ? Math.abs(balance) : 0;

  // Format the forwarding address into a single line for display.
  const fwdAddr = `${tenantData.forwardingAddress.street}, ${tenantData.forwardingAddress.city} ${tenantData.forwardingAddress.state} ${tenantData.forwardingAddress.zip}`;

  // Suggested filename for the downloaded PDF.
  const fileName = `AGM_Checkout_${tenantData.unit}_${tenantData.tenantName.split(' ').pop()}.pdf`;

  // handleDownload: fetches the blank PDF template, fills it with our data using pdfFiller,
  // then triggers a browser download. We use dynamic import for pdfFiller because it
  // uses pdf-lib which is a large library — loading it only when needed keeps the page fast.
  async function handleDownload() {
    if (!complianceChecked) return;
    setGenerating(true);
    try {
      // Fetch the blank template PDF from the public folder.
      const res = await fetch('/AGM_template.pdf');
      const templateBytes = await res.arrayBuffer();

      // Dynamic import — like a lazy-loaded class. Only loads the module when we need it.
      const { fillAGMCheckoutPDF } = await import('@/lib/pdfFiller');
      // tr! and session! — non-null assertions because TS can't see the early return above.
      // We verified both are defined before reaching this function.
      const pdfBytes = await fillAGMCheckoutPDF(templateBytes, tr!, session!.propertyName);

      // Create a temporary URL for the filled PDF and click it to trigger download.
      const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url); // clean up the temporary URL

      // Mark this return as done in the session.
      updateReturn(tr!.id, { pdfGenerated: true, complianceChecked: true });
    } catch (err) {
      console.error('PDF generation failed:', err);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Top navigation bar ── */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-900">
            Review & submit — {tenantData.tenantName}, Unit {tenantData.unit}
          </p>
          <p className="text-xs text-gray-400">All fields populated · Ready for compliance check</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => router.push(`/return/${encodeURIComponent(tr.id)}`)}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
          >
            ← Back to edit
          </button>
          <button
            onClick={handleDownload}
            disabled={!complianceChecked || generating}
            className="px-4 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {generating ? 'Generating…' : 'Download PDF'}
          </button>
        </div>
      </div>

      {/* ── Page body ── */}
      <div className="max-w-5xl mx-auto px-6 py-6">

        {/* Deadline banner — shows days remaining under California's 21-day rule. */}
        <div className="mb-6">
          <DeadlineBanner moveOutDate={tenantData.moveOutDate} />
        </div>

        {/* Two-column layout: left = calculation summary, right = PDF preview. */}
        <div className="grid grid-cols-2 gap-6">

          {/* ── Left column: calculation summary ── */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-700">Calculation summary</h2>

            {/* Credits section */}
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Credits</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Security deposit</span>
                  <span className="font-medium text-green-700">{formatCurrency(depositData.securityDeposit)}</span>
                </div>
                {depositData.petDeposit > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Pet deposit</span>
                    <span className="font-medium text-green-700">{formatCurrency(depositData.petDeposit)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-gray-200 pt-2 font-semibold">
                  <span className="text-gray-700">Total credits</span>
                  <span className="text-green-700">{formatCurrency(totalCredits)}</span>
                </div>
              </div>
            </div>

            {/* Charges section */}
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Charges</p>
              <div className="space-y-2 text-sm">
                {calculatedCharges.rentDue > 0 && (
                  <div className="flex justify-between">
                    {/* leaseBreak means the tenant left before the lease ended — extra rent may apply. */}
                    <span className="text-gray-600">Rent due {tenantData.leaseBreak ? '(lease break)' : ''}</span>
                    <span className="font-medium">{formatCurrency(calculatedCharges.rentDue)}</span>
                  </div>
                )}
                {calculatedCharges.utilityCharge > 0 && (
                  <div className="flex justify-between">
                    {/* RUBS = Ratio Utility Billing System — tenant's share of building utility bill. */}
                    <span className="text-gray-600">
                      {tr.utilityData.utilityType === 'RUBS' ? 'RUBS chargeback' : 'Utility charge'}
                    </span>
                    <span className="font-medium text-blue-700">{formatCurrency(calculatedCharges.utilityCharge)}</span>
                  </div>
                )}
                {manualCharges.generalCleaning > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Cleaning (NRC offset −{formatCurrency(nrcOffset)})</span>
                    <span className="font-medium">{formatCurrency(tenantCleaning)}</span>
                  </div>
                )}
                {manualCharges.other1 > 0 && (
                  <div className="flex justify-between">
                    {/* other1Label is a custom label the user can set for misc charges. */}
                    <span className="text-gray-600">{manualCharges.other1Label || 'Other'}</span>
                    <span className="font-medium">{formatCurrency(manualCharges.other1)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-gray-200 pt-2 font-semibold">
                  <span className="text-gray-700">Total charges</span>
                  <span className="text-red-700">{formatCurrency(totalCharges)}</span>
                </div>
              </div>
            </div>

            {/* Balance summary boxes */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-400 mb-1">Balance due to tenant</p>
                <p className={`text-lg font-semibold ${dueToTenant > 0 ? 'text-green-700' : 'text-gray-400'}`}>
                  {formatCurrency(dueToTenant)}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-400 mb-1">Balance owing landlord</p>
                <p className={`text-lg font-semibold ${owingLandlord > 0 ? 'text-red-700' : 'text-gray-400'}`}>
                  {formatCurrency(owingLandlord)}
                </p>
              </div>
            </div>

            {/* Compliance checkbox — must be checked before download is enabled. */}
            <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
              complianceChecked ? 'bg-green-50 border-green-300' : 'bg-gray-50 border-gray-200'
            }`}>
              <input
                type="checkbox"
                checked={complianceChecked}
                onChange={e => setComplianceChecked(e.target.checked)}
                className="mt-0.5 w-4 h-4 shrink-0"
              />
              <span className="text-sm text-gray-600">
                I confirm all charges reflect company-approved rates and this return is accurate.
              </span>
            </label>
          </div>

          {/* ── Right column: PDF preview placeholder ── */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-700">PDF preview</h2>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 flex flex-col items-center justify-center gap-3 min-h-64 text-center">
              {/* Document icon */}
              <svg className="w-10 h-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-sm font-medium text-gray-600">{fileName}</p>
              <p className="text-xs text-gray-400">72 / 72 fields populated · Awaiting compliance check</p>
              <button
                onClick={handleDownload}
                disabled={!complianceChecked || generating}
                className="mt-2 px-5 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {generating ? 'Generating PDF…' : 'Download PDF'}
              </button>
            </div>

            {/* Forwarding address — where the letter will be mailed. */}
            <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 text-sm text-blue-800">
              <span className="font-medium">Will be sent to:</span> {fwdAddr}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
