import { TenantReturn, UtilityData, FlatFeeBillingMethod } from '@/types';

export function daysInMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

export function daysBetween(start: Date, end: Date): number {
  const ms = 1000 * 60 * 60 * 24;
  return Math.round((end.getTime() - start.getTime()) / ms);
}

export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function calcDailyRent(monthlyRent: number, moveOutDate: Date): number {
  return monthlyRent / daysInMonth(moveOutDate);
}

export function calcRentDue(
  monthlyRent: number,
  moveOutDate: Date,
  leaseBreak: boolean,
  newTenantMoveInDate: Date | null,
  leaseEndDate: Date
): { amount: number; dateRange: string } {
  if (!leaseBreak) return { amount: 0, dateRange: '' };

  const daily = calcDailyRent(monthlyRent, moveOutDate);

  if (newTenantMoveInDate) {
    const days = daysBetween(moveOutDate, newTenantMoveInDate);
    if (days <= 0) return { amount: 0, dateRange: '' };
    const amount = daily * days;
    return {
      amount,
      dateRange: `${formatDate(moveOutDate)} – ${formatDate(newTenantMoveInDate)}`,
    };
  }

  // No new tenant — charge through lease end
  const days = daysBetween(moveOutDate, leaseEndDate);
  if (days <= 0) return { amount: 0, dateRange: '' };
  return {
    amount: daily * days,
    dateRange: `${formatDate(moveOutDate)} – ${formatDate(leaseEndDate)}`,
  };
}

export function calcFlatFeeUtility(
  utilityData: UtilityData,
  moveOutDate: Date,
  leaseBreak: boolean,
  newTenantMoveInDate: Date | null,
  leaseEndDate: Date
): number {
  if (utilityData.flatFeeBillingMethod === 'included_in_rent') return 0;

  const rate = utilityData.flatFeeRate;
  const totalDays = daysInMonth(moveOutDate);
  const dayOfMonth = moveOutDate.getDate();

  if (!leaseBreak) {
    // Normal move-out — full month utility
    return rate;
  }

  if (newTenantMoveInDate) {
    // Lease break, new tenant — pro-rate to move-out date
    return (rate / totalDays) * dayOfMonth;
  }

  // Lease break, no new tenant — charge through lease end
  const daysFromMoveOutToLeaseEnd = daysBetween(moveOutDate, leaseEndDate);
  const totalOccupied = dayOfMonth + daysFromMoveOutToLeaseEnd;
  // Cap at one month to avoid over-charging
  return (rate / totalDays) * Math.min(totalOccupied, totalDays);
}

export function calcRUBSCharge(buildingTotal: number, unitRatio: number): number {
  return buildingTotal * unitRatio;
}

export function calcNRCOffset(cleaningCost: number, nrcPaid: number): number {
  return Math.max(0, cleaningCost - nrcPaid);
}

export function calcTotalCharges(t: TenantReturn): number {
  const { manualCharges, calculatedCharges, depositData } = t;
  const cleaningTenant = calcNRCOffset(manualCharges.generalCleaning, depositData.nrcCleaningFee);
  return (
    cleaningTenant +
    manualCharges.blindDrapeCleaning +
    manualCharges.windowCoveringReplacement +
    manualCharges.carpetShampooing +
    manualCharges.flooringRestoration +
    manualCharges.painting +
    manualCharges.other1 +
    manualCharges.other2 +
    manualCharges.legalCourtCosts +
    calculatedCharges.rentDue +
    calculatedCharges.utilityCharge
  );
}

export function calcTotalCredits(t: TenantReturn): number {
  const { depositData } = t;
  return (
    depositData.securityDeposit +
    depositData.petDeposit +
    depositData.keyDeposit +
    depositData.garageOpenerDeposit
  );
}

export function calcBalance(t: TenantReturn): number {
  return calcTotalCredits(t) - calcTotalCharges(t);
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });
}

export function computeCalculatedCharges(t: Omit<TenantReturn, 'calculatedCharges'>): TenantReturn['calculatedCharges'] {
  const moveOut = parseISODate(t.tenantData.moveOutDate);
  const leaseEnd = parseISODate(t.tenantData.leaseEndDate);
  const newTenantIn = t.tenantData.newTenantMoveInDate ? parseISODate(t.tenantData.newTenantMoveInDate) : null;
  const leaseBreak = t.tenantData.leaseBreak;

  const rentResult = calcRentDue(t.tenantData.monthlyRent, moveOut, leaseBreak, newTenantIn, leaseEnd);

  let utilityCharge = 0;
  if (t.utilityData.utilityType === 'flat_fee') {
    utilityCharge = calcFlatFeeUtility(t.utilityData, moveOut, leaseBreak, newTenantIn, leaseEnd);
  } else if (t.rubsManualInput) {
    utilityCharge = calcRUBSCharge(t.rubsManualInput.buildingTotal, t.rubsManualInput.unitRatio);
  }

  return {
    rentDue: rentResult.amount,
    rentDueDateRange: rentResult.dateRange,
    utilityCharge,
  };
}
