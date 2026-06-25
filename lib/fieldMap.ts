// Maps internal data model keys to AGM PDF form field IDs.
// Field IDs must match the actual field names in AGM_Checkout_Report.pdf.
// Run: npx pdf-lib-check-fields public/AGM_template.pdf to list actual field names.
export const FIELD_MAP: Record<string, string> = {
  // Header
  propertyName: 'property_name',
  unit: 'unit_number',
  tenantName: 'tenant_name',
  coTenant: 'co_tenant',
  forwardingStreet: 'forwarding_address',
  forwardingCity: 'forwarding_city',
  forwardingState: 'forwarding_state',
  forwardingZip: 'forwarding_zip',

  // Lease summary
  monthlyRent: 'monthly_rent',
  nrcCleaningFee: 'nrc_cleaning_fee',
  nrcPetFee: 'nrc_pet_fee',
  moveInDate: 'move_in_date',
  moveOutDate: 'move_out_date',
  paidThroughDate: 'paid_through_date',
  noticeDate: 'notice_date',
  leaseBreakYes: 'lease_break_yes',
  leaseBreakNo: 'lease_break_no',
  newTenantMoveInDate: 'new_tenant_move_in_date',
  finalCheckbox: 'final_checkbox',

  // Charges — Total Cost column
  generalCleaningTotal: 'general_cleaning_total',
  blindDrapeCleaningTotal: 'blind_drape_cleaning_total',
  windowCoveringReplacementTotal: 'window_covering_replacement_total',
  carpetShampooingTotal: 'carpet_shampooing_total',
  flooringRestorationTotal: 'flooring_restoration_total',
  paintingTotal: 'painting_total',
  other1Total: 'other1_total',
  other2Total: 'other2_total',
  rentDueTotal: 'rent_due_total',
  utilityChargeTotal: 'utility_charge_total',
  legalCourtCostsTotal: 'legal_court_costs_total',
  totalCostsChargesTotal: 'total_costs_charges_total',

  // Charges — Tenant Cost column
  generalCleaningTenant: 'general_cleaning_tenant',
  blindDrapeCleaningTenant: 'blind_drape_cleaning_tenant',
  windowCoveringReplacementTenant: 'window_covering_replacement_tenant',
  carpetShampooingTenant: 'carpet_shampooing_tenant',
  flooringRestorationTenant: 'flooring_restoration_tenant',
  paintingTenant: 'painting_tenant',
  other1Tenant: 'other1_tenant',
  other2Tenant: 'other2_tenant',
  rentDueTenant: 'rent_due_tenant',
  rentDueDateRange: 'rent_due_date_range',
  utilityChargeTenant: 'utility_charge_tenant',
  utilityDueAsNoted: 'utility_due_as_noted',
  legalCourtCostsTenant: 'legal_court_costs_tenant',
  totalCostsChargesTenant: 'total_costs_charges_tenant',

  // Refunds / Credits
  securityDepositPaid: 'security_deposit_paid',
  otherDepositsPaid: 'other_deposits_paid',
  rentRefundDue: 'rent_refund_due',
  otherRefunds: 'other_refunds',
  totalCredits: 'total_credits',

  // Balance row
  balanceZero: 'balance_zero_checkbox',
  balanceDueToTenant: 'balance_due_to_tenant_checkbox',
  balanceOwingLandlord: 'balance_owing_landlord_checkbox',
  balanceAmount: 'balance_amount',

  // Signatures
  siteManagerDate: 'site_manager_date',
  propertyManagerDate: 'property_manager_date',
  dateMailedToTenant: 'date_mailed_to_tenant',
  mailedBy: 'mailed_by',
};
