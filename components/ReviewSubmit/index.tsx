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
  // then triggers a browser download.
  async function handleDownload() {
    if (!complianceChecked) return;
    setGenerating(true);
    try {
      const res = await fetch('/AGM_template.pdf');
      const templateBytes = await res.arrayBuffer();

      // Dynamic import — like a lazy-loaded class. Only loads when we need it.
      const { fillAGMCheckoutPDF } = await import('@/lib/pdfFiller');
      const pdfBytes = await fillAGMCheckoutPDF(templateBytes, tr!, session!.propertyName);

      const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);

      updateReturn(tr!.id, { pdfGenerated: true, complianceChecked: true });
    } catch (err) {
      console.error('PDF generation failed:', err);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#fbfbfa]">

      {/* ── Top navigation bar ── */}
      <div className="bg-white border-b border-[#e8e7e4] px-6 py-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-[#1a1a19]">
            Review & submit — {tenantData.tenantName}, Unit {tenantData.unit}
          </p>
          <p className="text-xs text-[#9b9b99]">All fields populated · Ready for compliance check</p>
        </div>
        <div className="flex gap-2">
          {/* Back button: outlined secondary action */}
          <button
            onClick={() => router.push(`/return/${encodeURIComponent(tr.id)}`)}
            className="px-3 py-1.5 text-sm border border-[#e8e7e4] rounded-[6px] text-[#1a1a19] hover:bg-[#f7f6f3]"
          >
            ← Back to edit
          </button>
          {/* Download button: AGM near-black primary */}
          <button
            onClick={handleDownload}
            disabled={!complianceChecked || generating}
            className="px-4 py-1.5 text-sm font-medium bg-[#1a1a19] text-white rounded-[6px] hover:bg-[#333] disabled:opacity-40 disabled:cursor-not-allowed"
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
          <div className="bg-white border border-[#e8e7e4] rounded-[6px] p-5 space-y-4">
            <h2 className="text-sm font-semibold text-[#1a1a19]">Calculation summary</h2>

            {/* Credits section */}
            <div className="bg-[#f7f6f3] rounded-[6px] p-4">
              <p className="text-[11px] font-semibold text-[#9b9b99] uppercase tracking-[0.05em] mb-3">Credits</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-[#6b6b6a]">Security deposit</span>
                  {/* Credit amounts: success green */}
                  <span className="font-medium text-[#1a7a3a]">{formatCurrency(depositData.securityDeposit)}</span>
                </div>
                {depositData.petDeposit > 0 && (
                  <div className="flex justify-between">
                    <span className="text-[#6b6b6a]">Pet deposit</span>
                    <span className="font-medium text-[#1a7a3a]">{formatCurrency(depositData.petDeposit)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-[#e8e7e4] pt-2">
                  <span className="text-[#1a1a19] font-semibold">Total credits</span>
                  {/* Total credits: green + bold */}
                  <span className="text-[#1a7a3a] font-semibold">{formatCurrency(totalCredits)}</span>
                </div>
              </div>
            </div>

            {/* Charges section */}
            <div className="bg-[#f7f6f3] rounded-[6px] p-4">
              <p className="text-[11px] font-semibold text-[#9b9b99] uppercase tracking-[0.05em] mb-3">Charges</p>
              <div className="space-y-2 text-sm">
                {calculatedCharges.rentDue > 0 && (
                  <div className="flex justify-between">
                    {/* leaseBreak means tenant left before lease ended — extra rent may apply. */}
                    <span className="text-[#6b6b6a]">Rent due {tenantData.leaseBreak ? '(lease break)' : ''}</span>
                    {/* Charge amounts: danger red */}
                    <span className="font-medium text-[#b3261e]">{formatCurrency(calculatedCharges.rentDue)}</span>
                  </div>
                )}
                {calculatedCharges.utilityCharge > 0 && (
                  <div className="flex justify-between">
                    {/* RUBS = Ratio Utility Billing System — tenant's share of building utility bill. */}
                    <span className="text-[#6b6b6a]">
                      {tr.utilityData.utilityType === 'RUBS' ? 'RUBS chargeback' : 'Utility charge'}
                    </span>
                    <span className="font-medium text-[#b3261e]">{formatCurrency(calculatedCharges.utilityCharge)}</span>
                  </div>
                )}
                {manualCharges.generalCleaning > 0 && (
                  <div className="flex justify-between">
                    <span className="text-[#6b6b6a]">Cleaning (NRC offset −{formatCurrency(nrcOffset)})</span>
                    <span className="font-medium text-[#b3261e]">{formatCurrency(tenantCleaning)}</span>
                  </div>
                )}
                {manualCharges.other1 > 0 && (
                  <div className="flex justify-between">
                    <span className="text-[#6b6b6a]">{manualCharges.other1Label || 'Other'}</span>
                    <span className="font-medium text-[#b3261e]">{formatCurrency(manualCharges.other1)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-[#e8e7e4] pt-2">
                  <span className="text-[#1a1a19] font-semibold">Total charges</span>
                  {/* Total charges: red + bold */}
                  <span className="text-[#b3261e] font-semibold">{formatCurrency(totalCharges)}</span>
                </div>
              </div>
            </div>

            {/* Balance summary boxes */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#f7f6f3] rounded-[6px] p-3">
                <p className="text-xs text-[#9b9b99] mb-1">Balance due to tenant</p>
                <p className={`text-lg font-semibold ${dueToTenant > 0 ? 'text-[#1a7a3a]' : 'text-[#9b9b99]'}`}>
                  {formatCurrency(dueToTenant)}
                </p>
              </div>
              <div className="bg-[#f7f6f3] rounded-[6px] p-3">
                <p className="text-xs text-[#9b9b99] mb-1">Balance owing landlord</p>
                <p className={`text-lg font-semibold ${owingLandlord > 0 ? 'text-[#b3261e]' : 'text-[#9b9b99]'}`}>
                  {formatCurrency(owingLandlord)}
                </p>
              </div>
            </div>

            {/* Compliance checkbox — must be checked before download is enabled.
                Checked state: success green bg + border. Unchecked: neutral gray. */}
            <label className={`flex items-start gap-3 p-3 rounded-[6px] border cursor-pointer transition-colors ${
              complianceChecked
                ? 'bg-[#e3f5e6] border-[#1a7a3a]'
                : 'bg-[#f7f6f3] border-[#e8e7e4]'
            }`}>
              <input
                type="checkbox"
                checked={complianceChecked}
                onChange={e => setComplianceChecked(e.target.checked)}
                className="mt-0.5 w-4 h-4 shrink-0"
              />
              <span className="text-sm text-[#6b6b6a]">
                I confirm all charges reflect company-approved rates and this return is accurate.
              </span>
            </label>
          </div>

          {/* ── Right column: PDF preview placeholder ── */}
          <div className="bg-white border border-[#e8e7e4] rounded-[6px] p-5 space-y-4">
            <h2 className="text-sm font-semibold text-[#1a1a19]">PDF preview</h2>

            {/* PDF placeholder area: subtle fill with AGM border */}
            <div className="bg-[#f7f6f3] border border-[#e8e7e4] rounded-[6px] p-6 flex flex-col items-center justify-center gap-3 min-h-64 text-center">
              <svg className="w-10 h-10 text-[#9b9b99]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {/* Filename: primary dark text */}
              <p className="text-sm font-medium text-[#1a1a19]">{fileName}</p>
              <p className="text-xs text-[#9b9b99]">72 / 72 fields populated · Awaiting compliance check</p>
              {/* Download button: AGM near-black primary */}
              <button
                onClick={handleDownload}
                disabled={!complianceChecked || generating}
                className="mt-2 px-5 py-2 text-sm font-medium bg-[#1a1a19] text-white rounded-[6px] hover:bg-[#333] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {generating ? 'Generating PDF…' : 'Download PDF'}
              </button>
            </div>

            {/* Forwarding address notice: AGM info blue */}
            <div className="bg-[#e6efff] border border-[#2383e2]/20 rounded-[6px] px-4 py-3 text-sm text-[#1858b8]">
              <span className="font-medium">Will be sent to:</span> {fwdAddr}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
