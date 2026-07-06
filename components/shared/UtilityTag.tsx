'use client';
import { UtilityType } from '@/types';

export function UtilityTag({ type }: { type: UtilityType }) {
  if (type === 'RUBS') {
    return (
      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-700">
        RUBS
      </span>
    );
  }
  return (
    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-700">
      Flat Fee
    </span>
  );
}
