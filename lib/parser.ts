import * as XLSX from 'xlsx';
import {
  TenantData,
  DepositData,
  UtilityData,
  TenantReturn,
  UtilityType,
  ManualCharges,
} from '@/types';
import { computeCalculatedCharges } from './calculations';
import { lookupProperty } from './propertyConfig';

// A "row" after we've found the real header is a plain object keyed by column name.
type Row = Record<string, unknown>;

function parseDate(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'number') {
    const jsDate = XLSX.SSF.parse_date_code(value);
    const month = String(jsDate.m).padStart(2, '0');
    const day = String(jsDate.d).padStart(2, '0');
    return `${jsDate.y}-${month}-${day}`;
  }
  if (typeof value === 'string' && value.trim()) {
    const d = new Date(value);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  }
  return '';
}

// Split a one-line address like "1812 S State St, Seattle, WA 98144" (or without
// the comma before the city) into { street, city, state, zip }. AppFolio exports
// the whole address in one column; the AGM form needs the parts separated.
// Heuristic + editable in the form, so an odd address just needs a manual tweak.
export function parseAddress(full: string): { street: string; city: string; state: string; zip: string } {
  const s = (full || '').trim();
  if (!s) return { street: '', city: '', state: '', zip: '' };

  let rest = s;
  let state = '';
  let zip = '';
  // Pull a trailing "ST 98144" or "ST 98144-1234" off the end.
  const m = rest.match(/^(.*?)[,\s]+([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)\s*$/);
  if (m) {
    rest = m[1].trim().replace(/,\s*$/, '');
    state = m[2].toUpperCase();
    zip = m[3];
  }

  let street = rest;
  let city = '';
  if (rest.includes(',')) {
    // "street, city" (city is the last comma-separated chunk).
    const parts = rest.split(',').map(p => p.trim()).filter(Boolean);
    city = parts.pop() ?? '';
    street = parts.join(', ');
  } else if (state) {
    // No comma but we found a state, so the last word is likely the city
    // (e.g. "1812 S State St Seattle" → street "1812 S State St", city "Seattle").
    const toks = rest.split(/\s+/);
    if (toks.length > 1) {
      city = toks.pop() as string;
      street = toks.join(' ');
    }
  }
  return { street, city, state, zip };
}

function num(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const n = parseFloat(value.replace(/[$,]/g, ''));
    return isNaN(n) ? 0 : n;
  }
  return 0;
}

function str(value: unknown): string {
  return value != null ? String(value).trim() : '';
}

// Multi-key lookup — tries keys in order, returns first non-empty match.
function pick(row: Row, ...keys: string[]): unknown {
  for (const k of keys) {
    if (row[k] != null && row[k] !== '') return row[k];
  }
  return '';
}

export interface ParseError {
  message: string;
  row?: number;
  sheet?: string;
}

export interface ParseResult {
  returns: TenantReturn[];
  errors: ParseError[];
  propertyName: string;
}

const EMPTY_MANUAL_CHARGES: ManualCharges = {
  generalCleaning: 0,
  blindDrapeCleaning: 0,
  windowCoveringReplacement: 0,
  carpetShampooing: 0,
  flooringRestoration: 0,
  painting: 0,
  other1Label: 'Other',
  other1: 0,
  other2Label: 'Other',
  other2: 0,
  legalCourtCosts: 0,
};

/**
 * Read a worksheet as raw rows (arrays), find the header row by checking
 * whether it contains all of the required sentinel values, then return the
 * data below it as objects keyed by column name.
 *
 * The real AppFolio export has several metadata rows at the top (report title,
 * export date, filter labels) before the actual column header row — so we
 * can't just use sheet_to_json's default "row 0 is headers" assumption.
 */
function sheetToRowsAfterHeader(
  sheet: XLSX.WorkSheet,
  requiredHeaders: string[],
): Row[] {
  // Read every row as a plain array of cell values.
  const raw: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: '',
  }) as unknown[][];

  // Find the first row that contains ALL required header strings (case-insensitive).
  const lower = requiredHeaders.map(h => h.toLowerCase());
  let headerRowIdx = -1;
  let headerRow: unknown[] = [];

  for (let i = 0; i < raw.length; i++) {
    const rowLower = raw[i].map(c => str(c).toLowerCase());
    if (lower.every(h => rowLower.includes(h))) {
      headerRowIdx = i;
      headerRow = raw[i].map(c => str(c)); // keep original casing as column names
      break;
    }
  }

  if (headerRowIdx === -1) return [];

  // Convert every row below the header into a keyed object.
  const result: Row[] = [];
  for (let i = headerRowIdx + 1; i < raw.length; i++) {
    const obj: Row = {};
    for (let j = 0; j < headerRow.length; j++) {
      const key = str(headerRow[j]);
      if (key) obj[key] = raw[i][j] ?? '';
    }
    result.push(obj);
  }
  return result;
}

// The Transactions sheet has group-label rows like "Current", "Evict",
// "Past", "Notice", "Future" where unit and name are blank — skip them.
const TX_GROUP_LABELS = new Set(['current', 'evict', 'past', 'notice', 'future']);

export function parseAppFolioExport(buffer: ArrayBuffer): ParseResult {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: false });
  const errors: ParseError[] = [];
  const sheetNames = workbook.SheetNames;

  if (sheetNames.length < 2) {
    errors.push({
      message:
        'Upload must contain at least 2 sheets (Tenant Tickler, Tenant Transactions). Check your AppFolio export.',
    });
    return { returns: [], errors, propertyName: '' };
  }

  // Sheet 1: Tenant Tickler — required sentinel columns.
  const ledgerRows = sheetToRowsAfterHeader(workbook.Sheets[sheetNames[0]], [
    'Unit',
    'Tenant',
    'Property',
  ]);

  // Sheet 2: Tenant Transactions Summary — required sentinel columns.
  const allTxRows = sheetToRowsAfterHeader(workbook.Sheets[sheetNames[1]], [
    'Unit',
    'Name',
    'Ending Balance',
  ]);

  if (ledgerRows.length === 0) {
    errors.push({
      message:
        'Could not find the column header row in Sheet 1. Expected columns: Unit, Tenant, Property. Check your AppFolio export.',
      sheet: sheetNames[0],
    });
    return { returns: [], errors, propertyName: '' };
  }

  // Index transactions by unit for joining; skip group-label rows.
  const txByUnit = new Map<string, Row>();
  for (const row of allTxRows) {
    const unit = str(pick(row, 'Unit', 'unit'));
    const name = str(pick(row, 'Name', 'name'));
    // Skip group-label rows that have no unit or whose only content is a group name.
    if (!unit || TX_GROUP_LABELS.has(unit.toLowerCase())) continue;
    if (!name || TX_GROUP_LABELS.has(name.toLowerCase())) continue;
    if (!txByUnit.has(unit.toLowerCase())) {
      txByUnit.set(unit.toLowerCase(), row);
    }
  }

  // An export can span multiple properties, so we resolve the property PER ROW
  // (below) rather than once for the whole file. `propertyNames` collects the
  // distinct ones so we can build a summary label for the session.
  const returns: TenantReturn[] = [];
  const propertyNames = new Set<string>();

  for (let i = 0; i < ledgerRows.length; i++) {
    const row = ledgerRows[i];
    const unit = str(pick(row, 'Unit', 'unit'));
    const tenantName = str(pick(row, 'Tenant', 'tenant'));

    // Skip completely empty rows.
    if (!tenantName && !unit) continue;

    if (!tenantName) {
      errors.push({ message: `Row ${i + 2}: Missing tenant name.`, row: i + 2, sheet: sheetNames[0] });
    }
    if (!unit) {
      errors.push({ message: `Row ${i + 2}: Missing unit number.`, row: i + 2, sheet: sheetNames[0] });
    }

    // Resolve THIS tenant's property + config (an upload can mix properties).
    const rowPropertyValue = str(pick(row, 'Property', 'property'));
    const rowPropertyConfig = lookupProperty(rowPropertyValue);
    const rowPropertyName = rowPropertyConfig ? rowPropertyConfig.name : rowPropertyValue;
    if (rowPropertyName) propertyNames.add(rowPropertyName);

    const tx: Row = txByUnit.get(unit.toLowerCase()) ?? {};

    // Lease break: check Tags and Move Out Reason columns.
    const tags = str(pick(row, 'Tags', 'tags')).toLowerCase();
    const moveOutReason = str(pick(row, 'Move Out Reason', 'move_out_reason')).toLowerCase();
    const leaseBreak = tags.includes('lease break') || moveOutReason.includes('lease break');

    // Prefer "Move in Date" / "Move In Date" over "Lease from" / "Lease From".
    const moveInDate =
      parseDate(pick(row, 'Move in Date', 'Move In Date')) ||
      parseDate(pick(row, 'Lease from', 'Lease From'));

    const tenantData: TenantData = {
      tenantName,
      coTenant: str(pick(row, 'Additional Tenants', 'additional_tenants')),
      unit,
      monthlyRent: num(pick(row, 'Rent', 'rent')),
      moveInDate,
      moveOutDate: parseDate(pick(row, 'Move Out Date', 'move_out_date', 'Move Out Date')),
      paidThroughDate: '', // not in export — staff fills manually
      noticeDate: parseDate(pick(row, 'Notice Given Date', 'notice_given_date')),
      leaseEndDate: parseDate(pick(row, 'Lease To', 'Lease to', 'lease_to')),
      leaseBreak,
      newTenantMoveInDate: null,
      forwardingAddress: parseAddress(str(pick(row, 'Tenant Address', 'tenant_address'))),
      inspectionStatus: 'missing',
    };

    const depositData: DepositData = {
      securityDeposit: num(pick(row, 'Deposit', 'deposit')),
      petDeposit: 0,
      keyDeposit: 0,
      garageOpenerDeposit: 0,
      nrcCleaningFee: rowPropertyConfig?.nrcCleaningFee ?? 0,
      nrcPetFee: rowPropertyConfig?.nrcPetFee ?? 0,
    };

    const utilityType: UtilityType = rowPropertyConfig?.utilityType ?? 'flat_fee';
    const utilityData: UtilityData = {
      utilityType,
      flatFeeRate: rowPropertyConfig?.flatFeeRate ?? 0,
      flatFeeBillingMethod: 'billed_at_moveout',
      rubsBuildingTotal: 0,
      rubsUnitRatio: 0,
    };

    const ledgerData = {
      outstandingBalances: num(pick(tx, 'Ending Balance', 'ending_balance')),
      lateFees: num(pick(tx, 'Late Charges', 'late_charges')),
      credits: num(pick(tx, 'Other Credits', 'other_credits')),
      partialPayments: num(pick(tx, 'Cash Payments', 'cash_payments')),
      priorCharges: num(pick(tx, 'Other Charges', 'other_charges')),
    };

    const partial = {
      id: `${unit}-${i}`,
      tenantData,
      depositData,
      utilityData,
      ledgerData,
      manualCharges: { ...EMPTY_MANUAL_CHARGES },
      rubsManualInput: null,
      processingStatus: 'not_started' as const,
      complianceChecked: false,
      pdfGenerated: false,
      propertyName: rowPropertyName,
      propertyConfig: rowPropertyConfig,
    };

    const calculatedCharges = computeCalculatedCharges(partial);
    returns.push({ ...partial, calculatedCharges });
  }

  // Session-level label: the single property name, or "N properties" when mixed.
  const names = [...propertyNames];
  const propertyName = names.length === 1 ? names[0] : `${names.length} properties`;

  return { returns, errors, propertyName };
}
