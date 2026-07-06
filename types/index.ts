export type UtilityType = 'RUBS' | 'flat_fee';
export type FlatFeeBillingMethod = 'included_in_rent' | 'billed_at_moveout';
export type InspectionStatus = 'signed' | 'missing';
export type ProcessingStatus = 'not_started' | 'in_progress' | 'complete';

export interface ForwardingAddress {
  street: string;
  city: string;
  state: string;
  zip: string;
}

export interface TenantData {
  tenantName: string;
  coTenant: string;
  unit: string;
  monthlyRent: number;
  moveInDate: string;
  moveOutDate: string;
  paidThroughDate: string;
  noticeDate: string;
  leaseEndDate: string;
  leaseBreak: boolean;
  newTenantMoveInDate: string | null;
  forwardingAddress: ForwardingAddress;
  inspectionStatus: InspectionStatus;
}

export interface DepositData {
  securityDeposit: number;
  petDeposit: number;
  keyDeposit: number;
  garageOpenerDeposit: number;
  nrcCleaningFee: number;
  nrcPetFee: number;
}

export interface UtilityData {
  utilityType: UtilityType;
  flatFeeRate: number;
  flatFeeBillingMethod: FlatFeeBillingMethod;
  rubsBuildingTotal: number;
  rubsUnitRatio: number;
}

export interface LedgerData {
  outstandingBalances: number;
  lateFees: number;
  credits: number;
  partialPayments: number;
  priorCharges: number;
}

export interface ManualCharges {
  generalCleaning: number;
  blindDrapeCleaning: number;
  windowCoveringReplacement: number;
  carpetShampooing: number;
  flooringRestoration: number;
  painting: number;
  other1Label: string;
  other1: number;
  other2Label: string;
  other2: number;
  legalCourtCosts: number;
}

export interface CalculatedCharges {
  rentDue: number;
  rentDueDateRange: string;
  utilityCharge: number;
}

export interface RUBSManualInput {
  buildingTotal: number;
  unitRatio: number;
}

export interface TenantReturn {
  id: string;
  tenantData: TenantData;
  depositData: DepositData;
  utilityData: UtilityData;
  ledgerData: LedgerData;
  manualCharges: ManualCharges;
  calculatedCharges: CalculatedCharges;
  rubsManualInput: RUBSManualInput | null;
  processingStatus: ProcessingStatus;
  complianceChecked: boolean;
  pdfGenerated: boolean;
}

export interface SessionState {
  propertyName: string;
  uploadDate: string;
  returns: TenantReturn[];
}

// ── Admin settings ───────────────────────────────────────────
// These are app-wide configuration values (not tied to a single upload).
// They live in their own localStorage store so they survive "Start new upload".

// How strict the review step is before a checkout PDF can be generated.
//  - 'off'  : no review step at all
//  - 'soft' : the compliance review is shown, but it never blocks the PDF
//  - 'hard' : the PDF stays locked until the return has been reviewed
// (This mirrors the "Off / Soft / Hard" review gates in the Report Studio admin panel.)
export type ReviewGateLevel = 'off' | 'soft' | 'hard';

// Company-standard default dollar amounts for common move-out charges.
// A user can still override these per tenant on the return form — these are
// just the starting numbers so nobody has to retype the usual figures.
export interface DefaultCharges {
  generalCleaning: number;
  carpetShampooing: number;
  blindDrapeCleaning: number;
  painting: number;
}

export interface AdminSettings {
  // The legal window (in days) to return a deposit. California = 21 days.
  deadlineDays: number;
  // When true we use the statutory 21 days automatically; false = manual override.
  deadlineDaysIsAuto: boolean;
  // How strict the pre-PDF review is (see ReviewGateLevel above).
  reviewGate: ReviewGateLevel;
  // Default charge amounts (see DefaultCharges above).
  defaultCharges: DefaultCharges;
}
