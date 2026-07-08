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
import { Sun, Moon, Building2, ChevronRight, Plus } from 'lucide-react';
import { BrandMark } from '@/components/shared/BrandMark';

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

  function handleRowClick(r: TenantReturn) {
    router.push(`/return/${r.id}`);
  }

  // Group move-outs by property — an upload can span several properties.
  const groups: { property: string; rows: TenantReturn[] }[] = [];
  const groupIndex = new Map<string, number>();
  for (const r of session.returns) {
    const prop = r.propertyName || session.propertyName || 'Unassigned';
    if (!groupIndex.has(prop)) {
      groupIndex.set(prop, groups.length);
      groups.push({ property: prop, rows: [] });
    }
    groups[groupIndex.get(prop)!].rows.push(r);
  }
  const multiProperty = groups.length > 1;
  const HEADERS = ['Tenant / Unit', 'Move-Out', 'Due Date', 'Days Left', 'Deposit', 'Utility', 'Inspection', 'Status'];

  return (
    <div className="min-h-screen bg-bg">
      {/* Header */}
      <div className="bg-surface border-b border-separator px-6 py-4">
        <div className="w-full flex items-center justify-between">
          {/* AGM brand tile persists as chrome next to the property title. */}
          <div className="flex items-center gap-3">
            <BrandMark size={36} />
            <div>
              <h1 className="text-title font-serif text-app-text">
                {session.propertyName || 'Security Deposit Returns'}
              </h1>
              <p className="text-subhead text-secondary mt-0.5">
                {complete} of {total} complete · Uploaded {session.uploadDate}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Dark mode toggle — shared 36px icon-button style across all screens */}
            <button
              onClick={toggle}
              className="w-9 h-9 rounded-lg bg-fill flex items-center justify-center text-secondary hover:text-app-text hover:brightness-95 dark:hover:brightness-110 transition-colors shrink-0"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <button
              onClick={() => { clearSession(); router.push('/'); }}
              className="inline-flex items-center gap-1.5 text-subhead text-secondary hover:text-app-text transition-colors"
            >
              <Plus size={15} />
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

      {/* Content — one card per property group */}
      <div className="w-full px-6 py-6 space-y-6">
        {groups.map(group => {
          const groupPending = group.rows.filter(r => r.processingStatus !== 'complete').length;
          return (
            <div key={group.property} className="space-y-1">
              {/* Group header: property name only when the upload spans several. */}
              <p className="flex items-center gap-1.5 text-caption font-semibold text-secondary uppercase tracking-wider px-1 mb-2">
                {multiProperty && <Building2 size={13} className="text-tertiary" />}
                {multiProperty ? `${group.property} · ` : ''}{group.rows.length} move-out{group.rows.length === 1 ? '' : 's'} · {groupPending} pending
              </p>

              <div className="bg-surface rounded-lg overflow-hidden border border-separator shadow-card">
                {/* Table header */}
                <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_1.2fr_112px] gap-0 px-4 py-2.5 bg-surface-2 border-b border-separator">
                  {HEADERS.map((h, i) => (
                    <span key={i} className="text-caption font-semibold text-secondary uppercase tracking-wider">{h}</span>
                  ))}
                </div>

                {/* Rows */}
                {group.rows.map((r, i) => (
                  <TenantRow
                    key={r.id}
                    r={r}
                    last={i === group.rows.length - 1}
                    onClick={() => handleRowClick(r)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Consistent date format across the dashboard, e.g. "Jul 7, 2026".
// Accepts an ISO "YYYY-MM-DD" string (parsed as local midnight so the day
// doesn't shift by timezone) or a Date (used directly).
function fmtDate(value: string | Date): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value + 'T00:00:00') : value;
  if (Number.isNaN(d.getTime())) return typeof value === 'string' ? value : '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// One move-out row in the dashboard table.
function TenantRow({ r, last, onClick }: { r: TenantReturn; last: boolean; onClick: () => void }) {
  const deadline = computeDeadline(r.tenantData.moveOutDate);
  const daysLeft = daysUntilDeadline(deadline);
  return (
    <div
      onClick={onClick}
      className={`grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_1.2fr_112px] gap-0 px-4 py-3.5 cursor-pointer hover:bg-fill transition-colors ${
        last ? '' : 'border-b border-separator'
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
        <span className="text-subhead text-app-text">{fmtDate(r.tenantData.moveOutDate)}</span>
      </div>

      {/* Due Date */}
      <div className="flex items-center">
        <span className="text-subhead text-app-text">
          {deadline ? fmtDate(deadline) : '—'}
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

      {/* Status + open-affordance chevron (brightens on row hover) */}
      <div className="flex items-center justify-between gap-1 group">
        <StatusBadge status={r.processingStatus} />
        <ChevronRight size={16} className="text-tertiary shrink-0" />
      </div>
    </div>
  );
}
