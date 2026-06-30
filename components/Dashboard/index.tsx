'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/context/SessionContext';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { InspectionBadge } from '@/components/shared/InspectionBadge';
import { UtilityTag } from '@/components/shared/UtilityTag';
import { formatCurrency } from '@/lib/calculations';
import { TenantReturn } from '@/types';

// How many tenant rows to show at once before pagination
const PAGE_SIZE = 10;

export function Dashboard() {
  const { session, clearSession } = useSession();
  const router = useRouter();
  // pageStart tracks which tenant row is first visible (for prev/next navigation)
  const [pageStart, setPageStart] = useState(0);

  if (!session) {
    if (typeof window !== 'undefined') router.replace('/');
    return null;
  }

  const total = session.returns.length;
  const complete = session.returns.filter(r => r.processingStatus === 'complete').length;
  const pageEnd = Math.min(pageStart + PAGE_SIZE, total);
  const visibleReturns = session.returns.slice(pageStart, pageEnd);

  function handleRowClick(r: TenantReturn) {
    router.push(`/return/${r.id}`);
  }

  function goToPrev() {
    setPageStart(s => Math.max(0, s - PAGE_SIZE));
  }

  function goToNext() {
    setPageStart(s => Math.min(s + PAGE_SIZE, total - 1));
  }

  return (
    <div className="min-h-screen bg-[#f5f5f3]">
      {/* Header */}
      <div className="bg-white border-b border-[#e8e7e4] px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Property name styled as a labeled button to distinguish it from plain text */}
            <button
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#e8e7e4] bg-[#f5f5f3] hover:bg-[#eeeeed] transition-colors text-sm font-semibold text-[#1a1a19]"
              title="Current property"
            >
              🏢 {session.propertyName || 'Unknown property'} <span className="text-[#9b9b99] text-xs">▾</span>
            </button>
            <span className="text-sm text-[#9b9b99]">
              {complete} of {total} complete · Uploaded {session.uploadDate}
            </span>
          </div>
          <button
            onClick={() => { clearSession(); router.push('/'); }}
            className="text-sm text-[#9b9b99] hover:text-[#1a1a19] underline transition-colors"
          >
            Start new upload
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="bg-white border-b border-[#e8e7e4] px-6 py-2">
        <div className="max-w-6xl mx-auto">
          <div className="h-1.5 bg-[#e8e7e4] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#1a7a3a] rounded-full transition-all"
              style={{ width: total > 0 ? `${(complete / total) * 100}%` : '0%' }}
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="max-w-6xl mx-auto px-6 py-6">
        <div className="bg-white rounded-xl shadow-sm border border-[#e8e7e4] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#e8e7e4] bg-[#f5f5f3]">
                <th className="text-left px-4 py-3 font-medium text-[#9b9b99]">Tenant</th>
                <th className="text-left px-4 py-3 font-medium text-[#9b9b99]">Unit</th>
                <th className="text-left px-4 py-3 font-medium text-[#9b9b99]">Move-Out</th>
                <th className="text-left px-4 py-3 font-medium text-[#9b9b99]">Deposit</th>
                <th className="text-left px-4 py-3 font-medium text-[#9b9b99]">Utility</th>
                <th className="text-left px-4 py-3 font-medium text-[#9b9b99]">Inspection</th>
                <th className="text-left px-4 py-3 font-medium text-[#9b9b99]">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {visibleReturns.map((r, i) => (
                <tr
                  key={r.id}
                  className={`border-b border-[#f5f5f3] hover:bg-blue-50 cursor-pointer transition-colors ${
                    i % 2 === 0 ? '' : 'bg-[#f5f5f3]/40'
                  }`}
                  onClick={() => handleRowClick(r)}
                >
                  <td className="px-4 py-3">
                    <span className="font-medium text-[#1a1a19]">{r.tenantData.tenantName}</span>
                    {r.tenantData.coTenant && (
                      <span className="text-[#9b9b99] ml-1">+ {r.tenantData.coTenant}</span>
                    )}
                    {r.tenantData.leaseBreak && (
                      <span className="ml-2 text-xs text-[#8b6a00] font-medium bg-amber-50 px-1.5 py-0.5 rounded">
                        Lease Break
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[#1a1a19]">{r.tenantData.unit}</td>
                  <td className="px-4 py-3 text-[#9b9b99]">{r.tenantData.moveOutDate}</td>
                  <td className="px-4 py-3 text-[#1a1a19]">{formatCurrency(r.depositData.securityDeposit)}</td>
                  <td className="px-4 py-3"><UtilityTag type={r.utilityData.utilityType} /></td>
                  <td className="px-4 py-3"><InspectionBadge status={r.tenantData.inspectionStatus} /></td>
                  <td className="px-4 py-3"><StatusBadge status={r.processingStatus} /></td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-[#2383e2] text-xs font-medium">
                      {r.processingStatus === 'complete' ? 'View →' : 'Open →'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Prev / next pagination — visible when there are more than PAGE_SIZE tenants */}
          {total > PAGE_SIZE && (
            <div className="px-4 py-3 border-t border-[#e8e7e4] flex items-center justify-between bg-[#f5f5f3]">
              <span className="text-xs text-[#9b9b99]">
                Showing {pageStart + 1}–{pageEnd} of {total}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={goToPrev}
                  disabled={pageStart === 0}
                  className="px-3 py-1.5 text-xs border border-[#e8e7e4] rounded-lg text-[#1a1a19] hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  ← Prev
                </button>
                <button
                  onClick={goToNext}
                  disabled={pageEnd >= total}
                  className="px-3 py-1.5 text-xs border border-[#e8e7e4] rounded-lg text-[#1a1a19] hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
