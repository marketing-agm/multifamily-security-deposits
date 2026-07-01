// lib/deadlineUtils.ts
// Calculates the 21-day statutory deadline for security deposit returns.
// California Civil Code §1950.5 requires return within 21 days of move-out.

export function getDeadline(moveOutDate: string): Date {
  // moveOutDate is ISO format: 'YYYY-MM-DD'
  const d = new Date(moveOutDate + 'T00:00:00');
  d.setDate(d.getDate() + 21);
  return d;
}

export function getDaysRemaining(moveOutDate: string): number {
  const deadline = getDeadline(moveOutDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffMs = deadline.getTime() - today.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

export function getDeadlineUrgency(daysRemaining: number): 'green' | 'amber' | 'red' {
  if (daysRemaining > 7) return 'green';
  if (daysRemaining >= 4) return 'amber';
  return 'red';
}

export function formatDeadlineDate(moveOutDate: string): string {
  const deadline = getDeadline(moveOutDate);
  return deadline.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}
