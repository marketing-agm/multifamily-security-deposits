'use client';

import { useRouter } from 'next/navigation';
import { useSession } from '@/context/SessionContext';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { InspectionBadge } from '@/components/shared/InspectionBadge';
import { UtilityTag } from '@/components/shared/UtilityTag';
import { formatCurrency } from '@/lib/calculations';
import { TenantReturn } from '@/types';

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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">{session.propertyName || 'Security Deposit Returns'}</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {complete} of {total} complete · Uploaded {session.uploadDate}
            </p>
          </div>
          <button
            onClick={() => { clearSession(); router.push('/'); }}
            className="text-sm text-gray-500 hover:text-gray-700 underline"
          >
            Start new upload
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-2">
        <div className="max-w-6xl mx-auto">
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all"
              style={{ width: total > 0 ? `${(complete / total) * 100}%` : '0%' }}
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="max-w-6xl mx-auto px-6 py-6">

        {/* Property category header — shows the property name as a section label above its tenants */}
        <div className="flex items-center gap-3 mb-3">
          <div className="text-[11px] font-semibold text-[#9b9b99] uppercase tracking-[0.06em]">Property</div>
          <div className="flex items-center gap-2 px-3 py-1 bg-white border border-[#e8e7e4] rounded-[6px]">
            <span className="text-[13px]">🏢</span>
            <span className="text-[13px] font-semibold text-[#1a1a19]">{session.propertyName || 'Unknown property'}</span>
            <span className="text-[11px] text-[#9b9b99]">· {session.returns.length} move-out{session.returns.length !== 1 ? 's' : ''}</span>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Tenant</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Unit</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Move-Out</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Deposit</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Utility</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Inspection</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {session.returns.map((r, i) => (
                <tr
                  key={r.id}
                  className={`border-b border-gray-50 hover:bg-blue-50 cursor-pointer transition-colors ${i % 2 === 0 ? '' : 'bg-gray-50/30'}`}
                  onClick={() => handleRowClick(r)}
                >
                  <td className="px-4 py-3">
                    <span className="font-medium text-gray-900">{r.tenantData.tenantName}</span>
                    {r.tenantData.coTenant && (
                      <span className="text-gray-400 ml-1">+ {r.tenantData.coTenant}</span>
                    )}
                    {/* Lease break is highlighted in red — it means extra rent may be owed */}
                    {r.tenantData.leaseBreak && (
                      <span className="ml-2 text-xs text-[#b3261e] font-medium bg-[#fceae8] px-1.5 py-0.5 rounded">
                        Lease Break
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{r.tenantData.unit}</td>
                  <td className="px-4 py-3 text-gray-700">{r.tenantData.moveOutDate}</td>
                  <td className="px-4 py-3 text-gray-700">{formatCurrency(r.depositData.securityDeposit)}</td>
                  <td className="px-4 py-3"><UtilityTag type={r.utilityData.utilityType} /></td>
                  <td className="px-4 py-3"><InspectionBadge status={r.tenantData.inspectionStatus} /></td>
                  <td className="px-4 py-3"><StatusBadge status={r.processingStatus} /></td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-blue-600 text-xs font-medium">
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
