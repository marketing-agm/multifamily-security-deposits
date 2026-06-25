import { PDFDocument, PDFCheckBox, PDFTextField } from 'pdf-lib';
import { TenantReturn } from '@/types';
import { FIELD_MAP } from './fieldMap';
import { calcNRCOffset, calcTotalCharges, calcTotalCredits, calcBalance, formatCurrency } from './calculations';

function setTextField(form: ReturnType<PDFDocument['getForm']>, fieldId: string, value: string): void {
  try {
    const field = form.getField(fieldId);
    if (field instanceof PDFTextField) {
      field.setText(value);
    }
  } catch {
    console.warn(`PDF field not found: ${fieldId}`);
  }
}

function setCheckBox(form: ReturnType<PDFDocument['getForm']>, fieldId: string, checked: boolean): void {
  try {
    const field = form.getField(fieldId);
    if (field instanceof PDFCheckBox) {
      if (checked) field.check();
      else field.uncheck();
    }
  } catch {
    console.warn(`PDF checkbox not found: ${fieldId}`);
  }
}

export async function fillAGMCheckoutPDF(
  templateBytes: ArrayBuffer,
  tenantReturn: TenantReturn,
  propertyName: string
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(templateBytes);
  const form = pdfDoc.getForm();

  const { tenantData, depositData, manualCharges, calculatedCharges } = tenantReturn;
  const totalCharges = calcTotalCharges(tenantReturn);
  const totalCredits = calcTotalCredits(tenantReturn);
  const balance = calcBalance(tenantReturn);
  const cleaningTenantCost = calcNRCOffset(manualCharges.generalCleaning, depositData.nrcCleaningFee);
  const otherDeposits = depositData.petDeposit + depositData.keyDeposit + depositData.garageOpenerDeposit;

  // Header
  setTextField(form, FIELD_MAP.propertyName, propertyName);
  setTextField(form, FIELD_MAP.unit, tenantData.unit);
  setTextField(form, FIELD_MAP.tenantName, tenantData.tenantName);
  setTextField(form, FIELD_MAP.coTenant, tenantData.coTenant);
  setTextField(form, FIELD_MAP.forwardingStreet, tenantData.forwardingAddress.street);
  setTextField(form, FIELD_MAP.forwardingCity, tenantData.forwardingAddress.city);
  setTextField(form, FIELD_MAP.forwardingState, tenantData.forwardingAddress.state);
  setTextField(form, FIELD_MAP.forwardingZip, tenantData.forwardingAddress.zip);

  // Lease summary
  setTextField(form, FIELD_MAP.monthlyRent, formatCurrency(tenantData.monthlyRent));
  setTextField(form, FIELD_MAP.nrcCleaningFee, formatCurrency(depositData.nrcCleaningFee));
  setTextField(form, FIELD_MAP.nrcPetFee, formatCurrency(depositData.nrcPetFee));
  setTextField(form, FIELD_MAP.moveInDate, tenantData.moveInDate);
  setTextField(form, FIELD_MAP.moveOutDate, tenantData.moveOutDate);
  setTextField(form, FIELD_MAP.paidThroughDate, tenantData.paidThroughDate);
  setTextField(form, FIELD_MAP.noticeDate, tenantData.noticeDate);
  setCheckBox(form, FIELD_MAP.leaseBreakYes, tenantData.leaseBreak);
  setCheckBox(form, FIELD_MAP.leaseBreakNo, !tenantData.leaseBreak);
  setTextField(form, FIELD_MAP.newTenantMoveInDate, tenantData.newTenantMoveInDate ?? '');
  setCheckBox(form, FIELD_MAP.finalCheckbox, true);

  // Charges — Total Cost
  setTextField(form, FIELD_MAP.generalCleaningTotal, formatCurrency(manualCharges.generalCleaning));
  setTextField(form, FIELD_MAP.blindDrapeCleaningTotal, formatCurrency(manualCharges.blindDrapeCleaning));
  setTextField(form, FIELD_MAP.windowCoveringReplacementTotal, formatCurrency(manualCharges.windowCoveringReplacement));
  setTextField(form, FIELD_MAP.carpetShampooingTotal, formatCurrency(manualCharges.carpetShampooing));
  setTextField(form, FIELD_MAP.flooringRestorationTotal, formatCurrency(manualCharges.flooringRestoration));
  setTextField(form, FIELD_MAP.paintingTotal, formatCurrency(manualCharges.painting));
  setTextField(form, FIELD_MAP.other1Total, formatCurrency(manualCharges.other1));
  setTextField(form, FIELD_MAP.other2Total, formatCurrency(manualCharges.other2));
  setTextField(form, FIELD_MAP.rentDueTotal, formatCurrency(calculatedCharges.rentDue));
  setTextField(form, FIELD_MAP.utilityChargeTotal, formatCurrency(calculatedCharges.utilityCharge));
  setTextField(form, FIELD_MAP.legalCourtCostsTotal, formatCurrency(manualCharges.legalCourtCosts));
  setTextField(form, FIELD_MAP.totalCostsChargesTotal, formatCurrency(totalCharges));

  // Charges — Tenant Cost
  setTextField(form, FIELD_MAP.generalCleaningTenant, formatCurrency(cleaningTenantCost));
  setTextField(form, FIELD_MAP.blindDrapeCleaningTenant, formatCurrency(manualCharges.blindDrapeCleaning));
  setTextField(form, FIELD_MAP.windowCoveringReplacementTenant, formatCurrency(manualCharges.windowCoveringReplacement));
  setTextField(form, FIELD_MAP.carpetShampooingTenant, formatCurrency(manualCharges.carpetShampooing));
  setTextField(form, FIELD_MAP.flooringRestorationTenant, formatCurrency(manualCharges.flooringRestoration));
  setTextField(form, FIELD_MAP.paintingTenant, formatCurrency(manualCharges.painting));
  setTextField(form, FIELD_MAP.other1Tenant, formatCurrency(manualCharges.other1));
  setTextField(form, FIELD_MAP.other2Tenant, formatCurrency(manualCharges.other2));
  setTextField(form, FIELD_MAP.rentDueTenant, formatCurrency(calculatedCharges.rentDue));
  setTextField(form, FIELD_MAP.rentDueDateRange, calculatedCharges.rentDueDateRange);
  setTextField(form, FIELD_MAP.utilityChargeTenant, formatCurrency(calculatedCharges.utilityCharge));
  setCheckBox(form, FIELD_MAP.utilityDueAsNoted, calculatedCharges.utilityCharge > 0);
  setTextField(form, FIELD_MAP.legalCourtCostsTenant, formatCurrency(manualCharges.legalCourtCosts));
  setTextField(form, FIELD_MAP.totalCostsChargesTenant, formatCurrency(totalCharges));

  // Refunds / Credits
  // NOTE: security_deposit_paid and other_deposits_paid may be printed (non-editable) lines
  // in the current PDF template. These calls will silently no-op if those fields don't exist.
  setTextField(form, FIELD_MAP.securityDepositPaid, formatCurrency(depositData.securityDeposit));
  setTextField(form, FIELD_MAP.otherDepositsPaid, formatCurrency(otherDeposits));
  setTextField(form, FIELD_MAP.totalCredits, formatCurrency(totalCredits));

  // Balance
  setCheckBox(form, FIELD_MAP.balanceZero, balance === 0);
  setCheckBox(form, FIELD_MAP.balanceDueToTenant, balance > 0);
  setCheckBox(form, FIELD_MAP.balanceOwingLandlord, balance < 0);
  setTextField(form, FIELD_MAP.balanceAmount, formatCurrency(Math.abs(balance)));

  return pdfDoc.save();
}
