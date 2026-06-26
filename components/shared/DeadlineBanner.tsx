'use client';

// DeadlineBanner.tsx
// Full formal compliance notice for the Review & Submit screen (Screen 3).
// Color-coded by urgency: green (>7 days), amber (4-7 days), red (≤3 days or overdue).

import { getDaysRemaining, getDeadlineUrgency, formatDeadlineDate } from '@/lib/deadlineUtils';

interface DeadlineBannerProps {
  moveOutDate: string;
}

export function DeadlineBanner({ moveOutDate }: DeadlineBannerProps) {
  const daysRemaining = getDaysRemaining(moveOutDate);
  const urgency = getDeadlineUrgency(daysRemaining);
  const deadlineDate = formatDeadlineDate(moveOutDate);

  // AGM status color tokens per urgency level
  const colors = {
    green: {
      border: 'border-[#1a7a3a]',
      bg: 'bg-[#e3f5e6]',
      text: 'text-[#1a7a3a]',
      badge: 'bg-[#e3f5e6] text-[#1a7a3a] border border-[#1a7a3a]/30',
    },
    amber: {
      border: 'border-[#8b6a00]',
      bg: 'bg-[#fdf3da]',
      text: 'text-[#8b6a00]',
      badge: 'bg-[#fdf3da] text-[#8b6a00] border border-[#8b6a00]/30',
    },
    red: {
      border: 'border-[#b3261e]',
      bg: 'bg-[#fceae8]',
      text: 'text-[#b3261e]',
      badge: 'bg-[#fceae8] text-[#b3261e] border border-[#b3261e]/30',
    },
  }[urgency];

  const daysLabel = daysRemaining < 0
    ? `${Math.abs(daysRemaining)} days overdue`
    : daysRemaining === 0
      ? 'Due today'
      : `${daysRemaining} days remaining`;

  return (
    <div className={`border-l-4 ${colors.border} ${colors.bg} p-4 rounded-r-md`}>
      <div className="flex items-start justify-between gap-4">
        <div className={`flex-1 ${colors.text}`}>
          <p className="font-bold text-sm uppercase tracking-wide mb-1">
            NOTICE: Deposit return due within 21 days of move-out.
          </p>
          <p className="text-sm leading-relaxed">
            Full deposit return or itemized statement of deductions must be delivered by{' '}
            <strong>{deadlineDate}</strong>. Failure to comply within the statutory period may result
            in forfeiture of the right to make deductions and liability for damages under{' '}
            California Civil Code §1950.5.
          </p>
        </div>
        {/* Days remaining badge */}
        <div className={`shrink-0 px-3 py-1 rounded-full text-sm font-semibold whitespace-nowrap ${colors.badge}`}>
          {daysLabel}
        </div>
      </div>
    </div>
  );
}
