'use client';
import { ProcessingStatus } from '@/types';

const STATUS_STYLES: Record<ProcessingStatus, string> = {
  not_started: 'bg-gray-100 dark:bg-[#3a3a3c] text-gray-600 dark:text-[#8e8e93]',
  in_progress: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400',
  complete: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400',
};

const STATUS_LABELS: Record<ProcessingStatus, string> = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  complete: 'Complete',
};

export function StatusBadge({ status }: { status: ProcessingStatus }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}
