import * as XLSX from 'xlsx';
import {
  TenantData,
  DepositData,
  UtilityData,
  LedgerData,
  TenantReturn,
  UtilityType,
  FlatFeeBillingMethod,
  InspectionStatus,
  ManualCharges,
  CalculatedCharges,
} from '@/types';
import { computeCalculatedCharges } from './calculations';

type Row = Record<string, unknown>;

function parseDate(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'number') {
    // Excel serial date
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
    errors.push({ message: 'Upload must contain at least 2 sheets (Tenant & Lease, Deposits & Fees). Check your AppFolio export.' });
    return { returns: [], errors, propertyName: '' };
  }

  const sheets = sheetNames.map(name => ({
    name,
    rows: XLSX.utils.sheet_to_json<Row>(workbook.Sheets[name], { defval: '' }),
  }));

  // Sheet 0 — Tenant & Lease
  const tenantRows = sheets[0].rows;
  // Sheet 1 — Deposits & Fees
  const depositRows = sheets[1]?.rows ?? [];
  // Sheet 2 — Utility
  const utilityRows = sheets[2]?.rows ?? [];
  // Sheet 3 — Ledger
  const ledgerRows = sheets[3]?.rows ?? [];

  // Index by unit number for joining
  const byUnit = <T extends Row>(rows: T[]): Map<string, T> => {
    const map = new Map<string, T>();
    for (const row of rows) {
      const unit = str(pick(row, 'Unit', 'Unit Number', 'unit', 'unit_number'));
      if (unit) map.set(unit.toLowerCase(), row);
    }
    return map;
  };

  const depositMap = byUnit(depositRows);
  const utilityMap = byUnit(utilityRows);
  const ledgerMap = byUnit(ledgerRows);

  // Detect property name from first row or sheet metadata
  const propertyName = str(pick(tenantRows[0] ?? {}, 'Property', 'Property Name', 'property', 'property_name'));

  const returns: TenantReturn[] = [];

  for (let i = 0; i < tenantRows.length; i++) {
    const row = tenantRows[i];
    const unit = str(pick(row, 'Unit', 'Unit Number', 'unit', 'unit_number'));
    const unitKey = unit.toLowerCase();
    const dep: Row = depositMap.get(unitKey) ?? {};
    const util: Row = utilityMap.get(unitKey) ?? {};
    const led: Row = ledgerMap.get(unitKey) ?? {};

    const tenantName = str(pick(row, 'Tenant Name', 'Tenant', 'tenant_name', 'tenant'));
    if (!tenantName && !unit) continue; // skip completely empty rows

    if (!tenantName) {
      errors.push({ message: `Row ${i + 2} in ${sheets[0].name}: Missing tenant name.`, row: i + 2, sheet: sheets[0].name });
    }
    if (!unit) {
      errors.push({ message: `Row ${i + 2} in ${sheets[0].name}: Missing unit number.`, row: i + 2, sheet: sheets[0].name });
    }

    const leaseBreakRaw = str(pick(row, 'Lease Break', 'lease_break'));
    const leaseBreak = ['yes', 'true', '1', 'y'].includes(leaseBreakRaw.toLowerCase());

    const utilTypeRaw = str(pick(util, 'Utility Type', 'utility_type', 'Utility'));
    const utilityType: UtilityType = utilTypeRaw.toUpperCase().includes('RUBS') ? 'RUBS' : 'flat_fee';

    const billingRaw = str(pick(util, 'Billing Method', 'billing_method', 'Flat Fee Billing Method'));
    const flatFeeBillingMethod: FlatFeeBillingMethod = billingRaw.toLowerCase().includes('includ')
      ? 'included_in_rent'
      : 'billed_at_moveout';

    const inspectionRaw = str(pick(row, 'Inspection Status', 'inspection_status', 'Inspection'));
    const inspectionStatus: InspectionStatus = inspectionRaw.toLowerCase().includes('sign') ? 'signed' : 'missing';

    const tenantData: TenantData = {
      tenantName,
      coTenant: str(pick(row, 'Co-Tenant', 'Co Tenant', 'co_tenant')),
      unit,
      monthlyRent: num(pick(row, 'Monthly Rent', 'Rent', 'monthly_rent')),
      moveInDate: parseDate(pick(row, 'Move-In Date', 'Move In Date', 'move_in_date')),
      moveOutDate: parseDate(pick(row, 'Move-Out Date', 'Move Out Date', 'move_out_date')),
      paidThroughDate: parseDate(pick(row, 'Paid Through', 'Paid Through Date', 'paid_through')),
      noticeDate: parseDate(pick(row, 'Notice Date', 'notice_date')),
      leaseEndDate: parseDate(pick(row, 'Lease End Date', 'Lease End', 'lease_end_date')),
      leaseBreak,
      newTenantMoveInDate: parseDate(pick(row, 'New Tenant Move-In', 'New Tenant Move In Date', 'new_tenant_move_in')) || null,
      forwardingAddress: {
        street: str(pick(row, 'Forwarding Address', 'Forwarding Street', 'forwarding_address')),
        city: str(pick(row, 'Forwarding City', 'forwarding_city')),
        state: str(pick(row, 'Forwarding State', 'forwarding_state')),
        zip: str(pick(row, 'Forwarding Zip', 'Forwarding ZIP', 'forwarding_zip')),
      },
      inspectionStatus,
    };

    const depositData: DepositData = {
      securityDeposit: num(pick(dep, 'Security Deposit', 'security_deposit')),
      petDeposit: num(pick(dep, 'Pet Deposit', 'pet_deposit')),
      keyDeposit: num(pick(dep, 'Key Deposit', 'key_deposit')),
      garageOpenerDeposit: num(pick(dep, 'Garage Opener Deposit', 'garage_opener_deposit')),
      nrcCleaningFee: num(pick(dep, 'NRC Cleaning Fee', 'nrc_cleaning_fee', 'NRC Cleaning')),
      nrcPetFee: num(pick(dep, 'NRC Pet Fee', 'nrc_pet_fee', 'NRC Pet')),
    };

    const utilityData: UtilityData = {
      utilityType,
      flatFeeRate: num(pick(util, 'Flat Fee Rate', 'flat_fee_rate', 'Flat Fee')),
      flatFeeBillingMethod,
      rubsBuildingTotal: num(pick(util, 'RUBS Building Total', 'rubs_building_total')),
      rubsUnitRatio: num(pick(util, 'RUBS Unit Ratio', 'rubs_unit_ratio')),
    };

    const ledgerData = {
      outstandingBalances: num(pick(led, 'Outstanding Balance', 'outstanding_balance', 'Balance')),
      lateFees: num(pick(led, 'Late Fees', 'late_fees')),
      credits: num(pick(led, 'Credits', 'credits')),
      partialPayments: num(pick(led, 'Partial Payments', 'partial_payments')),
      priorCharges: num(pick(led, 'Prior Charges', 'prior_charges')),
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
