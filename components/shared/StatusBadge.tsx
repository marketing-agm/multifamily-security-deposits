'use client';
import { ProcessingStatus } from '@/types';
import { Circle, Clock, CheckCircle2, LucideIcon } from 'lucide-react';

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

// A small Lucide icon per status so the state reads at a glance, not just by color.
const STATUS_ICONS: Record<ProcessingStatus, LucideIcon> = {
  not_started: Circle,
  in_progress: Clock,
  complete: CheckCircle2,
};

export function StatusBadge({ status }: { status: ProcessingStatus }) {
  const Icon = STATUS_ICONS[status];
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${STATUS_STYLES[status]}`}>
      <Icon size={12} />
      {STATUS_LABELS[status]}
    </span>
  );
}
