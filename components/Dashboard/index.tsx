'use client';

import { useRouter } from 'next/navigation';
import { useSession } from '@/context/SessionContext';
import { InspectionBadge } from '@/components/shared/InspectionBadge';
import { UtilityTag } from '@/components/shared/UtilityTag';
import { formatCurrency } from '@/lib/calculations';
import { formatDeadlineDate } from '@/lib/deadlineUtils';
import { DeadlinePill } from '@/components/shared/DeadlinePill';
import { TenantReturn } from '@/types';

// Status chip component — dot + label, color-coded by processing status.
// Not started = neutral gray, In progress = blue, Complete = green.
function StatusChip({ status }: { status: TenantReturn['processingStatus'] }) {
  if (status === 'complete') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-[#e3f5e6] text-[#1a7a3a]">
        <span className="w-1.5 h-1.5 rounded-full bg-[#1a7a3a] shrink-0" />
        Complete
      </span>
    );
  }
  if (status === 'in_progress') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-[#e6efff] text-[#1858b8]">
        <span className="w-1.5 h-1.5 rounded-full bg-[#1858b8] shrink-0" />
        In progress
      </span>
    );
  }
  // Default: not_started
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-[#f1f1ef] text-[#555555]">
      <span className="w-1.5 h-1.5 rounded-full bg-[#555555] shrink-0" />
      Not started
    </span>
  );
}

export function Dashboard() {
  const { session, clearSession } = useSession();
  const router = useRouter();

  if (!session) {
    if (typeof window !== 'undefined') router.replace('/');
    return null;
  }

  const total = session.returns.length;
  const complete = session.returns.filter(r => r.processingStatus === 'complete').length;

  function handleRowClick(r: TenantReturn) {
    router.push(`/return/${r.id}`);
  }

  return (
    // Page background: AGM secondary surface (#fbfbfa)
    <div className="min-h-screen bg-[#fbfbfa]">

      {/* ── Top bar ── */}
      <div className="bg-white border-b border-[#e8e7e4] px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            {/* Title uses Source Serif 4 — the AGM brand heading font */}
            <h1
              className="text-xl font-semibold text-[#1a1a19]"
              style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}
            >
              {session.propertyName || 'Security Deposit Returns'}
            </h1>
            <p className="text-xs text-[#6b6b6a] mt-0.5">
              {complete} of {total} complete · Uploaded {session.uploadDate}
            </p>
          </div>
          {/* "Start new upload" — secondary action, outlined style */}
          <button
            onClick={() => { clearSession(); router.push('/'); }}
            className="border border-[#e8e7e4] text-[#1a1a19] text-sm px-3 py-1.5 rounded-[6px] hover:bg-[#f7f6f3] transition-colors"
          >
            Start new upload
          </button>
        </div>
      </div>

      {/* ── Progress bar ── */}
      <div className="bg-white border-b border-[#e8e7e4] px-6 py-2">
        <div className="max-w-6xl mx-auto">
          <div className="h-1.5 bg-[#f1f1ef] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#1a7a3a] rounded-full transition-all"
              style={{ width: total > 0 ? `${(complete / total) * 100}%` : '0%' }}
            />
          </div>
        </div>
      </div>

      {/* ── Tenant table ── */}
      <div className="max-w-6xl mx-auto px-6 py-6">
        {/* Table wrapper: white card with AGM border */}
        <div className="bg-white border border-[#e8e7e4] rounded-[6px] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              {/* Header row: subtle fill + small uppercase labels */}
              <tr className="bg-[#f7f6f3]">
                <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-[#9b9b99]">Tenant</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-[#9b9b99]">Unit</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-[#9b9b99]">Move-Out</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-[#9b9b99]">Due Date</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-[#9b9b99]">Days Left</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-[#9b9b99]">Deposit</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-[#9b9b99]">Utility</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-[#9b9b99]">Inspection</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-[#9b9b99]">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {session.returns.map((r) => (
                <tr
                  key={r.id}
                  // Row separator + hover state using AGM tokens
                  className="border-b border-[#eeeeec] hover:bg-[#f1f1ef] cursor-pointer transition-colors"
                  onClick={() => handleRowClick(r)}
                >
                  <td className="px-4 py-3">
                    {/* Primary tenant name: dark + medium weight */}
                    <span className="font-medium text-[#1a1a19] text-sm">{r.tenantData.tenantName}</span>
                    {r.tenantData.coTenant && (
                      <span className="text-[#9b9b99] text-xs ml-1">+ {r.tenantData.coTenant}</span>
                    )}
                    {r.tenantData.leaseBreak && (
                      <span className="ml-2 text-xs text-[#8b6a00] font-medium bg-[#fdf3da] px-1.5 py-0.5 rounded">
                        Lease Break
                      </span>
                    )}
                  </td>
                  {/* Secondary text in rows: muted */}
                  <td className="px-4 py-3 text-[#6b6b6a] text-xs">{r.tenantData.unit}</td>
                  <td className="px-4 py-3 text-[#6b6b6a] text-xs">{r.tenantData.moveOutDate}</td>
                  {/* Due Date: 21-day deadline per California Civil Code §1950.5 */}
                  <td className="px-4 py-3 text-[#6b6b6a] text-xs">{formatDeadlineDate(r.tenantData.moveOutDate)}</td>
                  {/* Days Left: color-coded urgency pill */}
                  <td className="px-4 py-3"><DeadlinePill moveOutDate={r.tenantData.moveOutDate} /></td>
                  <td className="px-4 py-3 text-[#6b6b6a] text-xs">{formatCurrency(r.depositData.securityDeposit)}</td>
                  <td className="px-4 py-3"><UtilityTag type={r.utilityData.utilityType} /></td>
                  <td className="px-4 py-3"><InspectionBadge status={r.tenantData.inspectionStatus} /></td>
                  <td className="px-4 py-3"><StatusChip status={r.processingStatus} /></td>
                  <td className="px-4 py-3 text-right">
                    {/* Action link: AGM accent blue */}
                    <span className="text-[#2383e2] text-xs font-medium">
                      {r.processingStatus === 'complete' ? 'View →' : 'Open →'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
