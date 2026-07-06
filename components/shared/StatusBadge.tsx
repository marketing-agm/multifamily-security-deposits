'use client';
import { ProcessingStatus } from '@/types';

const STATUS_STYLES: Record<ProcessingStatus, string> = {
  not_started: 'bg-fill text-secondary',
  in_progress: 'bg-warning/12 text-warning-fg',
  complete: 'bg-success/12 text-success-fg',
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
