// components/AgentForm/agentScript.ts
// Scripted conversation state machine for the agent panel.
// Each step has a pre-written message explaining what was auto-filled and calculated.

import { TenantReturn } from '@/types';
import { formatCurrency } from '@/lib/calculations';

export type AgentStep = 'tenant' | 'lease' | 'utility' | 'charges' | 'done';

export interface AgentMessage {
  role: 'agent' | 'user';
  text: string;
}

export const STEP_ORDER: AgentStep[] = ['tenant', 'lease', 'utility', 'charges', 'done'];

export function getOpeningMessage(tr: TenantReturn): string {
  const { tenantData, depositData, utilityData } = tr;
  const utilityLabel = utilityData.utilityType === 'RUBS' ? 'RUBS' : 'Flat fee';
  const inspLabel = tenantData.inspectionStatus === 'signed' ? 'signed ✓' : '⚠️ missing';

  return `I've loaded the data for ${tenantData.tenantName}, Unit ${tenantData.unit}.\n\n` +
    `Security deposit: ${formatCurrency(depositData.securityDeposit)}` +
    (depositData.petDeposit > 0 ? ` · Pet deposit: ${formatCurrency(depositData.petDeposit)}` : '') +
    ` · NRC cleaning fee: ${formatCurrency(depositData.nrcCleaningFee)}\n` +
    `Utility billing: ${utilityLabel} · Move-in inspection: ${inspLabel}\n\n` +
    `I'll walk you through each section now. You can correct anything at any time by typing it in.`;
}

export function getStepMessage(step: AgentStep, tr: TenantReturn): string {
  const { tenantData, depositData, utilityData, calculatedCharges, manualCharges } = tr;

  switch (step) {
    case 'tenant':
      return `**Tenant confirmed.**\n\n` +
        `Name: ${tenantData.tenantName}` +
        (tenantData.coTenant ? ` · Co-tenant: ${tenantData.coTenant}` : '') + `\n` +
        `Unit: ${tenantData.unit} · Forwarding address: ${tenantData.forwardingAddress.street}, ` +
        `${tenantData.forwardingAddress.city} ${tenantData.forwardingAddress.state} ${tenantData.forwardingAddress.zip}\n\n` +
        `Does the forwarding address look correct? Moving on to lease details.`;

    case 'lease': {
      const leaseBreakMsg = tenantData.leaseBreak
        ? `**Lease break detected.** Move-out ${tenantData.moveOutDate} is before lease end ${tenantData.leaseEndDate}.\n` +
          `Rent due formula: days from move-out to lease end × (monthly rent ÷ days in month).\n` +
          `Calculated rent due: **${formatCurrency(calculatedCharges.rentDue)}** (${calculatedCharges.rentDueDateRange})`
        : `No lease break — move-out matches lease end. **Rent due: $0.00**`;

      return `**Lease details auto-filled.**\n\n` +
        `Move-in: ${tenantData.moveInDate} · Move-out: ${tenantData.moveOutDate}\n` +
        `Monthly rent: ${formatCurrency(tenantData.monthlyRent)} · Paid through: ${tenantData.paidThroughDate}\n\n` +
        leaseBreakMsg;
    }

    case 'utility': {
      if (utilityData.utilityType === 'RUBS') {
        return `**Unit ${tenantData.unit} is billed via RUBS** (Ratio Utility Billing System — each unit pays a % of the building's total water bill).\n\n` +
          `Building water bill: ${formatCurrency(utilityData.rubsBuildingTotal)}\n` +
          `Unit ${tenantData.unit} share: ${(utilityData.rubsUnitRatio * 100).toFixed(1)}%\n` +
          `Formula: ${formatCurrency(utilityData.rubsBuildingTotal)} × ${(utilityData.rubsUnitRatio * 100).toFixed(1)}% = **${formatCurrency(calculatedCharges.utilityCharge)}**\n\n` +
          `RUBS chargeback applied: **${formatCurrency(calculatedCharges.utilityCharge)}**. Moving on to turnover charges.`;
      }
      return `**Flat fee utility** — billed monthly with rent. **$0.00 due at move-out.**\n\n` +
        `No water bill needed. Moving on to turnover charges.`;
    }

    case 'charges': {
      const nrcOffset = Math.min(manualCharges.generalCleaning, depositData.nrcCleaningFee);
      const tenantCleaning = Math.max(0, manualCharges.generalCleaning - nrcOffset);
      const lines = [];

      if (manualCharges.generalCleaning > 0) {
        lines.push(`Cleaning: ${formatCurrency(manualCharges.generalCleaning)} total ` +
          `− NRC offset ${formatCurrency(nrcOffset)} = **${formatCurrency(tenantCleaning)} tenant cost**`);
      }
      if (manualCharges.other1 > 0 && manualCharges.other1Label) {
        lines.push(`${manualCharges.other1Label}: **${formatCurrency(manualCharges.other1)}**`);
      }

      return `**Turnover charges loaded.**\n\n` +
        (lines.length > 0 ? lines.join('\n') : 'No damage charges entered.') +
        `\n\nAll fields are now populated. Review the live form on the right, then click Continue to finalize.`;
    }

    case 'done':
      return `All sections complete. Review the summary on the right and proceed to the compliance check and PDF download.`;

    default:
      return '';
  }
}

// Tries to detect simple corrections like "cleaning was $400" or "rent due is 2500"
export function parseUserCorrection(input: string): { field: string; value: number } | null {
  const lower = input.toLowerCase();
  const amountMatch = input.match(/\$?([\d,]+(?:\.\d{1,2})?)/);
  if (!amountMatch) return null;
  const value = parseFloat(amountMatch[1].replace(/,/g, ''));

  if (lower.includes('cleaning')) return { field: 'generalCleaning', value };
  if (lower.includes('rent')) return { field: 'rentDue', value };
  if (lower.includes('utility') || lower.includes('rubs') || lower.includes('water')) return { field: 'utilityCharge', value };
  if (lower.includes('carpet')) return { field: 'carpetShampooing', value };
  if (lower.includes('paint')) return { field: 'painting', value };
  if (lower.includes('key')) return { field: 'other1', value };

  return null;
}
