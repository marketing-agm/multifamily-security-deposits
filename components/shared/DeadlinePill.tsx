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

  // AGM status color tokens — match the deadline banner urgency colors
  const colors = {
    green: 'bg-[#e3f5e6] text-[#1a7a3a]',
    amber: 'bg-[#fdf3da] text-[#8b6a00]',
    red:   'bg-[#fceae8] text-[#b3261e]',
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
