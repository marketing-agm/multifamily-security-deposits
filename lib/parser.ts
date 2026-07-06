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

// Multi-key lookup — tries keys in order, returns first non-empty match
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

export function parseAppFolioExport(buffer: ArrayBuffer): ParseResult {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: false });
  const errors: ParseError[] = [];
  const sheetNames = workbook.SheetNames;

  if (sheetNames.length < 2) {
    errors.push({
      message: 'Upload must contain at least 2 sheets (Tenant Ledger, Tenant Transactions). Check your AppFolio export.',
    });
    return { returns: [], errors, propertyName: '' };
  }

  const ledgerRows = XLSX.utils.sheet_to_json<Row>(workbook.Sheets[sheetNames[0]], { defval: '' });
  const transactionRows = XLSX.utils.sheet_to_json<Row>(workbook.Sheets[sheetNames[1]], { defval: '' });

  // Index transactions by unit for joining
  const txByUnit = new Map<string, Row>();
  for (const row of transactionRows) {
    const unit = str(pick(row, 'Unit', 'unit'));
    if (unit) txByUnit.set(unit.toLowerCase(), row);
  }

  // Detect property name and config from first row
  const firstPropertyValue = str(pick(ledgerRows[0] ?? {}, 'Property', 'property'));
  const propertyConfig = lookupProperty(firstPropertyValue);
  const propertyName = propertyConfig
    ? `${propertyConfig.code} - ${propertyConfig.name}`
    : firstPropertyValue;

  const returns: TenantReturn[] = [];

  for (let i = 0; i < ledgerRows.length; i++) {
    const row = ledgerRows[i];
    const unit = str(pick(row, 'Unit', 'unit'));
    const tenantName = str(pick(row, 'Tenant', 'tenant'));

    if (!tenantName && !unit) continue;

    if (!tenantName) {
      errors.push({ message: `Row ${i + 2}: Missing tenant name.`, row: i + 2, sheet: sheetNames[0] });
    }
    if (!unit) {
      errors.push({ message: `Row ${i + 2}: Missing unit number.`, row: i + 2, sheet: sheetNames[0] });
    }

    const tx: Row = txByUnit.get(unit.toLowerCase()) ?? {};

    // Lease break: check Tags and Move Out Reason
    const tags = str(pick(row, 'Tags', 'tags')).toLowerCase();
    const moveOutReason = str(pick(row, 'Move Out Reason', 'move_out_reason')).toLowerCase();
    const leaseBreak = tags.includes('lease break') || moveOutReason.includes('lease break');

    // Prefer "Move in Date" over "Lease from" for moveInDate
    const moveInDate =
      parseDate(pick(row, 'Move in Date', 'Move In Date')) ||
      parseDate(pick(row, 'Lease from', 'Lease From'));

    const tenantData: TenantData = {
      tenantName,
      coTenant: str(pick(row, 'Additional Tenants', 'additional_tenants')),
      unit,
      monthlyRent: num(pick(row, 'Rent', 'rent')),
      moveInDate,
      moveOutDate: parseDate(pick(row, 'Move Out Date', 'move_out_date')),
      paidThroughDate: '', // not in export — staff fills manually
      noticeDate: parseDate(pick(row, 'Notice Given Date', 'notice_given_date')),
      leaseEndDate: parseDate(pick(row, 'Lease To', 'Lease to', 'lease_to')),
      leaseBreak,
      newTenantMoveInDate: null,
      forwardingAddress: {
        street: str(pick(row, 'Tenant Address', 'tenant_address')),
        city: '',
        state: '',
        zip: '',
      },
      inspectionStatus: 'missing',
    };

    const depositData: DepositData = {
      securityDeposit: num(pick(row, 'Deposit', 'deposit')),
      petDeposit: 0,
      keyDeposit: 0,
      garageOpenerDeposit: 0,
      // NRC fees seeded from property config; default to 0 if no match
      nrcCleaningFee: propertyConfig?.nrcCleaningFee ?? 0,
      nrcPetFee: propertyConfig?.nrcPetFee ?? 0,
    };

    const utilityType: UtilityType = propertyConfig?.utilityType ?? 'flat_fee';
    const utilityData: UtilityData = {
      utilityType,
      flatFeeRate: propertyConfig?.flatFeeRate ?? 0,
      flatFeeBillingMethod: 'billed_at_moveout',
      rubsBuildingTotal: 0,
      rubsUnitRatio: 0, // entered per-tenant manually in ReturnForm
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
    };

    const calculatedCharges = computeCalculatedCharges(partial);
    returns.push({ ...partial, calculatedCharges });
  }

  return { returns, errors, propertyName };
}
