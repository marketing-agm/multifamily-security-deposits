'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/context/SessionContext';
import { formatCurrency } from '@/lib/calculations';
import { formatDeadlineDate, getDaysRemaining } from '@/lib/deadlineUtils';

interface Props { returnId: string }

export function ReviewSubmit({ returnId }: Props) {
  const { session, updateReturn } = useSession();
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [done, setDone] = useState(false);

  const trMaybe = session?.returns.find(r => r.id === returnId);
  if (!session || !trMaybe) { router.replace('/dashboard'); return null; }
  const tr = trMaybe;

  const { tenantData, depositData, utilityData, calculatedCharges, manualCharges } = tr;

  // NRC offset: the NRC cleaning fee covers the first $N of cleaning charges
  const nrcOffset      = Math.min(manualCharges.generalCleaning, depositData.nrcCleaningFee);
  const tenantCleaning = Math.max(0, manualCharges.generalCleaning - nrcOffset);

  const totalCredits = depositData.securityDeposit + depositData.petDeposit + depositData.keyDeposit;
  const totalCharges =
    calculatedCharges.rentDue + calculatedCharges.utilityCharge + tenantCleaning +
    manualCharges.carpetShampooing + manualCharges.painting +
    manualCharges.other1 + manualCharges.other2 + manualCharges.legalCourtCosts;
  const balance = totalCredits - totalCharges;
  const refund  = balance >= 0;

  // PDF filename: AGM_Checkout_<unit>_<lastName>.pdf
  const nameParts = tenantData.tenantName.trim().split(/\s+/);
  const lastName  = nameParts[nameParts.length - 1] || '';
  const fileName  = `AGM_Checkout_${tenantData.unit}_${lastName}.pdf`;

  // Forwarding address as a single string
  const { street, city, state, zip } = tenantData.forwardingAddress;
  const addressLine = [street, city && state ? `${city} ${state} ${zip}` : ''].filter(Boolean).join(', ');

  // Deadline info
  const daysLeft    = getDaysRemaining(tenantData.moveOutDate);
  const deadlineStr = formatDeadlineDate(tenantData.moveOutDate);
  const isUrgent    = daysLeft < 7;

  // RUBS detail string for form summary
  const rubsDetail = utilityData.utilityType === 'RUBS'
    ? `RUBS · ${formatCurrency(calculatedCharges.utilityCharge)} chargeback`
    : `Flat fee · ${formatCurrency(calculatedCharges.utilityCharge)}`;

  async function handleGenerate() {
    if (!checked) return;
    setGenerating(true);
    try {
      const res = await fetch('/AGM_template.pdf');
      const templateBytes = await res.arrayBuffer();
      const { fillAGMCheckoutPDF } = await import('@/lib/pdfFiller');
      const pdfBytes = await fillAGMCheckoutPDF(templateBytes, tr, session!.propertyName);
      const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
      updateReturn(tr.id, { processingStatus: 'complete', pdfGenerated: true, complianceChecked: true });
      setDone(true);
    } catch (err) {
      console.error('PDF generation failed:', err);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f5f3] flex flex-col">

      {/* Top nav */}
      <div className="bg-white border-b border-[#e8e7e4] px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push(`/return/${encodeURIComponent(tr.id)}`)}
            className="text-[12px] text-[#2383e2] hover:underline flex items-center gap-1"
          >
            ← Back to edit
          </button>
          <div className="w-px h-[14px] bg-[#d0cfcc]" />
          <div>
            <p className="text-[13px] font-medium text-[#1a1a19]">
              Review &amp; submit — {tenantData.tenantName}, Unit {tenantData.unit}
            </p>
            <p className="text-[11px] text-[#9b9b99]">All fields populated · Ready for compliance check</p>
          </div>
        </div>
        <button
          onClick={handleGenerate}
          disabled={!checked || generating || done}
          className="text-[12px] font-medium px-4 py-1.5 rounded-[6px] border flex items-center gap-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            background: done ? '#e3f5e6' : '#f5f5f3',
            borderColor: done ? '#1a7a3a' : '#d0cfcc',
            color: done ? '#1a7a3a' : '#6b6b6a',
          }}
        >
          ↓ {done ? 'Downloaded' : 'Download PDF'}
        </button>
      </div>

      <div className="flex-1 px-6 py-5 overflow-y-auto">

        {/* Notice banner */}
        <div
          className="mb-5 flex items-start justify-between gap-4 rounded-r-[8px] px-4 py-3"
          style={{
            borderLeft: `4px solid ${isUrgent ? '#b3261e' : '#e8c840'}`,
            background: isUrgent ? '#fceae8' : '#fdf3da',
          }}
        >
          <div>
            <p
              className="text-[11px] font-semibold uppercase tracking-[0.03em] mb-1"
              style={{ color: isUrgent ? '#b3261e' : '#8b6a00' }}
            >
              Notice — Deposit return due within 21 days of move-out
            </p>
            <p className="text-[12px] text-[#1a1a19] leading-relaxed">
              Full deposit return or itemized statement of deductions must be delivered by{' '}
              <strong>{deadlineStr}</strong>. Failure to comply may result in forfeiture of
              deduction rights and damages under California Civil Code §1950.5.
            </p>
          </div>
          <div
            className="shrink-0 rounded-[6px] border px-4 py-2 text-center bg-white"
            style={{ borderColor: isUrgent ? '#b3261e' : '#e8c840' }}
          >
            <p
              className="text-[20px] font-medium leading-none"
              style={{ color: isUrgent ? '#b3261e' : '#8b6a00' }}
            >
              {daysLeft > 0 ? daysLeft : '0'}
            </p>
            <p className="text-[10px] text-[#9b9b99] mt-0.5">days remaining</p>
          </div>
        </div>

        {/* Two-column grid */}
        <div className="grid grid-cols-2 gap-4">

          {/* LEFT — Calculation summary */}
          <div className="bg-white border border-[#e8e7e4] rounded-[10px] p-4">
            <p className="text-[12px] font-medium text-[#6b6b6a] mb-3 pb-2 border-b border-[#e8e7e4] flex items-center gap-1.5">
              🧮 Calculation summary
            </p>

            {/* Credits */}
            <p className="text-[10px] font-semibold uppercase tracking-[0.05em] text-[#9b9b99] mb-1.5">Credits</p>
            <div className="space-y-0 mb-3">
              <div className="flex justify-between text-[12.5px] py-1.5 border-b border-[#f0eeeb]">
                <span className="text-[#6b6b6a]">Security deposit</span>
                <span className="font-medium text-[#1a7a3a]">{formatCurrency(depositData.securityDeposit)}</span>
              </div>
              {depositData.petDeposit > 0 && (
                <div className="flex justify-between text-[12.5px] py-1.5 border-b border-[#f0eeeb]">
                  <span className="text-[#6b6b6a]">Pet deposit</span>
                  <span className="font-medium text-[#1a7a3a]">{formatCurrency(depositData.petDeposit)}</span>
                </div>
              )}
              {depositData.keyDeposit > 0 && (
                <div className="flex justify-between text-[12.5px] py-1.5 border-b border-[#f0eeeb]">
                  <span className="text-[#6b6b6a]">Key deposit</span>
                  <span className="font-medium text-[#1a7a3a]">{formatCurrency(depositData.keyDeposit)}</span>
                </div>
              )}
              <div className="flex justify-between text-[13px] font-semibold py-1.5">
                <span className="text-[#6b6b6a]">Total credits</span>
                <span className="text-[#1a7a3a]">{formatCurrency(totalCredits)}</span>
              </div>
            </div>

            {/* Charges */}
            <p className="text-[10px] font-semibold uppercase tracking-[0.05em] text-[#9b9b99] mb-1.5">Charges</p>
            <div className="space-y-0 mb-3">
              {calculatedCharges.rentDue > 0 && (
                <div className="flex justify-between text-[12.5px] py-1.5 border-b border-[#f0eeeb]">
                  <span className="text-[#6b6b6a]">
                    Rent due{tenantData.leaseBreak && calculatedCharges.rentDueDateRange
                      ? ` (${calculatedCharges.rentDueDateRange})`
                      : tenantData.leaseBreak ? ' (pro-rated)' : ''}
                  </span>
                  <span className="font-medium text-[#1a1a19]">{formatCurrency(calculatedCharges.rentDue)}</span>
                </div>
              )}
              {calculatedCharges.utilityCharge > 0 && (
                <div className="flex justify-between text-[12.5px] py-1.5 border-b border-[#f0eeeb]">
                  <span className="text-[#6b6b6a]">
                    {utilityData.utilityType === 'RUBS'
                      ? `RUBS chargeback ($${utilityData.rubsBuildingTotal.toLocaleString()} × ${(utilityData.rubsUnitRatio * 100).toFixed(1)}%)`
                      : 'Utility flat fee'}
                  </span>
                  <span className="font-medium text-[#2383e2]">{formatCurrency(calculatedCharges.utilityCharge)}</span>
                </div>
              )}
              {manualCharges.generalCleaning > 0 && (
                <div className="flex justify-between text-[12.5px] py-1.5 border-b border-[#f0eeeb]">
                  <span className="text-[#6b6b6a]">
                    {nrcOffset > 0 ? `Cleaning — NRC ${formatCurrency(nrcOffset)} offsets` : 'Cleaning'}
                  </span>
                  <span className="font-medium text-[#1a1a19]">{formatCurrency(tenantCleaning)}</span>
                </div>
              )}
              {manualCharges.painting > 0 && (
                <div className="flex justify-between text-[12.5px] py-1.5 border-b border-[#f0eeeb]">
                  <span className="text-[#6b6b6a]">Painting touch-up</span>
                  <span className="font-medium text-[#1a1a19]">{formatCurrency(manualCharges.painting)}</span>
                </div>
              )}
              {manualCharges.carpetShampooing > 0 && (
                <div className="flex justify-between text-[12.5px] py-1.5 border-b border-[#f0eeeb]">
                  <span className="text-[#6b6b6a]">Carpet shampooing</span>
                  <span className="font-medium text-[#1a1a19]">{formatCurrency(manualCharges.carpetShampooing)}</span>
                </div>
              )}
              {manualCharges.other1 > 0 && (
                <div className="flex justify-between text-[12.5px] py-1.5 border-b border-[#f0eeeb]">
                  <span className="text-[#6b6b6a]">{manualCharges.other1Label || 'Other'}</span>
                  <span className="font-medium text-[#1a1a19]">{formatCurrency(manualCharges.other1)}</span>
                </div>
              )}
              {manualCharges.other2 > 0 && (
                <div className="flex justify-between text-[12.5px] py-1.5 border-b border-[#f0eeeb]">
                  <span className="text-[#6b6b6a]">{manualCharges.other2Label || 'Other'}</span>
                  <span className="font-medium text-[#1a1a19]">{formatCurrency(manualCharges.other2)}</span>
                </div>
              )}
              <div className="flex justify-between text-[13px] font-semibold py-1.5">
                <span className="text-[#6b6b6a]">Total charges</span>
                <span style={{ color: refund ? '#1a1a19' : '#b3261e' }}>{formatCurrency(totalCharges)}</span>
              </div>
            </div>

            {/* Balance cards side by side */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div
                className="rounded-[6px] border p-3"
                style={{
                  background: refund ? '#e3f5e6' : '#f5f5f3',
                  borderColor: refund ? '#1a7a3a' : '#e8e7e4',
                }}
              >
                <p className="text-[10px] text-[#9b9b99] mb-1">Balance due to tenant</p>
                <p className="text-[20px] font-medium" style={{ color: refund ? '#1a7a3a' : '#9b9b99' }}>
                  {refund ? formatCurrency(balance) : '$0.00'}
                </p>
              </div>
              <div
                className="rounded-[6px] border p-3"
                style={{
                  background: !refund ? '#fceae8' : '#f5f5f3',
                  borderColor: !refund ? '#b3261e' : '#e8e7e4',
                }}
              >
                <p className="text-[10px] text-[#9b9b99] mb-1">Balance owing landlord</p>
                <p className="text-[20px] font-medium" style={{ color: !refund ? '#b3261e' : '#9b9b99' }}>
                  {!refund ? formatCurrency(Math.abs(balance)) : '$0.00'}
                </p>
              </div>
            </div>

            {/* Send to box */}
            {addressLine && (
              <div className="flex items-start gap-2 px-3 py-2.5 rounded-[6px] border border-[#c5d9f5] bg-[#e6efff] mb-3">
                <span className="text-[14px] mt-0.5">✉</span>
                <div>
                  <p className="text-[11px] font-medium text-[#2383e2]">Will be sent to</p>
                  <p className="text-[11px] text-[#2383e2]">{addressLine}</p>
                </div>
              </div>
            )}

            {/* Compliance checkbox */}
            <label
              className="flex items-start gap-2.5 px-3 py-2.5 rounded-[6px] border cursor-pointer transition-colors"
              style={{
                background: checked ? '#e3f5e6' : '#f5f5f3',
                borderColor: checked ? '#1a7a3a' : '#e8e7e4',
              }}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={e => setChecked(e.target.checked)}
                className="mt-0.5 w-4 h-4 shrink-0 accent-[#1a7a3a]"
              />
              <span className="text-[12.5px] leading-snug" style={{ color: checked ? '#1a7a3a' : '#6b6b6a' }}>
                I confirm all charges reflect company-approved rates and this return is accurate.
              </span>
            </label>
          </div>

          {/* RIGHT — PDF preview + form summary */}
          <div className="bg-white border border-[#e8e7e4] rounded-[10px] p-4 flex flex-col gap-3">
            <p className="text-[12px] font-medium text-[#6b6b6a] pb-2 border-b border-[#e8e7e4] flex items-center gap-1.5">
              📄 PDF preview
            </p>

            {/* PDF card */}
            <div
              className="border rounded-[8px] p-5 flex flex-col items-center text-center gap-2"
              style={{
                background: done ? '#e3f5e6' : '#f5f5f3',
                borderColor: done ? '#1a7a3a' : '#e8e7e4',
              }}
            >
              <span className="text-[40px]" style={{ filter: done ? 'none' : 'grayscale(1)', opacity: done ? 1 : 0.5 }}>
                📋
              </span>
              <p className="text-[12.5px] font-medium text-[#1a1a19]">{fileName}</p>
              <p className="text-[11px] text-[#9b9b99]">AGM Real Estate · {session.propertyName}</p>
              <p className="text-[11px] text-[#9b9b99]">Unit {tenantData.unit} · {tenantData.moveOutDate}</p>
              <p className="text-[11px] font-medium" style={{ color: refund ? '#1a7a3a' : '#b3261e' }}>
                {refund ? 'Balance due to tenant' : 'Balance owing landlord'}: {formatCurrency(Math.abs(balance))}
              </p>
              <div className="flex gap-2 mt-1">
                <button
                  className="text-[11px] px-3 py-1.5 rounded-[5px] border border-[#e8e7e4] bg-white text-[#6b6b6a] flex items-center gap-1 opacity-50 cursor-not-allowed"
                  disabled
                >
                  👁 Preview
                </button>
                <button
                  onClick={handleGenerate}
                  disabled={!checked || generating || done}
                  className="text-[11px] px-3 py-1.5 rounded-[5px] border flex items-center gap-1 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    background: checked && !done ? '#e3f5e6' : '#f5f5f3',
                    borderColor: checked && !done ? '#1a7a3a' : '#e8e7e4',
                    color: checked && !done ? '#1a7a3a' : '#9b9b99',
                  }}
                >
                  ↓ {done ? '✓ Done' : 'Download'}
                </button>
              </div>
            </div>

            {/* Form summary table */}
            <div className="border border-[#e8e7e4] rounded-[8px] p-3 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.05em] text-[#9b9b99] mb-2">Form summary</p>
              {([
                ['Property',           `${session.propertyName}, Unit ${tenantData.unit}`],
                ['Tenant',             tenantData.tenantName],
                ['Move-out date',      tenantData.moveOutDate],
                ['Utility type',       rubsDetail],
                ['Lease break',        tenantData.leaseBreak
                                         ? `Yes — new tenant ${tenantData.newTenantMoveInDate ?? '—'}`
                                         : 'No'],
                nrcOffset > 0 ? ['NRC offset applied', `${formatCurrency(nrcOffset)} — cleaning covered`] : null,
                ['Inspection',         tenantData.inspectionStatus === 'signed' ? 'Signed' : 'Missing'],
                addressLine ? ['Send to', addressLine] : null,
                ['Deadline',           `${deadlineStr} · ${daysLeft > 0 ? daysLeft + ' days remaining' : 'Overdue'}`],
                ['Status',             done ? 'Complete — ready to download' : 'Awaiting compliance check'],
              ] as (string[] | null)[]).filter((row): row is string[] => row !== null).map(([label, value], i) => (
                <div key={i} className="flex justify-between py-[5px] border-b border-[#f0eeeb] text-[11.5px] last:border-b-0">
                  <span className="text-[#9b9b99] shrink-0">{label}</span>
                  <span
                    className="font-medium text-right ml-4"
                    style={{
                      color:
                        label === 'NRC offset applied' ? '#1a7a3a' :
                        (label === 'Inspection' && value === 'Signed') ? '#1a7a3a' :
                        label === 'Deadline' ? '#8b6a00' :
                        (label === 'Status' && done) ? '#1a7a3a' :
                        (label === 'Lease break' && value !== 'No') ? '#b3261e' :
                        '#1a1a19',
                    }}
                  >
                    {value}
                  </span>
                </div>
              ))}
            </div>

            {/* Main download button */}
            <button
              onClick={handleGenerate}
              disabled={!checked || generating || done}
              className="w-full py-2.5 rounded-[8px] text-[13px] font-medium flex items-center justify-center gap-2 transition-all disabled:cursor-not-allowed"
              style={{
                background: done ? '#e3f5e6' : checked ? '#1a7a3a' : '#e8e7e4',
                color: done ? '#1a7a3a' : checked ? '#fff' : '#9b9b99',
              }}
            >
              {done
                ? `✓ Downloaded — ${fileName}`
                : generating
                ? 'Generating…'
                : `↓ Download ${fileName}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
