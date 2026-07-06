'use client';

import { useRouter } from 'next/navigation';
import { useSession } from '@/context/SessionContext';
import { useTheme } from '@/context/ThemeContext';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { InspectionBadge } from '@/components/shared/InspectionBadge';
import { UtilityTag } from '@/components/shared/UtilityTag';
import { formatCurrency } from '@/lib/calculations';
import { computeDeadline, daysUntilDeadline } from '@/lib/deadline';
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
    <div className="min-h-screen bg-bg">
      {/* Header */}
      <div className="bg-surface border-b border-separator px-6 py-4">
        <div className="w-full flex items-center justify-between">
          <div>
            <h1 className="text-title2 text-app-text">
              {session.propertyName || 'Security Deposit Returns'}
            </h1>
            <p className="text-subhead text-secondary mt-0.5">
              {complete} of {total} complete · Uploaded {session.uploadDate}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Dark mode toggle — shared 36px icon-button style across all screens */}
            <button
              onClick={toggle}
              className="w-9 h-9 rounded-full bg-fill flex items-center justify-center text-base hover:brightness-95 dark:hover:brightness-110 transition-colors shrink-0"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            <button
              onClick={() => { clearSession(); router.push('/'); }}
              className="text-subhead text-secondary hover:text-app-text transition-colors"
            >
              Start new upload
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-3 h-1.5 bg-separator rounded-full overflow-hidden">
          <div
            className="h-full bg-success rounded-full transition-all duration-500"
            style={{ width: total > 0 ? `${(complete / total) * 100}%` : '0%' }}
          />
        </div>
      </div>

      {/* Content */}
      <div className="w-full px-6 py-6 space-y-1">
        {/* Section header — Obsidian style */}
        <p className="text-caption font-semibold text-secondary uppercase tracking-wider px-1 mb-2">
          Move-Outs · {pending} pending
        </p>

        {/* Grouped list card */}
        <div className="bg-surface rounded-lg overflow-hidden border border-separator shadow-card">
          {/* Table header */}
          <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_1.2fr_40px] gap-0 px-4 py-2.5 bg-surface-2 border-b border-separator">
            {['Tenant / Unit', 'Move-Out', 'Due Date', 'Days Left', 'Deposit', 'Utility', 'Inspection', ''].map((h, i) => (
              <span key={i} className="text-caption font-semibold text-secondary uppercase tracking-wider">{h}</span>
            ))}
          </div>

          {/* Rows */}
          {session.returns.map((r, i) => {
            const deadline = computeDeadline(r.tenantData.moveOutDate);
            const daysLeft = daysUntilDeadline(deadline);
            return (
              <div
                key={r.id}
                onClick={() => handleRowClick(r)}
                className={`grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_1.2fr_40px] gap-0 px-4 py-3.5 cursor-pointer hover:bg-fill transition-colors ${
                  i < session.returns.length - 1 ? 'border-b border-separator' : ''
                }`}
              >
                {/* Tenant */}
                <div className="flex flex-col justify-center">
                  <div className="flex items-center gap-2">
                    <span className="text-subhead font-medium text-app-text">{r.tenantData.tenantName}</span>
                    {r.tenantData.leaseBreak && (
                      <span className="text-[10px] font-semibold text-warning-fg bg-warning/12 px-1.5 py-0.5 rounded-full">
                        Lease Break
                      </span>
                    )}
                  </div>
                  <span className="text-caption text-secondary mt-0.5">Unit {r.tenantData.unit} · {formatCurrency(r.depositData.securityDeposit)} deposit</span>
                </div>

                {/* Move-Out */}
                <div className="flex items-center">
                  <span className="text-subhead text-app-text">{r.tenantData.moveOutDate}</span>
                </div>

                {/* Due Date */}
                <div className="flex items-center">
                  <span className="text-subhead text-app-text">
                    {deadline ? deadline.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                  </span>
                </div>

                {/* Days Left */}
                <div className="flex items-center">
                  {daysLeft !== null ? (
                    <span className={`font-medium px-2 py-0.5 rounded-full text-caption ${
                      daysLeft <= 3 ? 'bg-danger/12 text-danger-fg' :
                      daysLeft <= 7 ? 'bg-warning/12 text-warning-fg' :
                      'bg-fill text-secondary'
                    }`}>
                      {daysLeft}d left
                    </span>
                  ) : <span className="text-secondary">—</span>}
                </div>

                {/* Deposit */}
                <div className="flex items-center">
                  <span className="text-subhead font-medium text-app-text">{formatCurrency(r.depositData.securityDeposit)}</span>
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
