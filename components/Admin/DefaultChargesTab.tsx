'use client';

import { useState } from 'react';
import { DefaultCharges } from '@/types';
import { useAdminSettings } from '@/context/AdminSettingsContext';
import { useFlash } from './useFlash';
import { card, btnPrimary, input, fieldLabel, fieldHint } from './adminStyles';

// The editable fields, in display order. Keeping this as a small list (rather
// than four copy-pasted blocks of JSX) mirrors how the Workbooks tab in Report
// Studio built its inputs from an array — add a field here and the UI follows.
const FIELDS: { key: keyof DefaultCharges; label: string }[] = [
  { key: 'generalCleaning', label: 'General Cleaning' },
  { key: 'carpetShampooing', label: 'Carpet Shampooing' },
  { key: 'blindDrapeCleaning', label: 'Blind / Drape Cleaning' },
  { key: 'painting', label: 'Painting' },
];

export function DefaultChargesTab() {
  const { settings, updateSettings } = useAdminSettings();
  // Work on a local draft so typing doesn't save on every keystroke — only on Save.
  const [draft, setDraft] = useState<DefaultCharges>(settings.defaultCharges);
  const [saving, setSaving] = useState(false);
  const [msg, flash] = useFlash();

  // Update one field of the draft by its key.
  function setField(key: keyof DefaultCharges, value: string) {
    // Number(value) || 0 keeps a blank field as 0 instead of NaN ("not a number").
    setDraft(prev => ({ ...prev, [key]: Number(value) || 0 }));
  }

  function save() {
    setSaving(true);
    updateSettings({ defaultCharges: draft });
    setSaving(false);
    flash('Saved ✓');
  }

  return (
    <div className={card} style={{ maxWidth: 480 }}>
      <p className="mb-4 text-sm text-gray-600">
        Company-standard starting amounts for common move-out charges. These pre-fill the
        return form so nobody retypes the usual figures — they can still be changed per tenant.
      </p>

      {FIELDS.map(f => (
        <div key={f.key} className="mb-4">
          <label className={fieldLabel}>{f.label}</label>
          <div className="relative">
            {/* The "$" sits inside the input as a visual prefix. */}
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
              $
            </span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={draft[f.key]}
              onChange={e => setField(f.key, e.target.value)}
              className={`${input} pl-6`}
            />
          </div>
        </div>
      ))}

      <div className={fieldHint}>Enter 0 for any charge you don&apos;t want pre-filled.</div>

      <div className="mt-4 flex items-center gap-3">
        <button onClick={save} disabled={saving} className={btnPrimary}>
          {saving ? 'Saving…' : 'Save Default Charges'}
        </button>
        {msg && <span className="text-sm text-gray-500">{msg}</span>}
      </div>
    </div>
  );
}
