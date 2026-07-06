import { AdminSettings } from '@/types';

// California law requires the deposit accounting be returned within 21 days.
// We keep this as a named constant so the "why 21?" is documented in one place.
export const STATUTORY_DEADLINE_DAYS = 21;

// The settings a brand-new install starts with. If nothing has ever been saved,
// this is what the admin panel shows. Keeping it here (not scattered in the UI)
// means there is exactly one source of truth for "default configuration".
export const DEFAULT_ADMIN_SETTINGS: AdminSettings = {
  deadlineDays: STATUTORY_DEADLINE_DAYS,
  deadlineDaysIsAuto: true,
  reviewGate: 'off',
  defaultCharges: {
    generalCleaning: 0,
    carpetShampooing: 0,
    blindDrapeCleaning: 0,
    painting: 0,
  },
};

// Merge whatever we loaded from storage on top of the defaults.
// Why: if we add a new setting later, older saved data won't have it — this
// makes sure every field always has a value so the UI never sees `undefined`.
export function withDefaults(partial: Partial<AdminSettings> | null | undefined): AdminSettings {
  if (!partial) return DEFAULT_ADMIN_SETTINGS;
  return {
    ...DEFAULT_ADMIN_SETTINGS,
    ...partial,
    // defaultCharges is a nested object, so merge it separately or a partial
    // save would wipe the fields it didn't include.
    defaultCharges: { ...DEFAULT_ADMIN_SETTINGS.defaultCharges, ...(partial.defaultCharges || {}) },
  };
}

// The number of days actually in effect: the statutory value when on "auto",
// otherwise the manual override the user typed.
export function effectiveDeadlineDays(settings: AdminSettings): number {
  return settings.deadlineDaysIsAuto ? STATUTORY_DEADLINE_DAYS : settings.deadlineDays;
}
