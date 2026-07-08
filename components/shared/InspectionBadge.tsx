'use client';
import { InspectionStatus } from '@/types';
import { FileCheck2, FileX2 } from 'lucide-react';

export function InspectionBadge({ status }: { status: InspectionStatus }) {
  if (status === 'signed') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-success/12 text-success-fg">
        <FileCheck2 size={12} />
        Signed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-danger/12 text-danger-fg">
      <FileX2 size={12} />
      Missing
    </span>
  );
}
