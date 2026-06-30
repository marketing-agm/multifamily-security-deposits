'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/context/SessionContext';
import { formatCurrency } from '@/lib/calculations';
import { formatDeadlineDate, getDaysRemaining, getDeadlineUrgency } from '@/lib/deadlineUtils';

interface Props { returnId: string }

export function ReviewSubmit({ returnId }: Props) {
  const { session, updateReturn } = useSession();
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [done, setDone] = useState(false);

  const tr = session?.returns.find(r => r.id === returnId);
  if (!session || !tr) { router.replace('/dashboard'); return null; }

  const { tenantData, depositData, utilityData, calculatedCharges, manualCharges } = tr;

  const nrcOffset    = Math.min(manualCharges.generalCleaning, depositData.nrcCleaningFee);
  const tenantCleaning = Math.max(0, manualCharges.generalCleaning - nrcOffset);
  const totalCredits = depositData.securityDeposit + depositData.petDeposit + depositData.keyDeposit;
  const totalCharges =
    calculatedCharges.rentDue + calculatedCharges.utilityCharge + tenantCleaning +
    manualCharges.carpetShampooing + manualCharges.painting +
    manualCharges.other1 + manualCharges.other2 + manualCharges.legalCourtCosts;
  const balance       = totalCredits - totalCharges;
  const refund        = balance >= 0;

  const nameParts  = tenantData.tenantName.trim().split(/\s+/);
  const lastName   = nameParts[nameParts.length - 1] || '';
  const fileName   = `AGM_Checkout_${tenantData.unit}_${lastName}.pdf`;

  const daysLeft   = getDaysRemaining(tenantData.moveOutDate);
  const urgency    = getDeadlineUrgency(daysLeft);
  const deadlineColor =
    urgency === 'red' ? { bg: '#fceae8', text: '#b3261e', border: '#b3261e' } :
    urgency === 'amber' ? { bg: '#fdf3da', text: '#8b6a00', border: '#e8c840' } :
    { bg: '#e3f5e6', text: '#1a7a3a', border: '#1a7a3a' };

  async function handleGenerate() {
    if (!checked) return;
    setGenerating(true);
    try {
      const res = await fetch('/AGM_template.pdf');
      const templateBytes = await res.arrayBuffer();
      const { fillAGMCheckoutPDF } = await import('@/lib/pdfFiller');
      const pdfBytes = await fillAGMCheckoutPDF(templateBytes, tr!, session!.propertyName);
      const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
      updateReturn(tr!.id, { processingStatus: 'complete', pdfGenerated: true, complianceChecked: true });
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
        <button onClick={() => router.push(`/return/${encodeURIComponent(tr.id)}`)} className="text-[13px] text-[#2383e2] hover:underline">
          ← Back to form
        </button>
        <p className="text-[13px] font-semibold text-[#1a1a19]">{tenantData.tenantName} · Unit {tenantData.unit}</p>
        <button onClick={() => router.push('/dashboard')} className="text-[13px] text-[#9b9b99] hover:text-[#1a1a19]">
          All returns
        </button>
      </div>

      {/* Centered content */}
      <div className="flex-1 flex items-start justify-center pt-10 px-4">
        <div className="w-full max-w-md space-y-3">

          {/* Deadline pill */}
          <div
            className="flex items-center justify-between px-4 py-2.5 rounded-[8px] border"
            style={{ background: deadlineColor.bg, borderColor: deadlineColor.border + '50' }}
          >
            <p className="text-[12px] font-medium" style={{ color: deadlineColor.text }}>
              Return due by {formatDeadlineDate(tenantData.moveOutDate)}
            </p>
            <span
              className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold border"
              style={{ background: '#fff', color: deadlineColor.text, borderColor: deadlineColor.border + '60' }}
            >
              {daysLeft > 0 ? `${daysLeft} days remaining` : 'Overdue'}
            </span>
          </div>

          {/* Main receipt card */}
          <div className="bg-white border border-[#e8e7e4] rounded-[10px] overflow-hidden">

            {/* Balance — the number that matters most */}
            <div className={`px-6 py-6 text-center ${refund ? 'bg-[#e3f5e6]' : 'bg-[#fceae8]'}`}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.06em] mb-1" style={{ color: refund ? '#1a7a3a' : '#b3261e' }}>
                {refund ? 'Balance due to tenant' : 'Balance owing landlord'}
              </p>
              <p className="text-[38px] font-bold leading-none" style={{ color: refund ? '#1a7a3a' : '#b3261e' }}>
                {formatCurrency(Math.abs(balance))}
              </p>
            </div>

            {/* Totals breakdown */}
            <div className="px-5 py-4 space-y-2 border-b border-[#e8e7e4]">
              <div className="flex justify-between text-[13px]">
                <span className="text-[#9b9b99]">Total credits</span>
                <span className="font-medium text-[#1a1a19]">{formatCurrency(totalCredits)}</span>
              </div>
              <div className="flex justify-between text-[13px]">
                <span className="text-[#9b9b99]">Total charges</span>
                <span className="font-medium text-[#b3261e]">{formatCurrency(totalCharges)}</span>
              </div>
              <div className="flex justify-between text-[11px] text-[#9b9b99] pt-1">
                <span>{utilityData.utilityType === 'RUBS' ? 'RUBS' : 'Flat fee'}{tenantData.leaseBreak ? ' · Lease break' : ''}</span>
                <span>{tenantData.moveOutDate} · {session.propertyName}</span>
              </div>
            </div>

            {/* Compliance checkbox */}
            <label className={`flex items-start gap-3 px-5 py-4 cursor-pointer border-b border-[#e8e7e4] transition-colors ${checked ? 'bg-[#f0faf2]' : 'bg-white'}`}>
              <input
                type="checkbox"
                checked={checked}
                onChange={e => setChecked(e.target.checked)}
                className="mt-0.5 w-4 h-4 shrink-0 accent-[#1a7a3a]"
              />
              <span className="text-[13px] text-[#6b6b6a] leading-snug">
                I confirm all charges reflect company-approved rates and this return is accurate.
              </span>
            </label>

            {/* Generate button */}
            <div className="px-5 py-4">
              {done ? (
                <div className="text-center space-y-2">
                  <p className="text-[15px] font-semibold text-[#1a7a3a]">✓ PDF downloaded</p>
                  <p className="text-[12px] text-[#9b9b99]">{fileName}</p>
                  <button onClick={() => router.push('/dashboard')} className="mt-2 text-[13px] text-[#2383e2] hover:underline">
                    Back to all returns →
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleGenerate}
                  disabled={!checked || generating}
                  className="w-full py-3 rounded-[8px] text-[14px] font-semibold transition-all disabled:cursor-not-allowed"
                  style={{
                    background: checked ? '#1a1a19' : '#e8e7e4',
                    color: checked ? '#fff' : '#9b9b99',
                  }}
                >
                  {generating ? 'Generating PDF…' : `Generate & Download PDF`}
                </button>
              )}
            </div>
          </div>

          {/* Filename hint */}
          {!done && (
            <p className="text-center text-[11px] text-[#9b9b99]">{fileName}</p>
          )}
        </div>
      </div>
    </div>
  );
}
