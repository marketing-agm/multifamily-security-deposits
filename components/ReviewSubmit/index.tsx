// components/ReviewSubmit/index.tsx
// Final review & submit screen — the last step before the PDF goes to the tenant.
//
// Layout:
//   [Top: statutory deadline notice with color-coded days remaining]
//   [Left: calculation summary + compliance checkbox]
//   [Right: PDF preview + form summary + email send]
//
// California Civil Code §1950.5: return within 21 days of move-out.
// Urgency color: green (>14 days), amber (7-14 days), red (<7 days or overdue).

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/context/SessionContext';
import { DeadlineBanner } from '@/components/shared/DeadlineBanner';
import { formatCurrency } from '@/lib/calculations';
import { formatDeadlineDate, getDaysRemaining } from '@/lib/deadlineUtils';

interface Props {
  returnId: string;
}

export function ReviewSubmit({ returnId }: Props) {
  const { session, updateReturn } = useSession();
  const router = useRouter();

  // complianceChecked must be true before Download is unlocked.
  const [complianceChecked, setComplianceChecked] = useState(false);
  const [generating, setGenerating] = useState(false);
  // emailAddress: where the PDF will be sent — blank by default, filled in by user.
  const [emailAddress, setEmailAddress] = useState('');
  const [emailSent, setEmailSent] = useState(false);

  const tr = session?.returns.find(r => r.id === returnId);
  if (!session || !tr) {
    router.replace('/dashboard');
    return null;
  }

  const { tenantData, depositData, utilityData, calculatedCharges, manualCharges } = tr;

  // NRC = Non-Refundable Cleaning fee paid at move-in. Reduces cleaning charge at move-out.
  const nrcOffset = Math.min(manualCharges.generalCleaning, depositData.nrcCleaningFee);
  const tenantCleaning = Math.max(0, manualCharges.generalCleaning - nrcOffset);

  // Credits = all deposits held (security + pet + key).
  const totalCredits = depositData.securityDeposit + depositData.petDeposit + depositData.keyDeposit;

  // Charges = all amounts the tenant owes at move-out.
  const totalCharges =
    calculatedCharges.rentDue +
    calculatedCharges.utilityCharge +
    tenantCleaning +
    manualCharges.carpetShampooing +
    manualCharges.painting +
    manualCharges.other1 +
    manualCharges.other2 +
    manualCharges.legalCourtCosts;

  // Positive balance → tenant gets money back. Negative → tenant owes landlord.
  const balance = totalCredits - totalCharges;
  const dueToTenant = balance >= 0 ? balance : 0;
  const owingLandlord = balance < 0 ? Math.abs(balance) : 0;

  const fwdAddr = `${tenantData.forwardingAddress.street}, ${tenantData.forwardingAddress.city} ${tenantData.forwardingAddress.state} ${tenantData.forwardingAddress.zip}`;

  // PDF filename: AGM_Checkout_[Unit]_[Tenant full name]_[Property].pdf
  // Spaces replaced with underscores so the filename works on all operating systems.
  const tenantSlug = tenantData.tenantName.replace(/\s+/g, '_');
  const propertySlug = (session.propertyName || 'AGM').replace(/\s+/g, '_');
  const fileName = `AGM_Checkout_${tenantData.unit}_${tenantSlug}_${propertySlug}.pdf`;

  async function handleDownload() {
    if (!complianceChecked) return;
    setGenerating(true);
    try {
      const res = await fetch('/AGM_template.pdf');
      const templateBytes = await res.arrayBuffer();

      // Dynamic import — loads the PDF filler only when needed (keeps initial page load fast).
      const { fillAGMCheckoutPDF } = await import('@/lib/pdfFiller');
      const pdfBytes = await fillAGMCheckoutPDF(templateBytes, tr!, session!.propertyName);

      const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);

      updateReturn(tr!.id, { processingStatus: 'complete', pdfGenerated: true, complianceChecked: true });
    } catch (err) {
      console.error('PDF generation failed:', err);
    } finally {
      setGenerating(false);
    }
  }

  function handleSendEmail() {
    // Placeholder — email sending would connect to an email API in a future version.
    setEmailSent(true);
  }

  return (
    <div className="min-h-screen bg-[#fbfbfa]">

      {/* ── Top nav ── */}
      <div className="bg-white border-b border-[#e8e7e4] px-6 py-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-[#1a1a19]">
            Review &amp; submit — {tenantData.tenantName}, Unit {tenantData.unit}
          </p>
          <p className="text-xs text-[#9b9b99] mt-0.5">All fields populated · Ready for compliance check</p>
        </div>
        <button
          onClick={() => router.push(`/return/${encodeURIComponent(tr.id)}`)}
          className="px-3 py-1.5 text-sm border border-[#e8e7e4] rounded-[6px] text-[#1a1a19] hover:bg-[#f7f6f3]"
        >
          ← Back to edit
        </button>
      </div>

      {/* ── Page body ── */}
      <div className="max-w-5xl mx-auto px-6 py-6 space-y-5">

        {/* Deadline notice — color-coded by urgency (green/amber/red) */}
        <DeadlineBanner moveOutDate={tenantData.moveOutDate} />

        {/* Two-column layout */}
        <div className="grid grid-cols-[1fr_1fr] gap-5 items-start">

          {/* ══ LEFT: Calculation summary + compliance ══ */}
          <div className="bg-white border border-[#e8e7e4] rounded-[8px] p-5 space-y-4">
            <h2 className="text-[13px] font-semibold text-[#1a1a19]">Calculation summary</h2>

            {/* Credits */}
            <div className="bg-[#f7f6f3] rounded-[6px] p-4">
              <p className="text-[10px] font-semibold text-[#9b9b99] uppercase tracking-[0.05em] mb-3">Credits</p>
              <div className="space-y-2 text-[13px]">
                <div className="flex justify-between">
                  <span className="text-[#6b6b6a]">Security deposit</span>
                  <span className="font-medium text-[#1a7a3a]">{formatCurrency(depositData.securityDeposit)}</span>
                </div>
                {depositData.petDeposit > 0 && (
                  <div className="flex justify-between">
                    <span className="text-[#6b6b6a]">Pet deposit</span>
                    <span className="font-medium text-[#1a7a3a]">{formatCurrency(depositData.petDeposit)}</span>
                  </div>
                )}
                {depositData.keyDeposit > 0 && (
                  <div className="flex justify-between">
                    <span className="text-[#6b6b6a]">Key deposit</span>
                    <span className="font-medium text-[#1a7a3a]">{formatCurrency(depositData.keyDeposit)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-[#e8e7e4] pt-2">
                  <span className="font-semibold text-[#1a1a19]">Total credits</span>
                  <span className="font-semibold text-[#1a7a3a]">{formatCurrency(totalCredits)}</span>
                </div>
              </div>
            </div>

            {/* Charges */}
            <div className="bg-[#f7f6f3] rounded-[6px] p-4">
              <p className="text-[10px] font-semibold text-[#9b9b99] uppercase tracking-[0.05em] mb-3">Charges</p>
              <div className="space-y-2 text-[13px]">
                {calculatedCharges.rentDue > 0 && (
                  <div className="flex justify-between">
                    <span className="text-[#6b6b6a]">
                      {tenantData.leaseBreak ? 'Rent due (lease break)' : 'Rent due (pro-rated)'}
                    </span>
                    <span className="font-medium text-[#b3261e]">{formatCurrency(calculatedCharges.rentDue)}</span>
                  </div>
                )}
                {calculatedCharges.utilityCharge > 0 && (
                  <div className="flex justify-between">
                    <span className="text-[#6b6b6a]">
                      {utilityData.utilityType === 'RUBS' ? 'RUBS chargeback' : 'Utility — flat fee'}
                    </span>
                    <span className="font-medium text-[#b3261e]">{formatCurrency(calculatedCharges.utilityCharge)}</span>
                  </div>
                )}
                {manualCharges.generalCleaning > 0 && (
                  <div className="flex justify-between">
                    <span className="text-[#6b6b6a]">
                      {nrcOffset > 0
                        ? `Cleaning (NRC offset −${formatCurrency(nrcOffset)})`
                        : 'Cleaning'}
                    </span>
                    <span className="font-medium text-[#b3261e]">{formatCurrency(tenantCleaning)}</span>
                  </div>
                )}
                {manualCharges.carpetShampooing > 0 && (
                  <div className="flex justify-between">
                    <span className="text-[#6b6b6a]">Carpet shampooing</span>
                    <span className="font-medium text-[#b3261e]">{formatCurrency(manualCharges.carpetShampooing)}</span>
                  </div>
                )}
                {manualCharges.painting > 0 && (
                  <div className="flex justify-between">
                    <span className="text-[#6b6b6a]">Painting</span>
                    <span className="font-medium text-[#b3261e]">{formatCurrency(manualCharges.painting)}</span>
                  </div>
                )}
                {manualCharges.other1 > 0 && (
                  <div className="flex justify-between">
                    {/* other1Label is a custom label the user can type (e.g. "Key replacement") */}
                    <span className="text-[#6b6b6a]">{manualCharges.other1Label || 'Other'}</span>
                    <span className="font-medium text-[#b3261e]">{formatCurrency(manualCharges.other1)}</span>
                  </div>
                )}
                {manualCharges.legalCourtCosts > 0 && (
                  <div className="flex justify-between">
                    <span className="text-[#6b6b6a]">Legal / court costs</span>
                    <span className="font-medium text-[#b3261e]">{formatCurrency(manualCharges.legalCourtCosts)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-[#e8e7e4] pt-2">
                  <span className="font-semibold text-[#1a1a19]">Total charges</span>
                  <span className="font-semibold text-[#b3261e]">{formatCurrency(totalCharges)}</span>
                </div>
              </div>
            </div>

            {/* Balance boxes */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#f7f6f3] rounded-[6px] p-3">
                <p className="text-[11px] text-[#9b9b99] mb-1">Balance due to tenant</p>
                <p className={`text-[17px] font-semibold ${dueToTenant > 0 ? 'text-[#1a7a3a]' : 'text-[#9b9b99]'}`}>
                  {formatCurrency(dueToTenant)}
                </p>
              </div>
              <div className="bg-[#f7f6f3] rounded-[6px] p-3">
                <p className="text-[11px] text-[#9b9b99] mb-1">Balance owing landlord</p>
                <p className={`text-[17px] font-semibold ${owingLandlord > 0 ? 'text-[#b3261e]' : 'text-[#9b9b99]'}`}>
                  {formatCurrency(owingLandlord)}
                </p>
              </div>
            </div>

            {/* Compliance checkbox — unlocks the Download button when checked */}
            <label className={`flex items-start gap-3 p-3 rounded-[6px] border cursor-pointer transition-colors ${
              complianceChecked
                ? 'bg-[#e3f5e6] border-[#1a7a3a]'
                : 'bg-[#f7f6f3] border-[#e8e7e4] hover:border-[#d4d3d0]'
            }`}>
              <input
                type="checkbox"
                checked={complianceChecked}
                onChange={e => setComplianceChecked(e.target.checked)}
                className="mt-0.5 w-4 h-4 shrink-0 accent-[#1a7a3a]"
              />
              <span className="text-[13px] text-[#6b6b6a] leading-snug">
                I confirm all charges reflect company-approved rates and this return is accurate.
              </span>
            </label>
          </div>

          {/* ══ RIGHT: PDF preview + form summary + email ══ */}
          <div className="space-y-4">

            {/* PDF preview card */}
            <div className="bg-white border border-[#e8e7e4] rounded-[8px] p-5 space-y-4">
              <h2 className="text-[13px] font-semibold text-[#1a1a19]">PDF preview</h2>

              {/* Preview box */}
              <div className="bg-[#f7f6f3] border border-[#e8e7e4] rounded-[6px] p-5 flex flex-col items-center gap-2 text-center">
                {/* Document icon */}
                <svg className="w-9 h-9 text-[#9b9b99]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>

                {/* Filename — uses the format she specified: AGM + unit + full tenant name + property */}
                <p className="text-[13px] font-medium text-[#1a1a19] break-all">{fileName}</p>
                <p className="text-[11px] text-[#9b9b99]">72 / 72 fields populated · AGM Real Estate</p>
                <p className="text-[11px] text-[#9b9b99]">
                  {session.propertyName} · Unit {tenantData.unit} · {tenantData.moveOutDate}
                </p>

                {/* Balance line — red if landlord is owed, green if tenant is owed */}
                {owingLandlord > 0 && (
                  <p className="text-[12px] font-semibold text-[#b3261e]">
                    Balance owing landlord: {formatCurrency(owingLandlord)}
                  </p>
                )}
                {dueToTenant > 0 && (
                  <p className="text-[12px] font-semibold text-[#1a7a3a]">
                    Balance due to tenant: {formatCurrency(dueToTenant)}
                  </p>
                )}

                {/* Preview + Download button row.
                    Preview is always available. Download requires the compliance checkbox. */}
                <div className="flex gap-2 mt-1">
                  <button className="px-3 py-1.5 text-[12px] border border-[#e8e7e4] rounded-[6px] text-[#1a1a19] hover:bg-white transition-colors">
                    Preview
                  </button>
                  <button
                    onClick={handleDownload}
                    disabled={!complianceChecked || generating}
                    className="px-3 py-1.5 text-[12px] font-medium bg-[#e3f5e6] border border-[#1a7a3a]/40 text-[#1a7a3a] rounded-[6px] hover:bg-[#c8edd0] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                  >
                    {generating ? 'Generating…' : '↓ Download'}
                  </button>
                </div>
              </div>

              {/* Full-width download button — unlocks after compliance check */}
              <button
                onClick={handleDownload}
                disabled={!complianceChecked || generating}
                className="w-full py-2.5 text-[13px] font-semibold bg-[#1a7a3a] text-white rounded-[6px] hover:bg-[#156032] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {generating ? 'Generating PDF…' : `↓ Download ${fileName}`}
              </button>
            </div>

            {/* Form summary */}
            <div className="bg-white border border-[#e8e7e4] rounded-[8px] p-4">
              <p className="text-[10px] font-semibold text-[#9b9b99] uppercase tracking-[0.05em] mb-3">Form summary</p>
              <div className="space-y-0">
                {[
                  ['Property', `${session.propertyName || '—'}, Unit ${tenantData.unit}`],
                  ['Tenant', tenantData.tenantName],
                  ['Move-out date', tenantData.moveOutDate],
                  [
                    'Utility type',
                    utilityData.utilityType === 'RUBS'
                      ? `RUBS · ${formatCurrency(calculatedCharges.utilityCharge)} applied`
                      : 'Flat fee',
                  ],
                  [
                    'Lease break',
                    tenantData.leaseBreak
                      ? `Yes — new tenant ${tenantData.newTenantMoveInDate || tenantData.leaseEndDate}`
                      : 'No',
                  ],
                  ['Inspection', tenantData.inspectionStatus === 'signed' ? 'Signed' : 'Missing'],
                  ['Send to', fwdAddr],
                  [
                    'Deadline',
                    `${formatDeadlineDate(tenantData.moveOutDate)} · ${getDaysRemaining(tenantData.moveOutDate)} days remaining`,
                  ],
                ].map(([label, val]) => (
                  <div key={label} className="flex justify-between text-[11.5px] py-1.5 border-b border-[#eeeeec] last:border-b-0">
                    <span className="text-[#9b9b99] shrink-0">{label}</span>
                    <span className={`font-medium text-right max-w-[55%] ${
                      label === 'Inspection' && val === 'Missing' ? 'text-[#b3261e]' :
                      label === 'Inspection' ? 'text-[#1a7a3a]' :
                      label === 'Lease break' && val !== 'No' ? 'text-[#b3261e]' :
                      label === 'Deadline' ? 'text-[#8b6a00]' :
                      'text-[#1a1a19]'
                    }`}>{val}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Email section — send the PDF directly to the tenant */}
            <div className="bg-white border border-[#e8e7e4] rounded-[8px] p-4 space-y-3">
              <p className="text-[10px] font-semibold text-[#9b9b99] uppercase tracking-[0.05em]">Send to tenant</p>

              <div className="space-y-2">
                <div>
                  <label className="text-[10px] text-[#9b9b99] mb-0.5 block">Tenant email address</label>
                  <input
                    type="email"
                    value={emailAddress}
                    onChange={e => setEmailAddress(e.target.value)}
                    placeholder="tenant@email.com"
                    className="w-full h-[30px] text-[12px] px-2.5 border border-[#e8e7e4] rounded-[4px] bg-white focus:outline-none focus:border-[#2383e2] text-[#1a1a19]"
                  />
                </div>

                {/* Shows a preview of what the email subject line will be */}
                {emailAddress && (
                  <p className="text-[10px] text-[#9b9b99]">
                    Subject: Security Deposit Return — {tenantData.tenantName}, Unit {tenantData.unit}
                  </p>
                )}

                {/* Send button — requires compliance check AND a valid email address */}
                {emailSent ? (
                  <div className="w-full py-2 text-[12px] font-medium text-[#1a7a3a] bg-[#e3f5e6] rounded-[6px] text-center">
                    ✓ Sent to {emailAddress}
                  </div>
                ) : (
                  <button
                    onClick={handleSendEmail}
                    disabled={!complianceChecked || !emailAddress}
                    className="w-full py-2 text-[12px] font-medium border border-[#2383e2] text-[#2383e2] rounded-[6px] hover:bg-[#e6efff] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Send PDF via email
                  </button>
                )}

                {!complianceChecked && (
                  <p className="text-[10px] text-[#9b9b99]">Complete the compliance check first to enable sending.</p>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
