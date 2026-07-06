'use client';
import { InspectionStatus } from '@/types';

export function InspectionBadge({ status }: { status: InspectionStatus }) {
  if (status === 'signed') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400">
        <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
        Signed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
      <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
      Missing
    </span>
  );
}
