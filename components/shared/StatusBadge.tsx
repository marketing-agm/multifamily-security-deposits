'use client';
import { ProcessingStatus } from '@/types';

const STATUS_STYLES: Record<ProcessingStatus, string> = {
  not_started: 'bg-gray-100 text-gray-600',
  in_progress: 'bg-yellow-100 text-yellow-800',
  complete: 'bg-green-100 text-green-800',
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
