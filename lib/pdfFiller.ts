import { PDFDocument, PDFCheckBox, PDFTextField } from 'pdf-lib';
import { TenantReturn, PropertyConfig } from '@/types';
import { FIELD_MAP } from './fieldMap';
import { calcNRCOffset, calcTotalCharges, calcTotalCredits, calcBalance } from './calculations';

// Money for the PDF: 2 decimals, thousands separators, and NO "$" — the AGM
// template already prints a "$" in each currency cell, so adding one here would
// render "$$0.00". Always shows two decimals (0 → "0.00").
function money(n: number): string {
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);
}

function setText(form: ReturnType<PDFDocument['getForm']>, fieldName: string, value: string): void {
  try {
    const field = form.getField(fieldName);
    if (field instanceof PDFTextField) field.setText(value);
  } catch {
    // Field not present in this template version — silently skip.
  }
}

function setCheck(form: ReturnType<PDFDocument['getForm']>, fieldName: string, checked: boolean): void {
  try {
    const field = form.getField(fieldName);
    if (field instanceof PDFCheckBox) {
      if (checked) field.check();
      else field.uncheck();
    }
  } catch {
    // Field not present — silently skip.
  }
}

// Split "YYYY-MM-DD" into { month, day, year } strings for the tiny date-component fields.
function dateParts(iso: string | null): { month: string; day: string; year: string } {
  if (!iso) return { month: '', day: '', year: '' };
  const [y, m, d] = iso.split('-');
  return { month: String(parseInt(m, 10)), day: String(parseInt(d, 10)), year: y };
}

// Currency cell value — always two decimals, no "$" (see money() above).
function amt(n: number): string {
  return money(n);
}

export async function fillAGMCheckoutPDF(
  templateBytes: ArrayBuffer,
  tr: TenantReturn,
  propertyName: string,
  propertyConfig?: PropertyConfig | null,
): Promise<{ filled: Uint8Array; populated: number }> {
  const pdfDoc = await PDFDocument.load(templateBytes);
  const form = pdfDoc.getForm();

  const { tenantData: t, depositData: dep, manualCharges: mc, calculatedCharges: cc } = tr;
  const totalCharges  = calcTotalCharges(tr);
  const totalCredits  = calcTotalCredits(tr);
  const balance       = calcBalance(tr);
  const cleaningTenant = calcNRCOffset(mc.generalCleaning, dep.nrcCleaningFee);
  const otherDeposits  = dep.petDeposit + dep.keyDeposit + dep.garageOpenerDeposit;

  // ── Header ────────────────────────────────────────────────────────────────
  setText(form, FIELD_MAP.propertyName, propertyName);
  setText(form, FIELD_MAP.unit, t.unit);
  if (propertyConfig?.siteManagerName) {
    setText(form, FIELD_MAP.siteManagerName, propertyConfig.siteManagerName);
  }
  if (propertyConfig?.propertyManagerName) {
    setText(form, FIELD_MAP.propertyManagerName, propertyConfig.propertyManagerName);
  }

  // Mailing TO: block
  setText(form, FIELD_MAP.tenantName, t.tenantName);
  setText(form, FIELD_MAP.coTenant, t.coTenant);
  setText(form, FIELD_MAP.forwardingStreet, t.forwardingAddress.street);
  const cityStateZip = [t.forwardingAddress.city, t.forwardingAddress.state, t.forwardingAddress.zip]
    .filter(Boolean).join(', ');
  setText(form, FIELD_MAP.forwardingCityStateZip, cityStateZip);

  // ── Lease Summary ─────────────────────────────────────────────────────────
  setCheck(form, FIELD_MAP.estimatedCheckbox, false);
  setCheck(form, FIELD_MAP.finalCheckbox,     true);

  setText(form, FIELD_MAP.moveInDate,          t.moveInDate);
  setText(form, FIELD_MAP.moveOutDate,         t.moveOutDate);
  setText(form, FIELD_MAP.paidThroughDate,     t.paidThroughDate);
  setText(form, FIELD_MAP.noticeDate,          t.noticeDate);
  setCheck(form, FIELD_MAP.leaseBreakYes,      t.leaseBreak);
  setCheck(form, FIELD_MAP.leaseBreakNo,       !t.leaseBreak);
  setText(form, FIELD_MAP.newTenantMoveInDate, t.newTenantMoveInDate ?? '');

  setText(form, FIELD_MAP.monthlyRent,   money(t.monthlyRent));
  setText(form, FIELD_MAP.nrcCleaningFee, dep.nrcCleaningFee > 0 ? money(dep.nrcCleaningFee) : '');
  setText(form, FIELD_MAP.nrcPetFee,      dep.nrcPetFee > 0 ? money(dep.nrcPetFee) : '');

  // ── Charges Table ─────────────────────────────────────────────────────────
  setText(form, FIELD_MAP.generalCleaningTotal,   amt(mc.generalCleaning));
  setText(form, FIELD_MAP.generalCleaningTenant,  amt(cleaningTenant));

  setText(form, FIELD_MAP.blindDrapeCleaningTotal,  amt(mc.blindDrapeCleaning));
  setText(form, FIELD_MAP.blindDrapeCleaningTenant, amt(mc.blindDrapeCleaning));

  setText(form, FIELD_MAP.windowCoveringReplacementTotal,  amt(mc.windowCoveringReplacement));
  setText(form, FIELD_MAP.windowCoveringReplacementTenant, amt(mc.windowCoveringReplacement));

  setText(form, FIELD_MAP.carpetShampooingTotal,  amt(mc.carpetShampooing));
  setText(form, FIELD_MAP.carpetShampooingTenant, amt(mc.carpetShampooing));

  setText(form, FIELD_MAP.flooringRestorationTotal,  amt(mc.flooringRestoration));
  setText(form, FIELD_MAP.flooringRestorationTenant, amt(mc.flooringRestoration));

  setText(form, FIELD_MAP.paintingTotal,  amt(mc.painting));
  setText(form, FIELD_MAP.paintingTenant, amt(mc.painting));

  // Other 1
  setText(form, FIELD_MAP.other1Label,  mc.other1 > 0 ? mc.other1Label : '');
  setText(form, FIELD_MAP.other1Total,  amt(mc.other1));
  setText(form, FIELD_MAP.other1Tenant, amt(mc.other1));

  // Other 2
  setText(form, FIELD_MAP.other2Label,  mc.other2 > 0 ? mc.other2Label : '');
  setText(form, FIELD_MAP.other2Total,  amt(mc.other2));
  setText(form, FIELD_MAP.other2Tenant, amt(mc.other2));

  // Rent Due — split date range into 6 component fields
  if (cc.rentDue > 0 && cc.rentDueDateRange) {
    const [fromPart, toPart] = cc.rentDueDateRange.split('–').map(s => s.trim());
    // rentDueDateRange is stored as ISO dates in calculations; pdfFiller converts here
    const fromISO = parseLocalDate(fromPart);
    const toISO   = parseLocalDate(toPart);
    const from = dateParts(fromISO);
    const to   = dateParts(toISO);
    setText(form, FIELD_MAP.rentDueFromMonth, from.month);
    setText(form, FIELD_MAP.rentDueFromDay,   from.day);
    setText(form, FIELD_MAP.rentDueFromYear,  from.year);
    setText(form, FIELD_MAP.rentDueToMonth,   to.month);
    setText(form, FIELD_MAP.rentDueToDay,     to.day);
    setText(form, FIELD_MAP.rentDueToYear,    to.year);
  }
  setText(form, FIELD_MAP.rentDueTotal,   amt(cc.rentDue));
  setText(form, FIELD_MAP.rentDueTenant,  amt(cc.rentDue));

  // Utility
  setCheck(form, FIELD_MAP.utilityDueAsNoted, cc.utilityCharge > 0);
  setText(form, FIELD_MAP.utilityTotal,   amt(cc.utilityCharge));
  setText(form, FIELD_MAP.utilityTenant,  amt(cc.utilityCharge));

  // Legal / Court Costs
  setText(form, FIELD_MAP.legalCourtCostsTotal,   amt(mc.legalCourtCosts));
  setText(form, FIELD_MAP.legalCourtCostsTenant,  amt(mc.legalCourtCosts));

  // Totals
  setText(form, FIELD_MAP.totalCostsChargesTotal,   money(totalCharges));
  setText(form, FIELD_MAP.totalCostsChargesTenant,  money(totalCharges));

  // ── Credits ───────────────────────────────────────────────────────────────
  setText(form, FIELD_MAP.securityDepositPaid, money(dep.securityDeposit));
  setText(form, FIELD_MAP.otherDepositsPaid,   otherDeposits > 0 ? money(otherDeposits) : '');
  setText(form, FIELD_MAP.totalCredits,         money(totalCredits));

  // ── Balance ───────────────────────────────────────────────────────────────
  setCheck(form, FIELD_MAP.balanceZero,          balance === 0);
  setCheck(form, FIELD_MAP.balanceDueToTenant,   balance > 0);
  setCheck(form, FIELD_MAP.balanceOwingLandlord, balance < 0);
  setText(form, FIELD_MAP.balanceAmount, money(Math.abs(balance)));

  // ── Auto-filled date ──────────────────────────────────────────────────────
  // Stamp "Date Mailed to Tenant" with today's date (staff can still edit the PDF).
  const today = new Date();
  setText(form, FIELD_MAP.dateMailedToTenantMonth, String(today.getMonth() + 1));
  setText(form, FIELD_MAP.dateMailedToTenantDay,   String(today.getDate()));
  setText(form, FIELD_MAP.dateMailedToTenantYear,  String(today.getFullYear()));

  // Count how many fields ended up with a non-empty / checked value.
  // Use `instanceof` (NOT f.constructor.name) — the production build minifies
  // class names, so name checks silently return 0 filled fields in prod.
  const fields = form.getFields();
  let populated = 0;
  for (const f of fields) {
    try {
      if (f instanceof PDFTextField) {
        const v = f.getText();
        if (v && v.trim()) populated++;
      } else if (f instanceof PDFCheckBox) {
        if (f.isChecked()) populated++;
      }
    } catch {
      // ignore fields we can't inspect
    }
  }

  return { filled: await pdfDoc.save(), populated };
}

// Parse a display date like "3/15/2026" or "2026-03-15" back to ISO "YYYY-MM-DD"
function parseLocalDate(display: string): string {
  if (!display) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(display)) return display;
  // Try M/D/YYYY
  const parts = display.split('/');
  if (parts.length === 3) {
    const [m, d, y] = parts;
    return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
  }
  return display;
}
