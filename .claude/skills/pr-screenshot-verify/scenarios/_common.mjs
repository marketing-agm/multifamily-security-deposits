// _common.mjs — fixture builders + UI-navigation helpers for pr-screenshot-verify.
//
// buildReturn/buildSession produce a valid in-memory session matching types/index.ts,
// which the driver seeds into localStorage['agm_deposit_session']. This is also the
// single place to update if the app's internal TenantReturn shape changes.

// A complete, valid TenantReturn with sensible defaults.
export function buildReturn(overrides = {}) {
  const base = {
    id: "101-0",
    tenantData: {
      tenantName: "Jane Tenant", coTenant: "", unit: "101", monthlyRent: 1800,
      moveInDate: "2023-06-01", moveOutDate: "2026-06-15", paidThroughDate: "2026-06-15",
      noticeDate: "2026-05-10", leaseEndDate: "2026-06-30", leaseBreak: false,
      newTenantMoveInDate: null,
      forwardingAddress: { street: "742 Evergreen Terrace", city: "Springfield", state: "OR", zip: "97477" },
      inspectionStatus: "signed",
    },
    depositData: { securityDeposit: 1800, petDeposit: 300, keyDeposit: 0, garageOpenerDeposit: 0, nrcCleaningFee: 150, nrcPetFee: 0 },
    utilityData: { utilityType: "RUBS", flatFeeRate: 0, flatFeeBillingMethod: "included_in_rent", rubsBuildingTotal: 2400, rubsUnitRatio: 0.08 },
    ledgerData: { outstandingBalances: 0, lateFees: 0, credits: 0, partialPayments: 0, priorCharges: 0 },
    manualCharges: { generalCleaning: 0, blindDrapeCleaning: 0, windowCoveringReplacement: 0, carpetShampooing: 0, flooringRestoration: 0, painting: 0, other1Label: "Other", other1: 0, other2Label: "Other", other2: 0, legalCourtCosts: 0 },
    calculatedCharges: { rentDue: 0, rentDueDateRange: "", utilityCharge: 0 },
    rubsManualInput: { buildingTotal: 2400, unitRatio: 0.08 },
    processingStatus: "in_progress",
    complianceChecked: false,
    pdfGenerated: false,
  };
  const o = overrides;
  return {
    ...base, ...o,
    tenantData: {
      ...base.tenantData, ...(o.tenantData || {}),
      forwardingAddress: { ...base.tenantData.forwardingAddress, ...((o.tenantData || {}).forwardingAddress || {}) },
    },
    depositData: { ...base.depositData, ...(o.depositData || {}) },
    utilityData: { ...base.utilityData, ...(o.utilityData || {}) },
    ledgerData: { ...base.ledgerData, ...(o.ledgerData || {}) },
    manualCharges: { ...base.manualCharges, ...(o.manualCharges || {}) },
    calculatedCharges: { ...base.calculatedCharges, ...(o.calculatedCharges || {}) },
  };
}

export function buildSession({ propertyName = "Maple Grove Apartments", uploadDate = "7/1/2026", returns } = {}) {
  return { propertyName, uploadDate, returns: returns || [buildReturn()] };
}

// --- UI navigation helpers (Playwright) ---------------------------------------
// The driver starts each shot at "/", so these click through the real app.

// From "/", click the resume affordance -> land on the dashboard.
export async function resume(page) {
  await page.getByRole("button", { name: /Resume session/ }).click();
  await page.getByRole("button", { name: "Start new upload" }).waitFor();
}

// From the dashboard, open a tenant's return form by clicking their row.
export async function openReturn(page, tenantName) {
  await page.getByText(tenantName).first().click();
  await page.getByRole("button", { name: "Tenant" }).waitFor(); // step bar present
}

// In the return form, jump to a step tab by its label (e.g. "Utility", "Submit").
export async function gotoStep(page, label) {
  await page.getByRole("button", { name: label, exact: false }).first().click();
}

// From the return form, go to the review screen (via the Submit step's button).
export async function openReview(page) {
  await gotoStep(page, "Submit");
  await page.getByRole("button", { name: /Go to Review/ }).click();
  await page.waitForURL(/\/review\//);
}
