// lib/dummyData.ts
// Realistic 5-tenant demo session for Westlake Commons, June 2026 move-outs.
// Used by the "Load demo data" button on the upload page.

import { SessionState, TenantReturn } from '@/types';
import { computeCalculatedCharges } from './calculations';

// Builds a TenantReturn, computing calculatedCharges automatically so the
// numbers are always consistent with the calculation logic in calculations.ts.
function makeReturn(partial: Omit<TenantReturn, 'calculatedCharges'>): TenantReturn {
  return { ...partial, calculatedCharges: computeCalculatedCharges(partial) };
}

export const DUMMY_SESSION: SessionState = {
  propertyName: 'Westlake Commons',
  uploadDate: '06/28/2026',
  returns: [

    // ── Unit 204B — Sarah L. Mitchell ──────────────────────────────────────
    // RUBS utility, lease break (moved out early, owes rent until new tenant).
    // Has NRC cleaning fee on file that offsets the cleaning charge.
    makeReturn({
      id: '204B-0',
      processingStatus: 'in_progress',
      complianceChecked: false,
      pdfGenerated: false,
      rubsManualInput: { buildingTotal: 1240, unitRatio: 0.083 },
      tenantData: {
        tenantName: 'Sarah L. Mitchell',
        coTenant: '',
        unit: '204B',
        monthlyRent: 1724,
        moveInDate: '2023-03-01',
        moveOutDate: '2026-06-24',
        paidThroughDate: '2026-06-24',
        noticeDate: '2026-05-24',
        leaseEndDate: '2026-07-27',
        leaseBreak: true,
        newTenantMoveInDate: '2026-07-27',
        forwardingAddress: { street: '412 Elmwood Dr', city: 'Kirkland', state: 'WA', zip: '98033' },
        inspectionStatus: 'signed',
      },
      depositData: {
        securityDeposit: 1850,
        petDeposit: 300,
        keyDeposit: 0,
        garageOpenerDeposit: 0,
        nrcCleaningFee: 250,
        nrcPetFee: 0,
      },
      utilityData: {
        utilityType: 'RUBS',
        flatFeeRate: 0,
        flatFeeBillingMethod: 'billed_at_moveout',
        rubsBuildingTotal: 1240,
        rubsUnitRatio: 0.083,
      },
      ledgerData: { outstandingBalances: 0, lateFees: 0, credits: 0, partialPayments: 0, priorCharges: 0 },
      manualCharges: {
        generalCleaning: 250,
        blindDrapeCleaning: 0,
        windowCoveringReplacement: 0,
        carpetShampooing: 120,
        flooringRestoration: 0,
        painting: 150,
        other1Label: 'Key replacement',
        other1: 50,
        other2Label: 'Other',
        other2: 0,
        legalCourtCosts: 0,
      },
    }),

    // ── Unit 205C — Jordan K. Patel ────────────────────────────────────────
    // Flat-fee utility, normal move-out (no lease break). Co-tenant on file.
    makeReturn({
      id: '205C-1',
      processingStatus: 'not_started',
      complianceChecked: false,
      pdfGenerated: false,
      rubsManualInput: null,
      tenantData: {
        tenantName: 'Jordan K. Patel',
        coTenant: 'Anika Patel',
        unit: '205C',
        monthlyRent: 1450,
        moveInDate: '2024-01-15',
        moveOutDate: '2026-06-30',
        paidThroughDate: '2026-06-30',
        noticeDate: '2026-06-01',
        leaseEndDate: '2026-06-30',
        leaseBreak: false,
        newTenantMoveInDate: null,
        forwardingAddress: { street: '88 Pine St Apt 4', city: 'Seattle', state: 'WA', zip: '98101' },
        inspectionStatus: 'signed',
      },
      depositData: {
        securityDeposit: 500,
        petDeposit: 0,
        keyDeposit: 0,
        garageOpenerDeposit: 0,
        nrcCleaningFee: 150,
        nrcPetFee: 0,
      },
      utilityData: {
        utilityType: 'flat_fee',
        flatFeeRate: 65,
        flatFeeBillingMethod: 'billed_at_moveout',
        rubsBuildingTotal: 0,
        rubsUnitRatio: 0,
      },
      ledgerData: { outstandingBalances: 0, lateFees: 0, credits: 0, partialPayments: 0, priorCharges: 0 },
      manualCharges: {
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
      },
    }),

    // ── Unit 312D — Priya S. Nair ──────────────────────────────────────────
    // RUBS utility. ⚠ Move-in inspection missing — this weakens our position
    // in small claims if the tenant disputes any damage charges.
    // Also has $75 in outstanding late fees on the ledger.
    // No forwarding address on file yet.
    makeReturn({
      id: '312D-2',
      processingStatus: 'not_started',
      complianceChecked: false,
      pdfGenerated: false,
      rubsManualInput: { buildingTotal: 1240, unitRatio: 0.091 },
      tenantData: {
        tenantName: 'Priya S. Nair',
        coTenant: '',
        unit: '312D',
        monthlyRent: 1600,
        moveInDate: '2022-08-01',
        moveOutDate: '2026-07-01',
        paidThroughDate: '2026-06-30',
        noticeDate: '2026-06-01',
        leaseEndDate: '2026-07-31',
        leaseBreak: false,
        newTenantMoveInDate: null,
        forwardingAddress: { street: '', city: '', state: '', zip: '' },
        inspectionStatus: 'missing',
      },
      depositData: {
        securityDeposit: 1600,
        petDeposit: 0,
        keyDeposit: 0,
        garageOpenerDeposit: 0,
        nrcCleaningFee: 200,
        nrcPetFee: 0,
      },
      utilityData: {
        utilityType: 'RUBS',
        flatFeeRate: 0,
        flatFeeBillingMethod: 'billed_at_moveout',
        rubsBuildingTotal: 1240,
        rubsUnitRatio: 0.091,
      },
      ledgerData: { outstandingBalances: 75, lateFees: 75, credits: 0, partialPayments: 0, priorCharges: 0 },
      manualCharges: {
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
      },
    }),

    // ── Unit 108A — Damien R. Cruz ─────────────────────────────────────────
    // Flat-fee utility, normal move-out. Already complete — shows what a
    // finished return looks like in the dashboard.
    makeReturn({
      id: '108A-3',
      processingStatus: 'complete',
      complianceChecked: true,
      pdfGenerated: true,
      rubsManualInput: null,
      tenantData: {
        tenantName: 'Damien R. Cruz',
        coTenant: '',
        unit: '108A',
        monthlyRent: 1200,
        moveInDate: '2021-05-01',
        moveOutDate: '2026-06-28',
        paidThroughDate: '2026-06-28',
        noticeDate: '2026-05-28',
        leaseEndDate: '2026-06-28',
        leaseBreak: false,
        newTenantMoveInDate: null,
        forwardingAddress: { street: '2201 NE 45th St', city: 'Seattle', state: 'WA', zip: '98105' },
        inspectionStatus: 'signed',
      },
      depositData: {
        securityDeposit: 1200,
        petDeposit: 250,
        keyDeposit: 0,
        garageOpenerDeposit: 0,
        nrcCleaningFee: 150,
        nrcPetFee: 250,
      },
      utilityData: {
        utilityType: 'flat_fee',
        flatFeeRate: 55,
        flatFeeBillingMethod: 'billed_at_moveout',
        rubsBuildingTotal: 0,
        rubsUnitRatio: 0,
      },
      ledgerData: { outstandingBalances: 0, lateFees: 0, credits: 0, partialPayments: 0, priorCharges: 0 },
      manualCharges: {
        generalCleaning: 150,
        blindDrapeCleaning: 0,
        windowCoveringReplacement: 0,
        carpetShampooing: 85,
        flooringRestoration: 0,
        painting: 0,
        other1Label: 'Other',
        other1: 0,
        other2Label: 'Other',
        other2: 0,
        legalCourtCosts: 0,
      },
    }),

    // ── Unit 410E — Yuki Tanaka ────────────────────────────────────────────
    // RUBS utility, lease break. Co-tenant on file. Garage opener + key
    // deposits held. Large unit — higher RUBS share (11.2%).
    makeReturn({
      id: '410E-4',
      processingStatus: 'not_started',
      complianceChecked: false,
      pdfGenerated: false,
      rubsManualInput: { buildingTotal: 1240, unitRatio: 0.112 },
      tenantData: {
        tenantName: 'Yuki Tanaka',
        coTenant: 'Kenji Tanaka',
        unit: '410E',
        monthlyRent: 2200,
        moveInDate: '2020-11-01',
        moveOutDate: '2026-07-05',
        paidThroughDate: '2026-06-30',
        noticeDate: '2026-05-15',
        leaseEndDate: '2026-09-01',
        leaseBreak: true,
        newTenantMoveInDate: '2026-08-01',
        forwardingAddress: { street: '770 Bellevue Way NE', city: 'Bellevue', state: 'WA', zip: '98004' },
        inspectionStatus: 'signed',
      },
      depositData: {
        securityDeposit: 2200,
        petDeposit: 0,
        keyDeposit: 50,
        garageOpenerDeposit: 75,
        nrcCleaningFee: 300,
        nrcPetFee: 0,
      },
      utilityData: {
        utilityType: 'RUBS',
        flatFeeRate: 0,
        flatFeeBillingMethod: 'billed_at_moveout',
        rubsBuildingTotal: 1240,
        rubsUnitRatio: 0.112,
      },
      ledgerData: { outstandingBalances: 0, lateFees: 0, credits: 0, partialPayments: 0, priorCharges: 0 },
      manualCharges: {
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
      },
    }),

  ],
};
