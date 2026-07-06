'use client';
import { InspectionStatus } from '@/types';

export function InspectionBadge({ status }: { status: InspectionStatus }) {
  if (status === 'signed') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-success/12 text-success-fg">
        <span className="w-1.5 h-1.5 rounded-full bg-success" />
        Signed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-danger/12 text-danger-fg">
      <span className="w-1.5 h-1.5 rounded-full bg-danger" />
      Missing
    </span>
  );
}
