'use client';

import { useSession } from '@/context/SessionContext';
import { useAdminSettings } from '@/context/AdminSettingsContext';
import { effectiveDeadlineDays } from '@/lib/adminSettings';
import { ProcessingStatus } from '@/types';
import { card } from './adminStyles';

// A single number tile (Total / Complete / In progress / Not started).
function StatCard({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className={card}>
      <div className={`text-3xl font-semibold ${accent}`}>{value}</div>
      <div className="mt-1 text-sm text-gray-500">{label}</div>
    </div>
  );
}

// Reproduces the Overview/progress dashboard from Report Studio: KPI stat cards
// plus a segmented progress bar. It reads the current upload session, so it
// reflects whatever batch of tenants is loaded right now.
export function OverviewTab() {
  const { session } = useSession();
  const { settings } = useAdminSettings();

  // No upload yet — show a friendly empty state instead of a wall of zeros.
  if (!session || session.returns.length === 0) {
    return (
      <div className={card}>
        <p className="text-sm text-gray-600">
          No returns loaded yet. Upload an AppFolio export from the home screen and the progress
          summary will appear here.
        </p>
      </div>
    );
  }

  const returns = session.returns;
  const total = returns.length;
  // count() tallies how many returns are in a given status.
  const count = (s: ProcessingStatus) => returns.filter(r => r.processingStatus === s).length;
  const complete = count('complete');
  const inProgress = count('in_progress');
  const notStarted = count('not_started');

  // Helper to turn a count into a percentage width for the segmented bar.
  const pct = (n: number) => (total > 0 ? (n / total) * 100 : 0);

  return (
    <div className="space-y-6">
      {/* Header line: what's loaded + the active deadline */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900">
          {session.propertyName || 'Security Deposit Returns'}
        </h2>
        <p className="mt-0.5 text-sm text-gray-500">
          {total} return{total === 1 ? '' : 's'} · uploaded {session.uploadDate} ·{' '}
          {effectiveDeadlineDays(settings)}-day return deadline
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total returns" value={total} accent="text-gray-900" />
        <StatCard label="Complete" value={complete} accent="text-green-600" />
        <StatCard label="In progress" value={inProgress} accent="text-yellow-600" />
        <StatCard label="Not started" value={notStarted} accent="text-gray-400" />
      </div>

      {/* Segmented progress bar: green = complete, yellow = in progress, gray = not started */}
      <div className={card}>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-700">All returns</span>
          <span className="text-sm text-gray-500">
            {complete} of {total} complete
          </span>
        </div>
        <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
          <div className="h-full bg-green-500" style={{ width: `${pct(complete)}%` }} />
          <div className="h-full bg-yellow-400" style={{ width: `${pct(inProgress)}%` }} />
        </div>
        {/* Legend */}
        <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-green-500" /> Complete
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-yellow-400" /> In progress
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-gray-200" /> Not started
          </span>
        </div>
      </div>
    </div>
  );
}
