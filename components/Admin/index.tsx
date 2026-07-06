'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { OverviewTab } from './OverviewTab';
import { DeadlineTab } from './DeadlineTab';
import { ReviewGatesTab } from './ReviewGatesTab';
import { DefaultChargesTab } from './DefaultChargesTab';
import { ReturnsTab } from './ReturnsTab';

// The tab definitions. Each has an id (used to know which one is active) and a
// label (what the user sees). This mirrors Report Studio's admin panel, which
// drove its tab bar off an array exactly like this.
const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'deadline', label: 'Deadline' },
  { id: 'review', label: 'Review Gates' },
  { id: 'charges', label: 'Default Charges' },
  { id: 'returns', label: 'Returns' },
] as const;

// A TypeScript union of the allowed tab ids ('overview' | 'deadline' | ...).
// It just stops us from setting the active tab to a name that doesn't exist.
type TabId = (typeof TABS)[number]['id'];

export function AdminPanel() {
  // Which tab is currently showing. Starts on Overview.
  const [tab, setTab] = useState<TabId>('overview');
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header — matches the white header bar used on every other screen */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Admin Settings</h1>
            <p className="text-sm text-gray-500 mt-0.5">Manage deadlines, review rules, and defaults</p>
          </div>
          <button
            onClick={() => router.push('/dashboard')}
            className="text-sm text-gray-500 hover:text-gray-700 underline"
          >
            ← Back to dashboard
          </button>
        </div>
      </div>

      {/* Tab bar — active tab gets a dark underline (Report Studio's pattern) */}
      <div className="bg-white border-b border-gray-200 px-6">
        <div className="max-w-6xl mx-auto flex">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-3.5 text-sm transition-colors border-b-2 -mb-px ${
                tab === t.id
                  ? 'border-gray-900 font-semibold text-gray-900'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="max-w-6xl mx-auto px-6 py-7">
        {tab === 'overview' && <OverviewTab />}
        {tab === 'deadline' && <DeadlineTab />}
        {tab === 'review' && <ReviewGatesTab />}
        {tab === 'charges' && <DefaultChargesTab />}
        {tab === 'returns' && <ReturnsTab />}
      </div>
    </div>
  );
}
