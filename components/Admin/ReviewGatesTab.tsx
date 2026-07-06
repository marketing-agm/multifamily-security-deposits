'use client';

import { useState } from 'react';
import { ReviewGateLevel } from '@/types';
import { useAdminSettings } from '@/context/AdminSettingsContext';
import { useFlash } from './useFlash';
import { card, btnPrimary } from './adminStyles';

// The three gate levels, ported from Report Studio's Review Gates tab.
// Report Studio had one group per division (Commercial / Multifamily); this
// app is multifamily-only, so there's a single group.
const LEVELS: { value: ReviewGateLevel; label: string; hint: string }[] = [
  { value: 'off', label: 'Off', hint: 'No review step — the PDF can be generated anytime' },
  { value: 'soft', label: 'Soft', hint: 'Show the compliance review, but never block the PDF' },
  { value: 'hard', label: 'Hard', hint: 'Lock the PDF until the return has been reviewed' },
];

export function ReviewGatesTab() {
  const { settings, updateSettings } = useAdminSettings();
  // Local copy of the selected level while the user is choosing, before Save.
  const [gate, setGate] = useState<ReviewGateLevel>(settings.reviewGate);
  const [saving, setSaving] = useState(false);
  const [msg, flash] = useFlash();

  function save() {
    setSaving(true);
    updateSettings({ reviewGate: gate });
    setSaving(false);
    flash('Saved ✓');
  }

  return (
    <div className={card} style={{ maxWidth: 560 }}>
      <p className="mb-5 text-sm text-gray-600">
        Controls how strict the review step is before a tenant&apos;s Checkout Report PDF can be
        generated. Use &ldquo;Hard&rdquo; if returns must be signed off before they go out.
      </p>

      <div className="mb-2 text-sm font-bold capitalize text-gray-900">Security deposit returns</div>
      {LEVELS.map(l => (
        <label
          key={l.value}
          className="mb-1.5 flex cursor-pointer items-center gap-2 text-sm text-gray-800"
        >
          <input
            type="radio"
            name="review-gate"
            checked={gate === l.value}
            onChange={() => setGate(l.value)}
          />
          <strong>{l.label}</strong>
          <span className="text-gray-500">— {l.hint}</span>
        </label>
      ))}

      <div className="mt-5 flex items-center gap-3">
        <button onClick={save} disabled={saving} className={btnPrimary}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        {msg && <span className="text-sm text-gray-500">{msg}</span>}
      </div>
    </div>
  );
}
