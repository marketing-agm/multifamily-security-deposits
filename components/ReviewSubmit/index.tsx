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

  const [complianceChecked, setComplianceChecked] = useState(false);
  const [generating, setGenerating] = useState(false);

  const tr = session?.returns.find(r => r.id === returnId);
  if (!session || !tr) {
    router.replace('/dashboard');
    return null;
  }

  const { tenantData, depositData, utilityData, calculatedCharges, manualCharges } = tr;

  // NRC offset — non-refundable cleaning fee reduces what the tenant owes for cleaning
  const nrcOffset = Math.min(manualCharges.generalCleaning, depositData.nrcCleaningFee);
  const tenantCleaning = Math.max(0, manualCharges.generalCleaning - nrcOffset);

  const totalCredits = depositData.securityDeposit + depositData.petDeposit + depositData.keyDeposit;

  const totalCharges =
    calculatedCharges.rentDue +
    calculatedCharges.utilityCharge +
    tenantCleaning +
    manualCharges.carpetShampooing +
    manualCharges.painting +
    manualCharges.other1 +
    manualCharges.other2 +
    manualCharges.legalCourtCosts;

  const balance = totalCredits - totalCharges;
  const dueToTenant = balance >= 0 ? balance : 0;
  const owingLandlord = balance < 0 ? Math.abs(balance) : 0;

  const fwdAddr = `${tenantData.forwardingAddress.street}, ${tenantData.forwardingAddress.city} ${tenantData.forwardingAddress.state} ${tenantData.forwardingAddress.zip}`;

  // AGM_Checkout_[Unit]_[LastName].pdf
  const nameParts = tenantData.tenantName.trim().split(/\s+/);
  const lastName = nameParts[nameParts.length - 1] || '';
  const fileName = `AGM_Checkout_${tenantData.unit}_${lastName}.pdf`;

  async function handleDownload() {
    if (!complianceChecked) return;
    setGenerating(true);
    try {
      const res = await fetch('/AGM_template.pdf');
      const templateBytes = await res.arrayBuffer();
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

  // Only non-zero charge rows appear in the summary
  const chargeRows: { label: string; amount: number }[] = [];
  if (calculatedCharges.rentDue > 0)
    chargeRows.push({ label: tenantData.leaseBreak ? 'Rent due (lease break)' : 'Rent due (pro-rated)', amount: calculatedCharges.rentDue });
  if (calculatedCharges.utilityCharge > 0)
    chargeRows.push({ label: utilityData.utilityType === 'RUBS' ? 'RUBS chargeback' : 'Utility — flat fee', amount: calculatedCharges.utilityCharge });
  if (manualCharges.generalCleaning > 0)
    chargeRows.push({ label: nrcOffset > 0 ? `Cleaning (NRC offset −${formatCurrency(nrcOffset)})` : 'Cleaning', amount: tenantCleaning });
  if (manualCharges.carpetShampooing > 0)
    chargeRows.push({ label: 'Carpet shampooing', amount: manualCharges.carpetShampooing });
  if (manualCharges.painting > 0)
    chargeRows.push({ label: 'Painting', amount: manualCharges.painting });
  if (manualCharges.other1 > 0)
    chargeRows.push({ label: manualCharges.other1Label || 'Key replacement', amount: manualCharges.other1 });
  if (manualCharges.other2 > 0)
    chargeRows.push({ label: manualCharges.other2Label || 'Other', amount: manualCharges.other2 });
  if (manualCharges.legalCourtCosts > 0)
    chargeRows.push({ label: 'Legal / court costs', amount: manualCharges.legalCourtCosts });

  const daysRemaining = getDaysRemaining(tenantData.moveOutDate);

  return (
    <div className="min-h-screen bg-[#f5f5f3]">

      {/* ── Top nav ── */}
      <div className="bg-white border-b border-[#e8e7e4] px-6 py-3 flex items-center justify-between">
        <div>
          <p className="text-[14px] font-semibold text-[#1a1a19]">
            Review &amp; submit — {tenantData.tenantName}, Unit {tenantData.unit}
          </p>
          <p className="text-[12px] text-[#9b9b99] mt-0.5">All fields populated · Ready for compliance check</p>
        </div>
        <button
          onClick={() => router.push(`/return/${encodeURIComponent(tr.id)}`)}
          className="px-4 py-1.5 text-[13px] border border-[#d4d3d0] rounded-[6px] text-[#1a1a19] bg-white hover:bg-[#f7f6f3] transition-colors"
        >
          ← Back to edit
        </button>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6 space-y-5">

        {/* Deadline notice banner */}
        <DeadlineBanner moveOutDate={tenantData.moveOutDate} />

        {/* Two equal columns */}
        <div className="grid grid-cols-2 gap-5 items-start">

          {/* ══ LEFT: Calculation summary ══ */}
          <div className="bg-white border border-[#e8e7e4] rounded-[8px] p-5 space-y-4">
            <h2 className="text-[14px] font-semibold text-[#1a1a19]">Calculation summary</h2>

            {/* Credits block */}
            <div className="bg-[#f7f6f3] rounded-[6px] p-4 space-y-2">
              <p className="text-[10px] font-semibold text-[#9b9b99] uppercase tracking-[0.06em] mb-3">Credits</p>
              <div className="flex justify-between text-[13px]">
                <span className="text-[#6b6b6a]">Security deposit</span>
                <span className="text-[#1a1a19]">{formatCurrency(depositData.securityDeposit)}</span>
              </div>
              {depositData.petDeposit > 0 && (
                <div className="flex justify-between text-[13px]">
                  <span className="text-[#6b6b6a]">Pet deposit</span>
                  <span className="text-[#1a1a19]">{formatCurrency(depositData.petDeposit)}</span>
                </div>
              )}
              {depositData.keyDeposit > 0 && (
                <div className="flex justify-between text-[13px]">
                  <span className="text-[#6b6b6a]">Key deposit</span>
                  <span className="text-[#1a1a19]">{formatCurrency(depositData.keyDeposit)}</span>
                </div>
              )}
              <div className="flex justify-between text-[13px] font-semibold border-t border-[#e8e7e4] pt-2 mt-1">
                <span className="text-[#1a1a19]">Total credits</span>
                <span className="text-[#1a1a19]">{formatCurrency(totalCredits)}</span>
              </div>
            </div>

            {/* Charges block */}
            <div className="bg-[#f7f6f3] rounded-[6px] p-4 space-y-2">
              <p className="text-[10px] font-semibold text-[#9b9b99] uppercase tracking-[0.06em] mb-3">Charges</p>
              {chargeRows.map(row => (
                <div key={row.label} className="flex justify-between text-[13px]">
                  <span className="text-[#6b6b6a]">{row.label}</span>
                  <span className="text-[#b3261e]">{formatCurrency(row.amount)}</span>
                </div>
              ))}
              <div className="flex justify-between text-[13px] font-semibold border-t border-[#e8e7e4] pt-2 mt-1">
                <span className="text-[#1a1a19]">Total charges</span>
                <span className="text-[#b3261e]">{formatCurrency(totalCharges)}</span>
              </div>
            </div>

            {/* Balance boxes */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#f7f6f3] border border-[#e8e7e4] rounded-[6px] p-3">
                <p className="text-[11px] text-[#9b9b99] mb-1">Balance due to tenant</p>
                <p className="text-[18px] font-semibold text-[#9b9b99]">{formatCurrency(dueToTenant)}</p>
              </div>
              <div className="bg-[#f7f6f3] border border-[#e8e7e4] rounded-[6px] p-3">
                <p className="text-[11px] text-[#9b9b99] mb-1">Balance owing landlord</p>
                <p className={`text-[18px] font-semibold ${owingLandlord > 0 ? 'text-[#b3261e]' : 'text-[#9b9b99]'}`}>
                  {formatCurrency(owingLandlord)}
                </p>
              </div>
            </div>

            {/* Compliance checkbox */}
            <label className="flex items-start gap-3 bg-[#f7f6f3] border border-[#e8e7e4] rounded-[6px] p-3 cursor-pointer">
              <input
                type="checkbox"
                checked={complianceChecked}
                onChange={e => setComplianceChecked(e.target.checked)}
                className="mt-0.5 w-4 h-4 shrink-0"
              />
              <span className="text-[13px] text-[#6b6b6a] leading-snug">
                I confirm all charges reflect company-approved rates and this return is accurate.
              </span>
            </label>
          </div>

          {/* ══ RIGHT: PDF preview + form summary + download ══ */}
          <div className="bg-white border border-[#e8e7e4] rounded-[8px] overflow-hidden">

            {/* PDF preview heading */}
            <div className="px-5 pt-5 pb-3">
              <h2 className="text-[14px] font-semibold text-[#1a1a19]">PDF preview</h2>
            </div>

            {/* Preview box */}
            <div className="mx-5 bg-[#f7f6f3] border border-[#e8e7e4] rounded-[6px] p-5 flex flex-col items-center gap-1.5 text-center">
              {/* Document icon */}
              <svg className="w-9 h-9 text-[#9b9b99] mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-[13px] font-medium text-[#1a1a19]">{fileName}</p>
              <p className="text-[11px] text-[#9b9b99]">72 / 72 fields populated · AGM Real Estate</p>
              <p className="text-[11px] text-[#9b9b99]">
                {session.propertyName} · Unit {tenantData.unit} · {tenantData.moveOutDate}
              </p>
              {owingLandlord > 0 && (
                <p className="text-[12px] font-semibold text-[#b3261e] mt-0.5">
                  Balance owing landlord: {formatCurrency(owingLandlord)}
                </p>
              )}
              {dueToTenant > 0 && (
                <p className="text-[12px] font-semibold text-[#1a7a3a] mt-0.5">
                  Balance due to tenant: {formatCurrency(dueToTenant)}
                </p>
              )}
              {/* Preview always clickable. Download grayed until compliance checked. */}
              <div className="flex gap-2 mt-2">
                <button className="px-4 py-1.5 text-[12px] border border-[#d4d3d0] rounded-[6px] bg-white text-[#1a1a19] hover:bg-[#f7f6f3] transition-colors">
                  Preview
                </button>
                <button
                  onClick={handleDownload}
                  disabled={!complianceChecked || generating}
                  className="px-4 py-1.5 text-[12px] border border-[#d4d3d0] rounded-[6px] bg-white text-[#6b6b6a] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#f7f6f3] transition-colors"
                >
                  ↓ Download
                </button>
              </div>
            </div>

            {/* Form summary */}
            <div className="px-5 pt-4 pb-2">
              <p className="text-[10px] font-semibold text-[#9b9b99] uppercase tracking-[0.06em] mb-2">Form summary</p>
              <div className="space-y-0">
                {([
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
                  ['Deadline', `${formatDeadlineDate(tenantData.moveOutDate)} · ${daysRemaining} days remaining`],
                ] as [string, string][]).map(([label, val]) => (
                  <div
                    key={label}
                    className="flex justify-between text-[11.5px] py-1.5 border-b border-[#f0f0ee] last:border-b-0"
                  >
                    <span className="text-[#9b9b99] shrink-0 mr-4">{label}</span>
                    <span className={`font-medium text-right ${
                      label === 'Inspection' && val !== 'Signed' ? 'text-[#b3261e]' :
                      label === 'Inspection' ? 'text-[#1a7a3a]' :
                      label === 'Lease break' && val !== 'No' ? 'text-[#b3261e]' :
                      label === 'Deadline' ? 'text-[#8b6a00]' :
                      'text-[#1a1a19]'
                    }`}>
                      {val}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Full-width download button */}
            <div className="px-5 pb-5 pt-3">
              <button
                onClick={handleDownload}
                disabled={!complianceChecked || generating}
                className="w-full py-2.5 text-[13px] font-medium rounded-[6px] transition-colors flex items-center justify-center gap-2 disabled:cursor-not-allowed"
                style={{
                  background: complianceChecked ? '#5a7a6a' : '#8a9a8e',
                  color: '#fff',
                  opacity: complianceChecked ? 1 : 0.75,
                }}
              >
                {generating ? 'Generating…' : `↓ Download ${fileName}`}
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
