// Security-deposit return deadline — Washington law.
//
// RCW 59.18.280(1)(a): the landlord must deliver a full & specific statement of
// the basis for retaining any deposit, plus any refund due, within 30 days after
// the tenancy ends and the tenant vacates. (Previously this tool referenced
// California Civil Code §1950.5 / 21 days — AGM operates in Washington.)
//
// Keeping these in one place so every screen (dashboard, review, PDF) agrees.

export const DEPOSIT_RETURN_DAYS = 30;
export const DEADLINE_LAW_REF = 'Washington RCW 59.18.280';
export const DEADLINE_LAW_SHORT = 'RCW 59.18.280';

// Returns the postmark deadline (moveOut + 30 days), or null if no move-out date.
export function computeDeadline(moveOutISO: string | null | undefined): Date | null {
  if (!moveOutISO) return null;
  const d = new Date(moveOutISO + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + DEPOSIT_RETURN_DAYS);
  return d;
}

// Whole days from now until the deadline (negative = overdue). null if no date.
export function daysUntilDeadline(deadline: Date | null): number | null {
  if (!deadline) return null;
  return Math.ceil((deadline.getTime() - Date.now()) / 86_400_000);
}
