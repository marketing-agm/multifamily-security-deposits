'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/context/SessionContext';
import { formatCurrency } from '@/lib/calculations';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { card, btnDanger, input, th, td } from './adminStyles';

// Reproduces Report Studio's "All Reports" tab: a searchable, filterable table
// of every record, with a live "N of M" count and per-row actions. Here the
// records are the tenant returns in the current upload session.
export function ReturnsTab() {
  const { session, clearSession } = useSession();
  const router = useRouter();
  const [query, setQuery] = useState('');

  const allReturns = session?.returns ?? [];

  // Case-insensitive filter across tenant name, unit, and move-out date.
  const q = query.trim().toLowerCase();
  const filtered = q
    ? allReturns.filter(r => {
        const haystack = `${r.tenantData.tenantName} ${r.tenantData.coTenant} ${r.tenantData.unit} ${r.tenantData.moveOutDate}`.toLowerCase();
        return haystack.includes(q);
      })
    : allReturns;

  function handleClearAll() {
    // Browser-native confirm() — a simple yes/no dialog. Deleting data is
    // destructive, so we make the user confirm first (same pattern Report Studio uses).
    if (confirm('Clear ALL uploaded returns? This cannot be undone.')) {
      clearSession();
    }
  }

  if (allReturns.length === 0) {
    return (
      <div className={card}>
        <p className="text-sm text-gray-600">
          No returns loaded yet. Upload an AppFolio export from the home screen to see them here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search box with a clear "×" button and a live count */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1" style={{ maxWidth: 360 }}>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search tenant, unit, or move-out date…"
            className={input}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>
        <span className="text-sm text-gray-500">
          {filtered.length} of {allReturns.length} returns
        </span>
      </div>

      {/* The table */}
      <div className={`${card} overflow-x-auto p-0`}>
        <table className="w-full">
          <thead>
            <tr>
              <th className={th}>Tenant</th>
              <th className={th}>Unit</th>
              <th className={th}>Move-Out</th>
              <th className={th}>Deposit</th>
              <th className={th}>Status</th>
              <th className={th} />
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className={td}>
                  <span className="font-medium text-gray-900">{r.tenantData.tenantName}</span>
                  {r.tenantData.coTenant && (
                    <span className="ml-1 text-gray-400">+ {r.tenantData.coTenant}</span>
                  )}
                </td>
                <td className={td}>{r.tenantData.unit}</td>
                <td className={td}>{r.tenantData.moveOutDate}</td>
                <td className={td}>{formatCurrency(r.depositData.securityDeposit)}</td>
                <td className={td}>
                  <StatusBadge status={r.processingStatus} />
                </td>
                <td className={`${td} text-right`}>
                  <button
                    onClick={() => router.push(`/return/${r.id}`)}
                    className="text-xs font-medium text-blue-600 hover:underline"
                  >
                    Open →
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Danger zone: wipe the whole session */}
      <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3">
        <div className="text-sm text-red-700">
          Clear all uploaded returns from this browser. You&apos;ll start fresh with a new upload.
        </div>
        <button onClick={handleClearAll} className={btnDanger}>
          Clear all data
        </button>
      </div>
    </div>
  );
}
