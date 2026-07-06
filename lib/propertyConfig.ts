import properties from '@/data/properties.json';
import { PropertyConfig } from '@/types';

const CONFIG: PropertyConfig[] = properties as PropertyConfig[];

/**
 * Match the AppFolio "Property" column value to a config record.
 * AppFolio typically formats it as "A021 - ARBOR HEIGHTS" or just the full name.
 * Tries code prefix match first, then name substring match (case-insensitive).
 */
export function lookupProperty(propertyValue: string): PropertyConfig | null {
  if (!propertyValue) return null;
  const upper = propertyValue.toUpperCase();

  const codeMatch = CONFIG.find(p => upper.startsWith(p.code));
  if (codeMatch) return codeMatch;

  const nameMatch = CONFIG.find(p => upper.includes(p.name.toUpperCase()));
  return nameMatch ?? null;
}
