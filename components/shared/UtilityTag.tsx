'use client';
import { UtilityType } from '@/types';

export function UtilityTag({ type }: { type: UtilityType }) {
  if (type === 'RUBS') {
    return (
      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-accent/12 text-accent border border-accent/25">
        RUBS
      </span>
    );
  }
  return (
    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-fill text-secondary border border-separator">
      Flat Fee
    </span>
  );
}
