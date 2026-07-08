'use client';
import { UtilityType } from '@/types';
import { Gauge, Receipt } from 'lucide-react';

export function UtilityTag({ type }: { type: UtilityType }) {
  if (type === 'RUBS') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-accent/12 text-accent border border-accent/25">
        <Gauge size={12} />
        RUBS
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-fill text-secondary border border-separator">
      <Receipt size={12} />
      Flat Fee
    </span>
  );
}
