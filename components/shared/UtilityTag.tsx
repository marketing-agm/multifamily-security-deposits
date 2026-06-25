'use client';
import { UtilityType } from '@/types';

export function UtilityTag({ type }: { type: UtilityType }) {
  if (type === 'RUBS') {
    return (
      <span className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
        RUBS
      </span>
    );
  }
  return (
    <span className="px-2 py-0.5 rounded text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-200">
      Flat Fee
    </span>
  );
}
