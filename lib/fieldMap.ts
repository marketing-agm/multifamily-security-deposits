// Real field names verified from AGM_Checkout_Report.pdf via scripts/listPdfFields.mjs
// Coordinates confirmed — do not edit names without re-running the inspector script.

export const FIELD_MAP = {
  // ── Header ────────────────────────────────────────────────────────────────
  propertyName:           'Property Name',
  unit:                   'Unit',

  // TO: mailing block (top-left)
  tenantName:             'TO 1',
  coTenant:               'TO 2',
  forwardingStreet:       'TO 3',
  forwardingCityStateZip: 'TO 4',   // write "City, State  ZIP" as a single string

  // ── Lease Summary Row ─────────────────────────────────────────────────────
  estimatedCheckbox:      'Check Box24',   // x=461, y=552 — always unchecked
  finalCheckbox:          'Check Box25',   // x=547, y=552 — always checked

  moveInDate:             'Date of Movein',
  moveOutDate:            'Date of Moveout',
  paidThroughDate:        'Paid Rent Through',
  leaseBreakYes:          'Check Box14',   // x=467, y=512
  leaseBreakNo:           'Check Box15',   // x=499, y=512

  monthlyRent:            'fill_41',       // x=36,  y=504
  nrcCleaningFee:         'Text8',         // x=102, y=504
  nrcPetFee:              'Text9',         // x=139, y=504
  noticeDate:             'Notice Date',
  newTenantMoveInDate:    'New Tenant Movein Date',

  // ── Charges Table ─────────────────────────────────────────────────────────
  // Each line: vendor "by" field, Total Cost column (x≈435), Tenant Cost column (x≈516)

  generalCleaningBy:                    'General Cleaning by',
  // condition checkboxes (19/20/21) left for manager to check manually
  generalCleaningTotal:                 'fill_44',
  generalCleaningTenant:                'fill_45',

  blindDrapeCleaningBy:                 'BlindDrape Cleaning by',
  blindDrapeCleaningTotal:              'fill_47',
  blindDrapeCleaningTenant:             'fill_48',

  windowCoveringReplacementBy:          'Replacement of Window Coverings by',
  windowCoveringReplacementTotal:       'fill_50',
  windowCoveringReplacementTenant:      'fill_51',

  carpetShampooingBy:                   'Carpet Shampooing by',
  carpetShampooingTotal:                'fill_53',
  carpetShampooingTenant:               'fill_54',

  flooringRestorationBy:                'RestoreReplacement Flooring by',
  flooringRestorationTotal:             'fill_56',
  flooringRestorationTenant:            'fill_57',

  paintingBy:                           'Text10',          // wide field x=86 w=251
  // painting condition checkboxes (16/17/18) left for manager
  paintingTotal:                        'fill_58',
  paintingTenant:                       'fill_59',

  other1Label:                          'Other ReplacementsRepairsKeys',
  other1Total:                          'fill_61',
  other1Tenant:                         'fill_62',

  other2Label:                          'Other ReplacementsRepairsKeys_2',
  other2Total:                          'fill_64',
  other2Tenant:                         'fill_65',

  // Rent Due — 6 tiny date-component fields (M, D, Y — M, D, Y)
  rentDueFromMonth:       'Rent Due From',
  rentDueFromDay:         'undefined',
  rentDueFromYear:        'undefined_2',
  rentDueToMonth:         'to',
  rentDueToDay:           'undefined_3',
  rentDueToYear:          'undefined_4',
  rentDueTotal:           'fill_66',
  rentDueTenant:          'fill_67',

  // Utility
  utilityDueAsNoted:      'Check Box22',
  utilityTotal:           'fill_68',
  utilityTenant:          'fill_69',

  // Legal / Court Costs
  legalCourtCostsLabel:   'LegalCourt Costs',
  legalCourtCostsTotal:   'fill_71',
  legalCourtCostsTenant:  'fill_72',

  // Totals row
  totalCostsChargesTotal:   'fill_74',
  totalCostsChargesTenant:  'fill_75',

  // ── Credits / Refunds Section ─────────────────────────────────────────────
  // NOTE: undefined_5 and undefined_6 may be printed (non-editable) in some
  // template versions. The filler silently skips missing fields.
  securityDepositPaid:    'undefined_5',   // x=324, y=232
  otherDepositsPaid:      'undefined_6',   // x=360, y=216

  // Rent Refund Due date range (if tenant pre-paid beyond move-out)
  rentRefundDueFromMonth: 'Rent Refund Due',
  rentRefundDueFromDay:   'undefined_7',
  rentRefundDueFromYear:  'undefined_8',
  rentRefundDueToMonth:   'to_2',
  rentRefundDueToDay:     'undefined_9',
  rentRefundDueToYear:    'undefined_10',
  rentRefundDueAmount:    'undefined_12',

  otherRefundsDescription: 'Description of credit/refund',
  totalCredits:             'fill_77',     // x=524, y=168

  // ── Balance Row ───────────────────────────────────────────────────────────
  balanceZero:            'Check Box11',   // x=41,  y=152
  balanceDueToTenant:     'Check Box12',   // x=158, y=152
  balanceOwingLandlord:   'Check Box13',   // x=317, y=152
  balanceAmount:          'fill_79',       // x=516, y=152

  // ── Signatures (filled manually by manager — not auto-populated) ──────────
  siteManagerName:          'Site Manager',
  propertyManagerName:      'Property Manager',
  dateMailedToTenantMonth:  'Date Mailed to Tenant',
  dateMailedToTenantDay:    'undefined_18',
  dateMailedToTenantYear:   'undefined_19',
  mailedBy:                 'by',
} as const;

export type FieldMapKey = keyof typeof FIELD_MAP;
