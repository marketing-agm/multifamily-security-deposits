'use client';

import { useState } from 'react';
import { useAdminSettings } from '@/context/AdminSettingsContext';
import { STATUTORY_DEADLINE_DAYS } from '@/lib/adminSettings';
import { useFlash } from './useFlash';
import { card, btnPrimary, input, fieldLabel, fieldHint } from './adminStyles';

// Reproduces Report Studio's "Reporting Period" auto/override pattern:
// a read-only value with an "Auto" badge + an Override button, which swaps to
// an editable field with a "back to automatic" link. Here it controls the
// deposit-return deadline (California = 21 days from move-out).
export function DeadlineTab() {
  const { settings, updateSettings } = useAdminSettings();

  // "override mode" = the user has chosen to type a custom number of days.
  // We seed it from the saved setting so re-opening the tab shows their choice.
  const [overrideMode, setOverrideMode] = useState(!settings.deadlineDaysIsAuto);
  const [overrideValue, setOverrideValue] = useState(String(settings.deadlineDays));
  const [saving, setSaving] = useState(false);
  const [msg, flash] = useFlash();

  function enableOverride() {
    setOverrideMode(true);
    // Pre-fill with whatever is currently in effect, so they edit from a real number.
    setOverrideValue(String(settings.deadlineDays));
  }

  function clearOverride() {
    setOverrideMode(false);
    setOverrideValue(String(STATUTORY_DEADLINE_DAYS));
  }

  function save() {
    setSaving(true);
    if (overrideMode) {
      // Number(...) turns the text from the input into an actual number.
      const days = Number(overrideValue);
      // Guard against blank / non-numeric / nonsense values.
      if (!Number.isFinite(days) || days <= 0) {
        setSaving(false);
        flash('Enter a number of days greater than 0');
        return;
      }
      updateSettings({ deadlineDays: days, deadlineDaysIsAuto: false });
    } else {
      // Auto mode: fall back to the statutory value.
      updateSettings({ deadlineDays: STATUTORY_DEADLINE_DAYS, deadlineDaysIsAuto: true });
    }
    setSaving(false);
    flash('Saved ✓');
  }

  return (
    <div className={card} style={{ maxWidth: 480 }}>
      <label className={fieldLabel}>Deposit Return Deadline</label>

      {/* Auto mode: read-only value + "Auto" badge + Override button */}
      {!overrideMode && (
        <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-2.5">
          <div>
            <span className="text-sm font-semibold text-gray-900">
              {STATUTORY_DEADLINE_DAYS} days
            </span>
            <span className="ml-2 text-[11px] font-semibold uppercase tracking-wide text-green-600">
              Auto
            </span>
          </div>
          <button
            onClick={enableOverride}
            className="rounded-md border border-gray-300 px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-50"
          >
            Override
          </button>
        </div>
      )}

      {/* Override mode: editable number input + link back to automatic */}
      {overrideMode && (
        <>
          <input
            type="number"
            min={1}
            value={overrideValue}
            onChange={e => setOverrideValue(e.target.value)}
            placeholder="e.g. 21"
            className={input}
          />
          <button
            onClick={clearOverride}
            className="mt-1 text-xs text-blue-600 hover:underline"
          >
            ← Clear override, use automatic
          </button>
        </>
      )}

      <div className={fieldHint}>
        California law requires the deposit accounting be delivered within {STATUTORY_DEADLINE_DAYS} days
        of move-out. Leave this on Auto unless a specific situation needs a different window.
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button onClick={save} disabled={saving} className={btnPrimary}>
          {saving ? 'Saving…' : 'Save Settings'}
        </button>
        {msg && <span className="text-sm text-gray-500">{msg}</span>}
      </div>
    </div>
  );
}
