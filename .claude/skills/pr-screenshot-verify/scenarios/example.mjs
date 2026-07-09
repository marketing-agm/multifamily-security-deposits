// example.mjs — template scenario. Copy this to the scratchpad, edit `session`
// and `shots` for the surface your PR touches, then run drive.mjs against it.
//
// The driver seeds `session` into sessionStorage before each shot and starts every
// shot at "/". Each shot's `action(page)` drives the real UI via clicks.
import { buildSession, buildReturn, resume, openReturn, gotoStep, openReview } from "./_common.mjs";

export default {
  viewport: { width: 1280, height: 900 },
  // Three returns so a single dashboard shot shows both utility tags, both
  // inspection states, and mixed processing statuses.
  session: buildSession({
    propertyName: "Maple Grove Apartments",
    returns: [
      buildReturn({ id: "101-0", tenantData: { tenantName: "Jane Tenant", unit: "101", inspectionStatus: "signed" }, utilityData: { utilityType: "RUBS" }, processingStatus: "in_progress" }),
      buildReturn({ id: "102-0", tenantData: { tenantName: "Marcus Lee", unit: "102", inspectionStatus: "missing" }, utilityData: { utilityType: "flat_fee", flatFeeRate: 45 }, rubsManualInput: null, processingStatus: "not_started" }),
      buildReturn({ id: "103-0", tenantData: { tenantName: "Nia Okafor", unit: "103", inspectionStatus: "signed" }, utilityData: { utilityType: "RUBS" }, processingStatus: "complete" }),
    ],
  }),
  shots: [
    { name: "01-upload", caption: "Upload screen (resume affordance shown)" },
    { name: "02-dashboard", caption: "Dashboard: 3 returns, RUBS + Flat Fee tags, mixed statuses", action: resume },
    { name: "03-form-utility", caption: "Return form, Utility step (RUBS inputs)",
      action: async (page) => { await resume(page); await openReturn(page, "Jane Tenant"); await gotoStep(page, "Utility"); } },
    { name: "04-review-missing-inspection", caption: "Review screen, inspection-missing warning",
      action: async (page) => { await resume(page); await openReturn(page, "Marcus Lee"); await openReview(page); } },
  ],
};
