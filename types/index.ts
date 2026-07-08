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
  // Optional: last month's building total, so we can flag whether this bill is
  // higher or lower than the previous one. Not used in any calculation.
  prevBuildingTotal?: number;
}

// An uploaded RUBS water bill (image or PDF), stored as a data URL so it
// persists in the localStorage session and can be viewed from the form.
export interface RubsBill {
  name: string;
  type: string;   // MIME type, e.g. "image/jpeg" or "application/pdf"
  dataUrl: string;
}

// Inspection photos uploaded by the property manager, stored as (compressed)
// data URLs so they persist in the localStorage session and render in the form.
export interface InspectionPhotos {
  moveIn: string[];
  moveOut: string[];
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
  inspectionPhotos?: InspectionPhotos;
  // The uploaded RUBS water bill (for RUBS units), kept for reference/records.
  rubsBill?: RubsBill | null;
  // Per-tenant property (an upload can span multiple properties). Falls back to
  // the session-level property when absent (e.g. older sessions / demo data).
  propertyName?: string;
  propertyConfig?: PropertyConfig | null;
}

export interface PropertyConfig {
  code: string;
  name: string;
  address: string;
  utilityType: UtilityType;
  flatFeeRate: number;
  rubsUnitRatio: number;
  nrcCleaningFee: number;
  nrcPetFee: number;
  siteManagerName: string;
  propertyManagerName: string;
}

export interface SessionState {
  propertyName: string;
  uploadDate: string;
  returns: TenantReturn[];
  propertyConfig: PropertyConfig | null;
}
