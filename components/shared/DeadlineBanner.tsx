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

  // Color classes per urgency level
  const colors = {
    green: { border: 'border-green-600', bg: 'bg-green-50', text: 'text-green-900', badge: 'bg-green-100 text-green-800', days: 'text-green-700' },
    amber: { border: 'border-amber-500', bg: 'bg-amber-50', text: 'text-amber-900', badge: 'bg-amber-100 text-amber-800', days: 'text-amber-700' },
    red:   { border: 'border-red-600',   bg: 'bg-red-50',   text: 'text-red-900',   badge: 'bg-red-100 text-red-800',   days: 'text-red-700'   },
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
        <div className={`shrink-0 px-3 py-1 rounded-full text-sm font-semibold whitespace-nowrap ${colors.badge}`}>
          {daysLabel}
        </div>
      </div>
    </div>
  );
}
