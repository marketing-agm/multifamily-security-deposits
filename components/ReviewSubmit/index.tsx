// components/ReviewSubmit/index.tsx
// Final review & submit screen — last step before the PDF is generated.
//
// Layout:
//   [Top nav: back link + title + inspection/utility badges]
//   [Deadline notice banner — color coded by urgency]
//   [Two columns]
//     Left (wider):  Tenant & Lease card, Turnover Expenses table, Refunds/Credits card
//     Right (narrower): Forwarding Address card, Compliance Check card, Finalize button
//
// The "Finalize & Generate PDF" button is grayed out until compliance is checked.

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
  const { session, updateReturn } = useSession();
  const router = useRouter();

  // complianceChecked must be true before the Finalize button unlocks.
  const [complianceChecked, setComplianceChecked] = useState(false);
  const [generating, setGenerating] = useState(false);

  const tr = session?.returns.find(r => r.id === returnId);
  if (!session || !tr) {
    router.replace('/dashboard');
    return null;
  }

  const { tenantData, depositData, utilityData, calculatedCharges, manualCharges } = tr;

  // NRC = Non-Refundable Cleaning fee paid at move-in. Reduces cleaning charge at move-out.
  const nrcOffset = Math.min(manualCharges.generalCleaning, depositData.nrcCleaningFee);
  const tenantCleaning = Math.max(0, manualCharges.generalCleaning - nrcOffset);

  // Total credits = all deposits the tenant paid up front.
  const totalCredits = depositData.securityDeposit + depositData.petDeposit + depositData.keyDeposit;

  // Total charges = all amounts the tenant owes at move-out.
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

  const fwdAddr = `${tenantData.forwardingAddress.street}, ${tenantData.forwardingAddress.city} ${tenantData.forwardingAddress.state} ${tenantData.forwardingAddress.zip}`;

  // PDF filename: AGM_Checkout_[Unit]_[Tenant full name]_[Property].pdf
  const tenantSlug = tenantData.tenantName.replace(/\s+/g, '_');
  const propertySlug = (session.propertyName || 'AGM').replace(/\s+/g, '_');
  const fileName = `AGM_Checkout_${tenantData.unit}_${tenantSlug}_${propertySlug}.pdf`;

  async function handleFinalize() {
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

  // Turnover charges array — only include non-zero rows in the table.
  // Each row: [item label, total cost, tenant cost (after NRC offset if applicable)]
  const chargeRows: { label: string; total: number; tenantCost: number; note?: string }[] = [];

  if (calculatedCharges.rentDue > 0) {
    chargeRows.push({
      label: tenantData.leaseBreak ? 'Rent due (lease break)' : 'Rent due',
      total: calculatedCharges.rentDue,
      tenantCost: calculatedCharges.rentDue,
      note: calculatedCharges.rentDueDateRange || undefined,
    });
  }
  if (calculatedCharges.utilityCharge > 0) {
    chargeRows.push({
      label: utilityData.utilityType === 'RUBS' ? 'RUBS utility chargeback' : 'Utility — flat fee',
      total: calculatedCharges.utilityCharge,
      tenantCost: calculatedCharges.utilityCharge,
    });
  }
  if (manualCharges.generalCleaning > 0) {
    chargeRows.push({
      label: 'General cleaning',
      total: manualCharges.generalCleaning,
      tenantCost: tenantCleaning,
      note: nrcOffset > 0 ? `NRC offset −${formatCurrency(nrcOffset)}` : undefined,
    });
  }
  if (manualCharges.carpetShampooing > 0) {
    chargeRows.push({ label: 'Carpet shampooing', total: manualCharges.carpetShampooing, tenantCost: manualCharges.carpetShampooing });
  }
  if (manualCharges.painting > 0) {
    chargeRows.push({ label: 'Painting', total: manualCharges.painting, tenantCost: manualCharges.painting });
  }
  if (manualCharges.other1 > 0) {
    chargeRows.push({ label: manualCharges.other1Label || 'Other', total: manualCharges.other1, tenantCost: manualCharges.other1 });
  }
  if (manualCharges.other2 > 0) {
    chargeRows.push({ label: 'Other (2)', total: manualCharges.other2, tenantCost: manualCharges.other2 });
  }
  if (manualCharges.legalCourtCosts > 0) {
    chargeRows.push({ label: 'Legal / court costs', total: manualCharges.legalCourtCosts, tenantCost: manualCharges.legalCourtCosts });
  }

  return (
    <div className="min-h-screen bg-[#fbfbfa]">

      {/* ── Top nav ── */}
      <div className="bg-white border-b border-[#e8e7e4] px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Back link goes to the form (AgentForm) for this tenant */}
          <button
            onClick={() => router.push(`/return/${encodeURIComponent(tr.id)}`)}
            className="text-[12px] text-[#2383e2] hover:underline shrink-0"
          >
            ← Return Form
          </button>
          <div className="w-px h-4 bg-[#d4d3d0]" />
          <p className="text-[13px] font-semibold text-[#1a1a19]">
            Review &amp; Submit — {tenantData.tenantName} · Unit {tenantData.unit}
          </p>
        </div>

        {/* Right: inspection and utility badges */}
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${
            tenantData.inspectionStatus === 'signed'
              ? 'bg-[#e3f5e6] text-[#1a7a3a]'
              : 'bg-[#fceae8] text-[#b3261e]'
          }`}>
            {tenantData.inspectionStatus === 'signed' ? '✓ Signed' : '⚠ No inspection'}
          </span>
          {utilityData.utilityType === 'RUBS' && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#e6efff] text-[#1858b8]">
              RUBS
            </span>
          )}
          {tenantData.leaseBreak && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#fceae8] text-[#b3261e]">
              Lease break
            </span>
          )}
        </div>
      </div>

      {/* ── Page body ── */}
      <div className="max-w-5xl mx-auto px-6 py-5 space-y-4">

        {/* Deadline banner — color-coded by urgency (green/amber/red). California §1950.5 requires 21 days. */}
        <DeadlineBanner moveOutDate={tenantData.moveOutDate} />

        {/* Two-column layout: left is wider (2/3), right is narrower (1/3) */}
        <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-4 items-start">

          {/* ════════════════════════════════════
              LEFT COLUMN
              ════════════════════════════════════ */}
          <div className="space-y-4">

            {/* ── Tenant & Lease card ── */}
            <div className="bg-white border border-[#e8e7e4] rounded-[8px] overflow-hidden">
              <div className="px-4 py-3 border-b border-[#e8e7e4]">
                <h2 className="text-[13px] font-semibold text-[#1a1a19]">Tenant &amp; Lease</h2>
              </div>
              <div className="divide-y divide-[#f0f0ee]">
                {[
                  { label: 'Tenant', value: tenantData.tenantName + (tenantData.coTenant ? ` + ${tenantData.coTenant}` : '') },
                  { label: 'Unit', value: tenantData.unit },
                  { label: 'Forwarding address', value: fwdAddr },
                  { label: 'Move-in date', value: tenantData.moveInDate },
                  { label: 'Move-out date', value: tenantData.moveOutDate },
                  { label: 'Paid through', value: tenantData.paidThroughDate || '—' },
                  { label: 'Monthly rent', value: formatCurrency(tenantData.monthlyRent) + ' / mo' },
                  {
                    label: 'Lease break',
                    value: tenantData.leaseBreak ? 'Yes — rent due after move-out' : 'No',
                    red: tenantData.leaseBreak,
                  },
                  ...(tenantData.leaseBreak && tenantData.newTenantMoveInDate
                    ? [{ label: 'New tenant move-in', value: tenantData.newTenantMoveInDate }]
                    : []),
                ].map(row => (
                  <div key={row.label} className="flex justify-between px-4 py-2.5 text-[12.5px]">
                    <span className="text-[#9b9b99]">{row.label}</span>
                    <span className={`font-medium text-right max-w-[60%] ${'red' in row && row.red ? 'text-[#b3261e]' : 'text-[#1a1a19]'}`}>
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Turnover Expenses table ── */}
            <div className="bg-white border border-[#e8e7e4] rounded-[8px] overflow-hidden">
              <div className="px-4 py-3 border-b border-[#e8e7e4]">
                <h2 className="text-[13px] font-semibold text-[#1a1a19]">Turnover Expenses</h2>
              </div>
              {chargeRows.length === 0 ? (
                <p className="px-4 py-4 text-[12px] text-[#9b9b99]">No charges entered.</p>
              ) : (
                <table className="w-full text-[12.5px]">
                  <thead>
                    <tr className="bg-[#f7f6f3] border-b border-[#e8e7e4]">
                      <th className="text-left px-4 py-2 font-medium text-[#9b9b99]">Item</th>
                      <th className="text-right px-4 py-2 font-medium text-[#9b9b99]">Total Cost</th>
                      <th className="text-right px-4 py-2 font-medium text-[#9b9b99]">Tenant Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f0f0ee]">
                    {chargeRows.map(row => (
                      <tr key={row.label}>
                        <td className="px-4 py-2.5">
                          <span className="text-[#1a1a19]">{row.label}</span>
                          {row.note && (
                            <span className="block text-[10.5px] text-[#9b9b99] mt-0.5">{row.note}</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right text-[#6b6b6a]">{formatCurrency(row.total)}</td>
                        <td className="px-4 py-2.5 text-right font-medium text-[#b3261e]">{formatCurrency(row.tenantCost)}</td>
                      </tr>
                    ))}
                    {/* Totals row */}
                    <tr className="bg-[#f7f6f3] border-t border-[#e8e7e4]">
                      <td className="px-4 py-2.5 font-semibold text-[#1a1a19]">Total</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-[#6b6b6a]">{formatCurrency(totalCharges)}</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-[#b3261e]">{formatCurrency(totalCharges)}</td>
                    </tr>
                  </tbody>
                </table>
              )}
            </div>

            {/* ── Refunds / Credits card ── */}
            <div className="bg-white border border-[#e8e7e4] rounded-[8px] overflow-hidden">
              <div className="px-4 py-3 border-b border-[#e8e7e4]">
                <h2 className="text-[13px] font-semibold text-[#1a1a19]">Refunds / Credits</h2>
              </div>
              <div className="divide-y divide-[#f0f0ee]">
                <div className="flex justify-between px-4 py-2.5 text-[12.5px]">
                  <span className="text-[#9b9b99]">Security deposit paid</span>
                  <span className="font-medium text-[#1a7a3a]">{formatCurrency(depositData.securityDeposit)}</span>
                </div>
                {depositData.petDeposit > 0 && (
                  <div className="flex justify-between px-4 py-2.5 text-[12.5px]">
                    <span className="text-[#9b9b99]">Pet deposit</span>
                    <span className="font-medium text-[#1a7a3a]">{formatCurrency(depositData.petDeposit)}</span>
                  </div>
                )}
                {depositData.keyDeposit > 0 && (
                  <div className="flex justify-between px-4 py-2.5 text-[12.5px]">
                    <span className="text-[#9b9b99]">Key deposit</span>
                    <span className="font-medium text-[#1a7a3a]">{formatCurrency(depositData.keyDeposit)}</span>
                  </div>
                )}
                <div className="flex justify-between px-4 py-2.5 text-[12.5px] bg-[#f7f6f3]">
                  <span className="font-semibold text-[#1a1a19]">Total credits</span>
                  <span className="font-semibold text-[#1a7a3a]">{formatCurrency(totalCredits)}</span>
                </div>
                {/* Net result: what the tenant actually gets back (or owes) */}
                <div className={`flex justify-between px-4 py-3 text-[13px] ${dueToTenant > 0 ? 'bg-[#e3f5e6]' : 'bg-[#fceae8]'}`}>
                  <span className="font-semibold text-[#1a1a19]">
                    {dueToTenant > 0 ? 'Balance due to tenant' : 'Balance owing landlord'}
                  </span>
                  <span className={`font-bold text-[15px] ${dueToTenant > 0 ? 'text-[#1a7a3a]' : 'text-[#b3261e]'}`}>
                    {formatCurrency(Math.abs(balance))}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ════════════════════════════════════
              RIGHT COLUMN
              ════════════════════════════════════ */}
          <div className="space-y-4">

            {/* ── Forwarding Address Confirmation ── */}
            <div className="bg-white border border-[#e8e7e4] rounded-[8px] overflow-hidden">
              <div className="px-4 py-3 border-b border-[#e8e7e4]">
                <h2 className="text-[13px] font-semibold text-[#1a1a19]">Forwarding Address</h2>
              </div>
              <div className="px-4 py-3 space-y-1">
                <p className="text-[13px] font-medium text-[#1a1a19]">{tenantData.tenantName}</p>
                <p className="text-[12px] text-[#6b6b6a]">{tenantData.forwardingAddress.street}</p>
                <p className="text-[12px] text-[#6b6b6a]">
                  {tenantData.forwardingAddress.city}, {tenantData.forwardingAddress.state} {tenantData.forwardingAddress.zip}
                </p>
                <p className="text-[10.5px] text-[#9b9b99] mt-2">
                  Deposit return will be mailed to this address.
                </p>
              </div>
            </div>

            {/* ── Compliance Check ── */}
            <div className={`border rounded-[8px] overflow-hidden transition-colors ${
              complianceChecked
                ? 'bg-[#e3f5e6] border-[#1a7a3a]/50'
                : 'bg-white border-[#e8e7e4]'
            }`}>
              <div className={`px-4 py-3 border-b ${complianceChecked ? 'border-[#1a7a3a]/20' : 'border-[#e8e7e4]'}`}>
                <h2 className="text-[13px] font-semibold text-[#1a1a19]">Compliance Check</h2>
              </div>
              <label className="flex items-start gap-3 px-4 py-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={complianceChecked}
                  onChange={e => setComplianceChecked(e.target.checked)}
                  className="mt-0.5 w-4 h-4 shrink-0 accent-[#1a7a3a]"
                />
                <span className="text-[12.5px] text-[#6b6b6a] leading-snug">
                  I confirm all charges reflect company-approved rates and this return is accurate and complete.
                </span>
              </label>
            </div>

            {/* ── Finalize & Generate PDF ── */}
            <button
              onClick={handleFinalize}
              disabled={!complianceChecked || generating}
              className="w-full py-3 text-[13px] font-semibold rounded-[8px] border transition-colors flex items-center justify-center gap-2 disabled:cursor-not-allowed"
              style={{
                background: complianceChecked ? '#1a7a3a' : '#f7f6f3',
                color: complianceChecked ? '#fff' : '#9b9b99',
                borderColor: complianceChecked ? '#1a7a3a' : '#e8e7e4',
              }}
            >
              {generating ? 'Generating PDF…' : 'Finalize & Generate PDF'}
            </button>

            {!complianceChecked && (
              <p className="text-[11px] text-[#9b9b99] text-center -mt-2">
                Check the compliance box above to enable
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
