'use client';

// DeadlinePill.tsx
// Compact days-remaining pill for the Dashboard table "Days Left" column.

import { getDaysRemaining, getDeadlineUrgency } from '@/lib/deadlineUtils';

interface DeadlinePillProps {
  moveOutDate: string;
}

export function DeadlinePill({ moveOutDate }: DeadlinePillProps) {
  const daysRemaining = getDaysRemaining(moveOutDate);
  const urgency = getDeadlineUrgency(daysRemaining);

  const colors = {
    green: 'bg-green-100 text-green-800',
    amber: 'bg-amber-100 text-amber-800',
    red:   'bg-red-100 text-red-800',
  }[urgency];

  const label = daysRemaining < 0
    ? `${Math.abs(daysRemaining)}d overdue`
    : daysRemaining === 0
      ? 'Due today'
      : `${daysRemaining}d left`;

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors}`}>
      {label}
    </span>
  );
}
