'use client';

import { useRouter } from 'next/navigation';
import { useSession } from '@/context/SessionContext';
import { useTheme } from '@/context/ThemeContext';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { InspectionBadge } from '@/components/shared/InspectionBadge';
import { UtilityTag } from '@/components/shared/UtilityTag';
import { formatCurrency } from '@/lib/calculations';
import { TenantReturn } from '@/types';

export function Dashboard() {
  const { session, clearSession } = useSession();
  const { theme, toggle } = useTheme();
  const router = useRouter();

  if (!session) {
    if (typeof window !== 'undefined') router.replace('/');
    return null;
  }

  const total = session.returns.length;
  const complete = session.returns.filter(r => r.processingStatus === 'complete').length;
  const pending = total - complete;

  function handleRowClick(r: TenantReturn) {
    router.push(`/return/${r.id}`);
  }

  return (
    <div className="min-h-screen bg-[#f2f2f7] dark:bg-[#1c1c1e]">
      {/* Header */}
      <div className="bg-white dark:bg-[#2c2c2e] border-b border-[#e5e5ea] dark:border-[#38383a] px-6 py-4">
        <div className="w-full flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-[#1c1c1e] dark:text-white">
              {session.propertyName || 'Security Deposit Returns'}
            </h1>
            <p className="text-sm text-[#8e8e93] mt-0.5">
              {complete} of {total} complete · Uploaded {session.uploadDate}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Dark mode toggle */}
            <button
              onClick={toggle}
              className="w-9 h-9 rounded-full bg-[#f2f2f7] dark:bg-[#3a3a3c] flex items-center justify-center text-base hover:bg-[#e5e5ea] dark:hover:bg-[#48484a] transition-colors"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            <button
              onClick={() => { clearSession(); router.push('/'); }}
              className="text-sm text-[#8e8e93] hover:text-[#1c1c1e] dark:hover:text-white transition-colors"
            >
              Start new upload
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-3 h-1.5 bg-[#e5e5ea] dark:bg-[#38383a] rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 rounded-full transition-all duration-500"
            style={{ width: total > 0 ? `${(complete / total) * 100}%` : '0%' }}
          />
        </div>
      </div>

      {/* Content */}
      <div className="w-full px-6 py-6 space-y-1">
        {/* Section header — Obsidian style */}
        <p className="text-xs font-semibold text-[#8e8e93] uppercase tracking-wider px-1 mb-2">
          Move-Outs · {pending} pending
        </p>

        {/* Grouped list card */}
        <div className="bg-white dark:bg-[#2c2c2e] rounded-2xl overflow-hidden border border-[#e5e5ea] dark:border-[#38383a]">
          {/* Table header */}
          <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_1.2fr_40px] gap-0 px-4 py-2.5 bg-[#f8f8f8] dark:bg-[#3a3a3c] border-b border-[#e5e5ea] dark:border-[#38383a]">
            {['Tenant / Unit', 'Move-Out', 'Due Date', 'Days Left', 'Deposit', 'Utility', 'Inspection', ''].map((h, i) => (
              <span key={i} className="text-xs font-semibold text-[#8e8e93] uppercase tracking-wider">{h}</span>
            ))}
          </div>

          {/* Rows */}
          {session.returns.map((r, i) => {
            const moveOut = r.tenantData.moveOutDate ? new Date(r.tenantData.moveOutDate) : null;
            const deadline = moveOut ? new Date(moveOut.getTime() + 21 * 24 * 60 * 60 * 1000) : null;
            const daysLeft = deadline ? Math.ceil((deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
            const urgency = daysLeft !== null ? (daysLeft <= 3 ? 'text-red-600 dark:text-red-400' : daysLeft <= 7 ? 'text-orange-500 dark:text-orange-400' : 'text-[#8e8e93]') : 'text-[#8e8e93]';

            return (
              <div
                key={r.id}
                onClick={() => handleRowClick(r)}
                className={`grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_1.2fr_40px] gap-0 px-4 py-3.5 cursor-pointer hover:bg-[#f2f2f7] dark:hover:bg-[#3a3a3c] transition-colors ${
                  i < session.returns.length - 1 ? 'border-b border-[#e5e5ea] dark:border-[#38383a]' : ''
                }`}
              >
                {/* Tenant */}
                <div className="flex flex-col justify-center">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[#1c1c1e] dark:text-white">{r.tenantData.tenantName}</span>
                    {r.tenantData.leaseBreak && (
                      <span className="text-[10px] font-semibold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/30 px-1.5 py-0.5 rounded-full">
                        Lease Break
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-[#8e8e93] mt-0.5">Unit {r.tenantData.unit} · {formatCurrency(r.depositData.securityDeposit)} deposit</span>
                </div>

                {/* Move-Out */}
                <div className="flex items-center">
                  <span className="text-sm text-[#1c1c1e] dark:text-[#ebebf5]">{r.tenantData.moveOutDate}</span>
                </div>

                {/* Due Date */}
                <div className="flex items-center">
                  <span className="text-sm text-[#1c1c1e] dark:text-[#ebebf5]">
                    {deadline ? deadline.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                  </span>
                </div>

                {/* Days Left */}
                <div className="flex items-center">
                  {daysLeft !== null ? (
                    <span className={`text-sm font-medium px-2 py-0.5 rounded-full text-xs ${
                      daysLeft <= 3 ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' :
                      daysLeft <= 7 ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400' :
                      'bg-[#f2f2f7] dark:bg-[#3a3a3c] text-[#8e8e93]'
                    }`}>
                      {daysLeft}d left
                    </span>
                  ) : <span className="text-[#8e8e93]">—</span>}
                </div>

                {/* Deposit */}
                <div className="flex items-center">
                  <span className="text-sm font-medium text-[#1c1c1e] dark:text-[#ebebf5]">{formatCurrency(r.depositData.securityDeposit)}</span>
                </div>

                {/* Utility */}
                <div className="flex items-center">
                  <UtilityTag type={r.utilityData.utilityType} />
                </div>

                {/* Inspection */}
                <div className="flex items-center">
                  <InspectionBadge status={r.tenantData.inspectionStatus} />
                </div>

                {/* Chevron */}
                <div className="flex items-center justify-end">
                  <StatusBadge status={r.processingStatus} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
