'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/context/SessionContext';
import { calcBalance, calcTotalCharges, calcTotalCredits, formatCurrency } from '@/lib/calculations';
import { fillAGMCheckoutPDF } from '@/lib/pdfFiller';

interface Props {
  returnId: string;
}

// California law requires the security deposit return to be sent within 21 days of move-out.
function getDeadlineInfo(moveOutDate: string): { dateStr: string; daysRemaining: number } {
  const moveOut = new Date(moveOutDate + 'T00:00:00');
  const deadline = new Date(moveOut);
  deadline.setDate(deadline.getDate() + 21);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysRemaining = Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const dateStr = deadline.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  return { dateStr, daysRemaining };
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

  const { tenantData, depositData } = tenantReturn;
  const totalCharges = calcTotalCharges(tenantReturn);
  const totalCredits = calcTotalCredits(tenantReturn);
  const balance = calcBalance(tenantReturn);
  const { dateStr: deadlineDate, daysRemaining } = getDeadlineInfo(tenantData.moveOutDate);

  // Forwarding address formatted as a single string
  const forwardingAddr = [
    tenantData.forwardingAddress.street,
    tenantData.forwardingAddress.city,
    tenantData.forwardingAddress.state,
    tenantData.forwardingAddress.zip,
  ].filter(Boolean).join(', ');

  // File name format: AGM_Checkout_Report_<Unit>_<PropertyNoSpaces>.pdf
  const propertySlug = session.propertyName.replace(/\s+/g, '');
  const pdfFileName = `AGM_Checkout_Report_${tenantData.unit}_${propertySlug}.pdf`;

  async function handleGeneratePDF() {
    if (!complianceChecked) return;
    setGenerating(true);
    try {
      const templateRes = await fetch('/AGM_template.pdf');
      if (!templateRes.ok) throw new Error('PDF template not found. Make sure AGM_template.pdf is in /public.');
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
    a.download = pdfFileName;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Deadline banner color: red if overdue or ≤3 days, amber if ≤7 days, green otherwise
  const deadlineBg =
    daysRemaining <= 3  ? 'bg-red-50 border-red-200 text-[#b3261e]' :
    daysRemaining <= 7  ? 'bg-amber-50 border-amber-200 text-[#8b6a00]' :
    'bg-green-50 border-green-200 text-[#1a7a3a]';

  return (
    <div className="min-h-screen bg-[#f5f5f3]">
      {/* Header */}
      <div className="bg-white border-b border-[#e8e7e4] px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center gap-4">
          <button
            onClick={() => router.push(`/return/${returnId}`)}
            className="text-sm text-[#9b9b99] hover:text-[#1a1a19] transition-colors"
          >
            ← Return Form
          </button>
          <h1 className="text-base font-semibold text-[#1a1a19]">
            Review & Submit — {tenantData.tenantName} · Unit {tenantData.unit}
          </h1>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-6 space-y-4">
        {/* Deadline notice banner */}
        <div className={`rounded-xl border p-4 ${deadlineBg}`}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-semibold mb-0.5">
                {daysRemaining > 0
                  ? `Due in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'} — by ${deadlineDate}`
                  : daysRemaining === 0
                    ? `Due today — ${deadlineDate}`
                    : `Overdue by ${Math.abs(daysRemaining)} day${Math.abs(daysRemaining) === 1 ? '' : 's'}`
                }
              </p>
              <p className="text-sm">
                California law requires the deposit return to be mailed within 21 days of move-out.
              </p>
            </div>
          </div>
          {forwardingAddr && (
            <div className="mt-3 pt-3 border-t border-current border-opacity-20">
              <p className="text-xs font-medium uppercase tracking-wide opacity-70 mb-0.5">Send to</p>
              <p className="text-sm font-medium">{tenantData.tenantName}</p>
              <p className="text-sm">{forwardingAddr}</p>
            </div>
          )}
          {!forwardingAddr && (
            <p className="mt-2 text-sm font-medium">⚠ No forwarding address on file — update in the Return Form.</p>
          )}
        </div>

        {/* Balance summary card */}
        <div className={`rounded-xl border p-4 flex justify-between items-center ${balance >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <div className="text-sm">
            <p className={`font-semibold ${balance >= 0 ? 'text-[#1a7a3a]' : 'text-[#b3261e]'}`}>
              {balance >= 0 ? 'Return to Tenant' : 'Balance Owed to Landlord'}
            </p>
            <p className="text-[#9b9b99] text-xs mt-0.5">
              Credits {formatCurrency(totalCredits)} − Charges {formatCurrency(totalCharges)}
            </p>
          </div>
          <span className={`text-2xl font-bold ${balance >= 0 ? 'text-[#1a7a3a]' : 'text-[#b3261e]'}`}>
            {formatCurrency(Math.abs(balance))}
          </span>
        </div>

        {/* PDF preview card */}
        <div className="bg-white rounded-xl border border-[#e8e7e4] p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-[#1a1a19]">AGM Checkout Report</h2>
              <p className="text-xs text-[#9b9b99] mt-0.5 font-mono">{pdfFileName}</p>
            </div>
            {tenantData.inspectionStatus === 'missing' && (
              <span className="text-xs text-[#b3261e] bg-red-50 border border-red-200 rounded-lg px-2 py-1 font-medium">
                No inspection on file
              </span>
            )}
          </div>

          {/* Simulated PDF preview placeholder */}
          <div className="bg-[#f5f5f3] border border-[#e8e7e4] rounded-lg h-56 flex items-center justify-center mb-5">
            <div className="text-center">
              <div className="w-10 h-10 bg-[#e8e7e4] rounded-lg mx-auto mb-2 flex items-center justify-center">
                <span className="text-[#9b9b99] text-lg">📄</span>
              </div>
              <p className="text-sm text-[#9b9b99]">
                {pdfReady ? 'PDF generated — ready to download' : 'Generate PDF to preview'}
              </p>
              <p className="text-xs text-[#9b9b99] mt-0.5">{pdfFileName}</p>
            </div>
          </div>

          {/* Compliance checkbox */}
          <label className="flex items-start gap-3 cursor-pointer mb-5">
            <input
              type="checkbox"
              checked={complianceChecked}
              onChange={e => setComplianceChecked(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-[#e8e7e4] accent-[#2383e2]"
            />
            <span className="text-sm text-[#1a1a19]">
              I confirm all charges reflect company-approved rates and this return is accurate and complete.
            </span>
          </label>

          {/* Generate / Download button */}
          {!pdfReady ? (
            <button
              onClick={handleGeneratePDF}
              disabled={!complianceChecked || generating}
              className="w-full bg-[#2383e2] hover:bg-[#1a6fc7] disabled:bg-[#e8e7e4] disabled:text-[#9b9b99] disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors"
            >
              {generating ? 'Generating PDF…' : 'Finalize & Generate PDF'}
            </button>
          ) : (
            <div className="space-y-3">
              <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-[#1a7a3a] text-center font-medium">
                PDF ready
              </div>
              <button
                onClick={handleDownload}
                className="w-full bg-[#1a7a3a] hover:bg-[#155f2e] text-white font-semibold py-3 rounded-xl transition-colors"
              >
                Download {pdfFileName}
              </button>
            </div>
          )}
        </div>

        <button
          onClick={() => router.push('/dashboard')}
          className="w-full border border-[#e8e7e4] text-[#9b9b99] hover:text-[#1a1a19] hover:border-[#9b9b99] font-medium py-2.5 rounded-xl transition-colors text-sm"
        >
          Back to Dashboard
        </button>
      </div>
    </div>
  );
}
