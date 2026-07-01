import { test } from "node:test";
import assert from "node:assert/strict";
import { buildReturn, buildSession } from "../scenarios/_common.mjs";

const TENANT_RETURN_KEYS = [
  "id", "tenantData", "depositData", "utilityData", "ledgerData",
  "manualCharges", "calculatedCharges", "rubsManualInput",
  "processingStatus", "complianceChecked", "pdfGenerated",
];

test("buildReturn returns a complete TenantReturn with all keys", () => {
  const r = buildReturn();
  for (const k of TENANT_RETURN_KEYS) assert.ok(k in r, `missing key: ${k}`);
  assert.equal(r.id, "101-0");
  assert.equal(r.utilityData.utilityType, "RUBS");
  assert.equal(typeof r.tenantData.forwardingAddress.zip, "string");
});

test("buildReturn deep-merges overrides without dropping sibling fields", () => {
  const r = buildReturn({
    id: "102-0",
    tenantData: { tenantName: "Marcus Lee", inspectionStatus: "missing" },
    utilityData: { utilityType: "flat_fee", flatFeeRate: 45 },
  });
  assert.equal(r.id, "102-0");
  assert.equal(r.tenantData.tenantName, "Marcus Lee");
  assert.equal(r.tenantData.inspectionStatus, "missing");
  // sibling fields survive the merge:
  assert.equal(typeof r.tenantData.unit, "string");
  assert.equal(r.utilityData.utilityType, "flat_fee");
  assert.equal(r.utilityData.flatFeeRate, 45);
  assert.equal(typeof r.utilityData.rubsBuildingTotal, "number");
});

test("buildSession wraps returns into a SessionState", () => {
  const s = buildSession({ returns: [buildReturn(), buildReturn({ id: "102-0" })] });
  assert.ok(typeof s.propertyName === "string");
  assert.ok(typeof s.uploadDate === "string");
  assert.equal(s.returns.length, 2);
  assert.equal(s.returns[1].id, "102-0");
});
