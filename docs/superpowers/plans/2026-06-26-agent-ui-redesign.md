# Agent UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 6-step wizard with a three-screen agent-driven UI — Dashboard, Agent+Live Form, and Review+Submit — using pre-loaded dummy data to simulate an Excel upload.

**Architecture:** Three screens share session state via the existing `SessionContext` and `localStorage`. The Dashboard gains a deadline column. The core screen splits into an `AgentPanel` (scripted chat) and `LiveFormPanel` (color-coded form preview), orchestrated by a state machine in `agentScript.ts`. The Review screen adds a compliance deadline banner.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4. No new packages required.

## Global Constraints

- All routes must export `export const runtime = 'edge'` (Cloudflare Pages requirement)
- Use existing `SessionContext` (`useSession`) for state — do not create new state layers
- Use existing `TenantReturn`, `SessionState` types from `types/index.ts` — do not redefine them
- Tailwind CSS v4 — use inline class names, no `@apply`
- No new npm packages
- All currency formatted with existing `formatCurrency()` from `lib/calculations.ts`
- Dummy data must match the spec: Sarah L. Mitchell, Unit 204B, Westlake Commons

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `lib/dummyData.ts` | Create | Pre-loaded `SessionState` with Sarah L. Mitchell dummy data |
| `lib/deadlineUtils.ts` | Create | 21-day deadline calculation + urgency color logic |
| `components/shared/DeadlineBanner.tsx` | Create | Compliance deadline notice block (Screen 3) |
| `components/shared/DeadlinePill.tsx` | Create | Small days-remaining pill (Dashboard column) |
| `components/Dashboard/index.tsx` | Modify | Add Due Date + Days Left columns |
| `components/AgentForm/agentScript.ts` | Create | Scripted conversation state machine |
| `components/AgentForm/AgentPanel.tsx` | Create | Left chat panel |
| `components/AgentForm/LiveFormPanel.tsx` | Create | Right live form preview panel |
| `components/AgentForm/index.tsx` | Create | Orchestrates both panels + step strip |
| `components/ReviewSubmit/index.tsx` | Create | Review & Submit screen with deadline banner |
| `app/return/[id]/page.tsx` | Modify | Swap `ReturnForm` → `AgentForm` |
| `app/review/[id]/page.tsx` | Modify | Swap `Review` → `ReviewSubmit` |
| `app/page.tsx` | Modify | Seed dummy session on load (dev mode) |

---

## Task 1: Dummy data module + deadline utilities

**Files:**
- Create: `lib/dummyData.ts`
- Create: `lib/deadlineUtils.ts`

**Interfaces:**
- Produces:
  - `DUMMY_SESSION: SessionState` — full session with one `TenantReturn` for Sarah L. Mitchell
  - `getDeadline(moveOutDate: string): Date` — returns move-out + 21 days as a `Date`
  - `getDaysRemaining(moveOutDate: string): number` — positive = days left, negative = overdue
  - `getDeadlineUrgency(daysRemaining: number): 'green' | 'amber' | 'red'` — green >7, amber 4–7, red ≤3 or negative
  - `formatDeadlineDate(moveOutDate: string): string` — returns e.g. "July 15, 2026"

- [ ] **Step 1: Create `lib/dummyData.ts`**

```typescript
// lib/dummyData.ts
// Pre-loaded session simulating an Excel upload for Sarah L. Mitchell, Unit 204B.
// Used for UI mockup until real AppFolio Excel column names are confirmed.

import { SessionState } from '@/types';

export const DUMMY_SESSION: SessionState = {
  propertyName: 'Westlake Commons',
  uploadDate: '2026-06-26',
  returns: [
    {
      id: 'unit-204b-mitchell',
      processingStatus: 'in_progress',
      complianceChecked: false,
      pdfGenerated: false,
      tenantData: {
        tenantName: 'Sarah L. Mitchell',
        coTenant: '',
        unit: '204B',
        monthlyRent: 2800,
        moveInDate: '2023-03-01',
        moveOutDate: '2026-06-24',
        paidThroughDate: '2026-06-24',
        noticeDate: '2026-05-24',
        leaseEndDate: '2026-07-27',
        leaseBreak: true,
        newTenantMoveInDate: null,
        forwardingAddress: {
          street: '412 Elmwood Dr',
          city: 'Kirkland',
          state: 'WA',
          zip: '98033',
        },
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
        flatFeeBillingMethod: 'included_in_rent',
        rubsBuildingTotal: 1240,
        rubsUnitRatio: 0.083,
      },
      ledgerData: {
        outstandingBalances: 0,
        lateFees: 0,
        credits: 0,
        partialPayments: 0,
        priorCharges: 0,
      },
      manualCharges: {
        generalCleaning: 350,
        blindDrapeCleaning: 0,
        windowCoveringReplacement: 0,
        carpetShampooing: 0,
        flooringRestoration: 0,
        painting: 0,
        other1Label: 'Key replacement',
        other1: 50,
        other2Label: '',
        other2: 0,
        legalCourtCosts: 0,
      },
      calculatedCharges: {
        // Lease break: rent due from move-out (06/24) to lease end (07/27) = 33 days
        // $2,800 / 31 days in July... actually: June has 30 days, 6 days remaining in June + 27 days in July
        // Simplified: $2,800 / 30 * 33 = $3,080. Using $2,310 from spec (spec value takes precedence).
        rentDue: 2310,
        rentDueDateRange: '06/24/2026 – 07/27/2026',
        // RUBS: $1,240 * 8.3% = $102.92
        utilityCharge: 102.92,
      },
      rubsManualInput: {
        buildingTotal: 1240,
        unitRatio: 0.083,
      },
    },
    {
      id: 'unit-110a-okafor',
      processingStatus: 'not_started',
      complianceChecked: false,
      pdfGenerated: false,
      tenantData: {
        tenantName: 'James R. Okafor',
        coTenant: 'Dana K. Ng',
        unit: '110A',
        monthlyRent: 2200,
        moveInDate: '2024-01-15',
        moveOutDate: '2026-06-30',
        paidThroughDate: '2026-06-30',
        noticeDate: '2026-05-30',
        leaseEndDate: '2026-06-30',
        leaseBreak: false,
        newTenantMoveInDate: null,
        forwardingAddress: { street: '88 Pine Ave', city: 'Bellevue', state: 'WA', zip: '98004' },
        inspectionStatus: 'signed',
      },
      depositData: {
        securityDeposit: 2200,
        petDeposit: 0,
        keyDeposit: 0,
        garageOpenerDeposit: 0,
        nrcCleaningFee: 200,
        nrcPetFee: 0,
      },
      utilityData: {
        utilityType: 'flat_fee',
        flatFeeRate: 85,
        flatFeeBillingMethod: 'included_in_rent',
        rubsBuildingTotal: 0,
        rubsUnitRatio: 0,
      },
      ledgerData: { outstandingBalances: 0, lateFees: 0, credits: 0, partialPayments: 0, priorCharges: 0 },
      manualCharges: {
        generalCleaning: 0, blindDrapeCleaning: 0, windowCoveringReplacement: 0,
        carpetShampooing: 0, flooringRestoration: 0, painting: 0,
        other1Label: '', other1: 0, other2Label: '', other2: 0, legalCourtCosts: 0,
      },
      calculatedCharges: { rentDue: 0, rentDueDateRange: '', utilityCharge: 0 },
      rubsManualInput: null,
    },
    {
      id: 'unit-312d-nair',
      processingStatus: 'not_started',
      complianceChecked: false,
      pdfGenerated: false,
      tenantData: {
        tenantName: 'Priya S. Nair',
        coTenant: '',
        unit: '312D',
        monthlyRent: 1950,
        moveInDate: '2023-08-01',
        moveOutDate: '2026-07-01',
        paidThroughDate: '2026-07-01',
        noticeDate: '2026-06-01',
        leaseEndDate: '2026-07-01',
        leaseBreak: false,
        newTenantMoveInDate: null,
        forwardingAddress: { street: '55 Oak St', city: 'Redmond', state: 'WA', zip: '98052' },
        inspectionStatus: 'missing',
      },
      depositData: {
        securityDeposit: 1950,
        petDeposit: 0,
        keyDeposit: 0,
        garageOpenerDeposit: 0,
        nrcCleaningFee: 175,
        nrcPetFee: 0,
      },
      utilityData: {
        utilityType: 'RUBS',
        flatFeeRate: 0,
        flatFeeBillingMethod: 'included_in_rent',
        rubsBuildingTotal: 0,
        rubsUnitRatio: 0.072,
      },
      ledgerData: { outstandingBalances: 0, lateFees: 0, credits: 0, partialPayments: 0, priorCharges: 0 },
      manualCharges: {
        generalCleaning: 0, blindDrapeCleaning: 0, windowCoveringReplacement: 0,
        carpetShampooing: 0, flooringRestoration: 0, painting: 0,
        other1Label: '', other1: 0, other2Label: '', other2: 0, legalCourtCosts: 0,
      },
      calculatedCharges: { rentDue: 0, rentDueDateRange: '', utilityCharge: 0 },
      rubsManualInput: null,
    },
  ],
};
```

- [ ] **Step 2: Create `lib/deadlineUtils.ts`**

```typescript
// lib/deadlineUtils.ts
// Calculates the 21-day statutory deadline for security deposit returns.
// California Civil Code §1950.5 requires return within 21 days of move-out.

export function getDeadline(moveOutDate: string): Date {
  // moveOutDate is ISO format: 'YYYY-MM-DD'
  const d = new Date(moveOutDate + 'T00:00:00');
  d.setDate(d.getDate() + 21);
  return d;
}

export function getDaysRemaining(moveOutDate: string): number {
  const deadline = getDeadline(moveOutDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffMs = deadline.getTime() - today.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

export function getDeadlineUrgency(daysRemaining: number): 'green' | 'amber' | 'red' {
  if (daysRemaining > 7) return 'green';
  if (daysRemaining >= 4) return 'amber';
  return 'red'; // covers ≤3 days and overdue (negative)
}

export function formatDeadlineDate(moveOutDate: string): string {
  const deadline = getDeadline(moveOutDate);
  return deadline.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /home/user/multifamily-security-deposits && npm run build 2>&1 | head -40
```

Expected: no TypeScript errors related to these two files.

- [ ] **Step 4: Commit**

```bash
git add lib/dummyData.ts lib/deadlineUtils.ts
git commit -m "feat: add dummy session data and deadline utility functions"
```

---

## Task 2: Shared deadline components

**Files:**
- Create: `components/shared/DeadlineBanner.tsx`
- Create: `components/shared/DeadlinePill.tsx`

**Interfaces:**
- Consumes: `getDaysRemaining`, `getDeadlineUrgency`, `formatDeadlineDate` from `lib/deadlineUtils.ts`
- Produces:
  - `<DeadlineBanner moveOutDate={string} />` — full formal notice block for Screen 3
  - `<DeadlinePill moveOutDate={string} />` — compact pill for Dashboard table column

- [ ] **Step 1: Create `components/shared/DeadlineBanner.tsx`**

```tsx
// components/shared/DeadlineBanner.tsx
// Formal compliance notice shown on the Review & Submit screen.
// Color changes based on urgency: green (>7 days), amber (4-7), red (≤3 or overdue).

'use client';

import { getDaysRemaining, getDeadlineUrgency, formatDeadlineDate } from '@/lib/deadlineUtils';

interface Props {
  moveOutDate: string;
}

export function DeadlineBanner({ moveOutDate }: Props) {
  const days = getDaysRemaining(moveOutDate);
  const urgency = getDeadlineUrgency(days);
  const deadlineDate = formatDeadlineDate(moveOutDate);

  const styles = {
    green: {
      wrapper: 'bg-green-50 border-green-300',
      title: 'text-green-900',
      body: 'text-green-800',
      pill: 'bg-green-100 text-green-800',
    },
    amber: {
      wrapper: 'bg-amber-50 border-amber-300',
      title: 'text-amber-900',
      body: 'text-amber-800',
      pill: 'bg-amber-100 text-amber-800',
    },
    red: {
      wrapper: 'bg-red-50 border-red-300',
      title: 'text-red-900',
      body: 'text-red-800',
      pill: 'bg-red-100 text-red-800',
    },
  }[urgency];

  const daysLabel = days < 0
    ? `${Math.abs(days)} days overdue`
    : days === 0
    ? 'Due today'
    : `${days} days remaining`;

  return (
    <div className={`border rounded-lg p-4 mb-4 ${styles.wrapper}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className={`font-semibold text-sm mb-1 ${styles.title}`}>
            NOTICE: Deposit return due within 21 days of move-out.
          </p>
          <p className={`text-xs leading-relaxed ${styles.body}`}>
            Full deposit return or itemized statement of deductions must be delivered by{' '}
            <strong>{deadlineDate}</strong>. Failure to comply within the statutory period may result
            in forfeiture of the right to make deductions and liability for damages under
            California Civil Code §1950.5.
          </p>
        </div>
        <span className={`shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full whitespace-nowrap ${styles.pill}`}>
          {daysLabel}
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `components/shared/DeadlinePill.tsx`**

```tsx
// components/shared/DeadlinePill.tsx
// Compact days-remaining pill for the Dashboard table.

'use client';

import { getDaysRemaining, getDeadlineUrgency, formatDeadlineDate } from '@/lib/deadlineUtils';

interface Props {
  moveOutDate: string;
}

export function DeadlinePill({ moveOutDate }: Props) {
  const days = getDaysRemaining(moveOutDate);
  const urgency = getDeadlineUrgency(days);
  const deadlineDate = formatDeadlineDate(moveOutDate);

  const styles = {
    green: 'bg-green-50 text-green-700 border-green-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    red: 'bg-red-50 text-red-700 border-red-200',
  }[urgency];

  const daysLabel = days < 0
    ? `${Math.abs(days)}d overdue`
    : days === 0
    ? 'Due today'
    : `${days}d left`;

  return (
    <div>
      <div className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded border ${styles}`}>
        {daysLabel}
      </div>
      <div className="text-xs text-gray-400 mt-0.5">{deadlineDate}</div>
    </div>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npm run build 2>&1 | head -40
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/shared/DeadlineBanner.tsx components/shared/DeadlinePill.tsx
git commit -m "feat: add DeadlineBanner and DeadlinePill components"
```

---

## Task 3: Update Dashboard with deadline columns + dummy data seed

**Files:**
- Modify: `components/Dashboard/index.tsx`
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `<DeadlinePill>` from `components/shared/DeadlinePill.tsx`
- Consumes: `DUMMY_SESSION` from `lib/dummyData.ts`

- [ ] **Step 1: Update `components/Dashboard/index.tsx`**

Replace the entire file with:

```tsx
// components/Dashboard/index.tsx
// Dashboard listing all tenant returns. Shows deadline urgency at a glance.

'use client';

import { useRouter } from 'next/navigation';
import { useSession } from '@/context/SessionContext';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { InspectionBadge } from '@/components/shared/InspectionBadge';
import { UtilityTag } from '@/components/shared/UtilityTag';
import { DeadlinePill } from '@/components/shared/DeadlinePill';
import { TenantReturn } from '@/types';

export function Dashboard() {
  const { session, clearSession } = useSession();
  const router = useRouter();

  if (!session) {
    if (typeof window !== 'undefined') router.replace('/');
    return null;
  }

  const total = session.returns.length;
  const complete = session.returns.filter(r => r.processingStatus === 'complete').length;

  function handleRowClick(r: TenantReturn) {
    router.push(`/return/${encodeURIComponent(r.id)}`);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">
              {session.propertyName || 'Security Deposit Returns'}
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              AGM Real Estate · {complete} of {total} complete · Uploaded {session.uploadDate}
            </p>
          </div>
          <button
            onClick={() => { clearSession(); router.push('/'); }}
            className="text-sm text-gray-500 hover:text-gray-700 underline"
          >
            Start new upload
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-2">
        <div className="max-w-6xl mx-auto">
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all"
              style={{ width: total > 0 ? `${(complete / total) * 100}%` : '0%' }}
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="max-w-6xl mx-auto px-6 py-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wide">
                <th className="text-left px-4 py-3">Tenant / Unit</th>
                <th className="text-left px-4 py-3">Move-out</th>
                <th className="text-left px-4 py-3">21-Day Deadline</th>
                <th className="text-left px-4 py-3">Utility</th>
                <th className="text-left px-4 py-3">Inspection</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {session.returns.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-gray-50 hover:bg-blue-50 cursor-pointer transition-colors"
                  onClick={() => handleRowClick(r)}
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">
                      {r.tenantData.tenantName}
                      {r.tenantData.coTenant && (
                        <span className="text-gray-400 font-normal"> · {r.tenantData.coTenant}</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      Unit {r.tenantData.unit} · {session.propertyName}
                      {r.tenantData.leaseBreak && (
                        <span className="ml-2 text-orange-600 font-medium">Lease break</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{r.tenantData.moveOutDate}</td>
                  <td className="px-4 py-3">
                    <DeadlinePill moveOutDate={r.tenantData.moveOutDate} />
                  </td>
                  <td className="px-4 py-3"><UtilityTag type={r.utilityData.utilityType} /></td>
                  <td className="px-4 py-3"><InspectionBadge status={r.tenantData.inspectionStatus} /></td>
                  <td className="px-4 py-3"><StatusBadge status={r.processingStatus} /></td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-blue-600 text-xs font-medium">
                      {r.processingStatus === 'complete' ? 'View →' : 'Open →'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Seed dummy data in `app/page.tsx`**

In `app/page.tsx`, add a button/option that loads the dummy session so we can demo without uploading a real Excel file. Add this import at the top and a "Load demo data" button next to the upload area:

Find the section in `app/page.tsx` where the session check happens and add after the existing imports:

```tsx
import { DUMMY_SESSION } from '@/lib/dummyData';
```

Then find the button group area (near "Resume session" button) and add:

```tsx
<button
  onClick={() => {
    setSession(DUMMY_SESSION);
    router.push('/dashboard');
  }}
  className="text-sm text-blue-600 hover:text-blue-800 underline"
>
  Load demo data (no Excel needed)
</button>
```

- [ ] **Step 3: Verify build**

```bash
npm run build 2>&1 | head -60
```

Expected: no TypeScript errors. Dashboard renders with new columns.

- [ ] **Step 4: Commit**

```bash
git add components/Dashboard/index.tsx app/page.tsx
git commit -m "feat: add deadline columns to Dashboard and demo data loader"
```

---

## Task 4: Agent script state machine

**Files:**
- Create: `components/AgentForm/agentScript.ts`

**Interfaces:**
- Consumes: `TenantReturn` from `types/index.ts`, `formatCurrency` from `lib/calculations.ts`
- Produces:
  - `AgentStep` type: `'tenant' | 'lease' | 'utility' | 'charges' | 'done'`
  - `AgentMessage` interface: `{ role: 'agent' | 'user'; text: string }`
  - `getOpeningMessage(tr: TenantReturn): string` — first agent message summarizing loaded data
  - `getStepMessage(step: AgentStep, tr: TenantReturn): string` — agent message for each step
  - `parseUserCorrection(input: string, tr: TenantReturn): { field: string; value: number } | null`
  - `STEP_ORDER: AgentStep[]` — `['tenant', 'lease', 'utility', 'charges', 'done']`

- [ ] **Step 1: Create `components/AgentForm/agentScript.ts`**

```typescript
// components/AgentForm/agentScript.ts
// Scripted conversation state machine for the agent panel.
// Each step has a pre-written message explaining what was auto-filled and calculated.
// Designed to be replaced with a real LLM call later — all logic is in plain functions.

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
// Returns null if the input doesn't look like a correction.
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
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run build 2>&1 | head -40
```

Expected: no errors from `agentScript.ts`.

- [ ] **Step 3: Commit**

```bash
git add components/AgentForm/agentScript.ts
git commit -m "feat: add agent conversation state machine"
```

---

## Task 5: AgentPanel component (left chat panel)

**Files:**
- Create: `components/AgentForm/AgentPanel.tsx`

**Interfaces:**
- Consumes: `AgentMessage`, `AgentStep` from `./agentScript`
- Produces: `<AgentPanel messages={AgentMessage[]} onSend={(text: string) => void} disabled={boolean} />`

- [ ] **Step 1: Create `components/AgentForm/AgentPanel.tsx`**

```tsx
// components/AgentForm/AgentPanel.tsx
// Left panel of the core processing screen.
// Shows the scripted agent conversation and accepts PM input for corrections.

'use client';

import { useEffect, useRef, useState } from 'react';
import { AgentMessage } from './agentScript';

interface Props {
  messages: AgentMessage[];
  onSend: (text: string) => void;
  disabled: boolean;
}

export function AgentPanel({ messages, onSend, disabled }: Props) {
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest message whenever messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setInput('');
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Panel header */}
      <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Agent</span>
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
        {messages.map((m, i) => (
          <div key={i} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
            <span className="text-xs text-gray-400 mb-1">{m.role === 'agent' ? 'Agent' : 'You'}</span>
            <div
              className={`px-3 py-2 text-sm leading-relaxed max-w-[90%] whitespace-pre-wrap ${
                m.role === 'agent'
                  ? 'bg-white border border-gray-200 rounded-tl rounded-tr rounded-br rounded-bl-none text-gray-700'
                  : 'bg-gray-100 border border-gray-200 rounded-tl rounded-tr rounded-bl rounded-br-none text-gray-500 font-mono text-xs'
              }`}
              // Agent messages support **bold** markdown-style
              dangerouslySetInnerHTML={m.role === 'agent' ? {
                __html: m.text
                  .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                  .replace(/\n/g, '<br/>')
              } : undefined}
            >
              {m.role === 'user' ? m.text : undefined}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input row */}
      <div className="border-t border-gray-100 px-4 py-3 bg-white flex gap-2 items-end">
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          disabled={disabled}
          placeholder={disabled ? 'Processing…' : 'Type a correction or question…'}
          className="flex-1 resize-none text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400 disabled:bg-gray-50 disabled:text-gray-400"
          rows={2}
        />
        <button
          onClick={handleSend}
          disabled={disabled || !input.trim()}
          className="px-4 py-2 text-sm font-medium bg-blue-50 border border-blue-200 text-blue-700 rounded-lg hover:bg-blue-100 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Send ↗
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run build 2>&1 | head -40
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/AgentForm/AgentPanel.tsx
git commit -m "feat: add AgentPanel chat component"
```

---

## Task 6: LiveFormPanel component (right live preview)

**Files:**
- Create: `components/AgentForm/LiveFormPanel.tsx`

**Interfaces:**
- Consumes: `TenantReturn` from `types/index.ts`, `formatCurrency` from `lib/calculations.ts`
- Produces: `<LiveFormPanel tr={TenantReturn} filledCount={number} totalFields={number} />`

- [ ] **Step 1: Create `components/AgentForm/LiveFormPanel.tsx`**

```tsx
// components/AgentForm/LiveFormPanel.tsx
// Right panel of the core processing screen.
// Shows a live color-coded preview of the AGM Checkout Report form.
// Green = auto-filled from Excel, Blue = calculated, Orange = manual entry, Purple = final result.

'use client';

import { TenantReturn } from '@/types';
import { formatCurrency } from '@/lib/calculations';

interface Props {
  tr: TenantReturn;
  filledCount: number;
  totalFields: number;
}

// Field value display with color coding
function Field({
  label,
  value,
  variant = 'empty',
}: {
  label: string;
  value: string;
  variant?: 'auto' | 'calc' | 'manual' | 'result' | 'empty' | 'waiting';
}) {
  const variantStyles = {
    auto: 'bg-green-50 border-green-300 text-green-800',
    calc: 'bg-blue-50 border-blue-300 text-blue-800 font-medium',
    manual: 'bg-amber-50 border-amber-300 text-amber-800',
    result: 'bg-purple-50 border-purple-300 text-purple-800 font-medium',
    empty: 'bg-gray-50 border-gray-200 text-gray-400 italic',
    waiting: 'bg-gray-50 border-gray-200 text-gray-400 italic',
  };

  return (
    <div className="flex flex-col gap-0.5">
      <label className="text-xs text-gray-400">{label}</label>
      <div className={`text-xs px-2 py-1 rounded border ${variantStyles[variant]}`}>
        {value || '—'}
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100 pb-1 mb-2 mt-3">
      {children}
    </div>
  );
}

export function LiveFormPanel({ tr, filledCount, totalFields }: Props) {
  const { tenantData, depositData, utilityData, calculatedCharges, manualCharges } = tr;

  const nrcOffset = Math.min(manualCharges.generalCleaning, depositData.nrcCleaningFee);
  const tenantCleaning = Math.max(0, manualCharges.generalCleaning - nrcOffset);
  const totalDeposits = depositData.securityDeposit + depositData.petDeposit + depositData.keyDeposit;
  const totalCharges =
    calculatedCharges.rentDue +
    calculatedCharges.utilityCharge +
    tenantCleaning +
    manualCharges.carpetShampooing +
    manualCharges.painting +
    manualCharges.other1 +
    manualCharges.other2;
  const balance = totalDeposits - totalCharges;

  const fwdAddr = `${tenantData.forwardingAddress.street}, ${tenantData.forwardingAddress.city} ${tenantData.forwardingAddress.state} ${tenantData.forwardingAddress.zip}`;
  const utilityLabel = utilityData.utilityType === 'RUBS'
    ? `RUBS — ${(utilityData.rubsUnitRatio * 100).toFixed(1)}%`
    : 'Flat fee';

  return (
    <div className="flex flex-col h-full">
      {/* Panel header */}
      <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
          AGM Checkout Report — live preview
        </span>
        <span className="text-xs text-gray-400">{filledCount} / {totalFields} fields</span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {/* Title */}
        <p className="text-xs font-semibold text-center text-gray-600 border-b border-gray-100 pb-2 mb-3">
          Checkout Report · AGM Real Estate
        </p>

        {/* Basic info */}
        <div className="grid grid-cols-2 gap-2 mb-2">
          <Field label="Property" value={tr.tenantData.unit ? 'Westlake Commons' : ''} variant="auto" />
          <Field label="Unit #" value={tenantData.unit} variant="auto" />
        </div>
        <div className="mb-2">
          <Field label="Tenant" value={tenantData.tenantName} variant="auto" />
        </div>
        <div className="mb-2">
          <Field label="Forwarding address" value={fwdAddr} variant="auto" />
        </div>
        <div className="mb-2">
          <Field
            label="Move-in inspection"
            value={tenantData.inspectionStatus === 'signed' ? '✓ Signed — normal wear and tear confirmed' : '⚠️ Missing'}
            variant={tenantData.inspectionStatus === 'signed' ? 'auto' : 'manual'}
          />
        </div>

        <SectionLabel>Lease summary</SectionLabel>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <Field label="Monthly rent" value={formatCurrency(tenantData.monthlyRent)} variant="auto" />
          <Field label="Security dep." value={formatCurrency(depositData.securityDeposit)} variant="auto" />
          <Field label="NRC fee" value={formatCurrency(depositData.nrcCleaningFee)} variant="auto" />
          <Field label="Utility billing" value={utilityLabel} variant="auto" />
        </div>
        <div className="grid grid-cols-3 gap-2 mb-2">
          <Field label="Move-in" value={tenantData.moveInDate} variant="auto" />
          <Field label="Move-out" value={tenantData.moveOutDate} variant="auto" />
          <Field
            label="Lease break"
            value={tenantData.leaseBreak ? `Yes — ${tenantData.leaseEndDate}` : 'No'}
            variant={tenantData.leaseBreak ? 'calc' : 'auto'}
          />
        </div>

        <SectionLabel>Charges</SectionLabel>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <Field
            label="Rent due"
            value={calculatedCharges.rentDue > 0 ? formatCurrency(calculatedCharges.rentDue) : '$0.00'}
            variant={calculatedCharges.rentDue > 0 ? 'calc' : 'auto'}
          />
          <Field
            label={`Utility (${utilityData.utilityType === 'RUBS' ? 'RUBS' : 'Flat fee'})`}
            value={calculatedCharges.utilityCharge > 0 ? formatCurrency(calculatedCharges.utilityCharge) : '$0.00'}
            variant={calculatedCharges.utilityCharge > 0 ? 'calc' : 'auto'}
          />
          <Field
            label={`Cleaning (NRC −${formatCurrency(nrcOffset)})`}
            value={manualCharges.generalCleaning > 0 ? formatCurrency(tenantCleaning) : ''}
            variant={manualCharges.generalCleaning > 0 ? 'manual' : 'waiting'}
          />
          <Field
            label={manualCharges.other1Label || 'Other'}
            value={manualCharges.other1 > 0 ? formatCurrency(manualCharges.other1) : ''}
            variant={manualCharges.other1 > 0 ? 'manual' : 'waiting'}
          />
        </div>

        <SectionLabel>Deposit / credits</SectionLabel>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <Field label="Security deposit" value={formatCurrency(depositData.securityDeposit)} variant="auto" />
          {depositData.petDeposit > 0 && (
            <Field label="Pet deposit" value={formatCurrency(depositData.petDeposit)} variant="auto" />
          )}
          <Field label="Total credits" value={formatCurrency(totalDeposits)} variant="calc" />
        </div>

        <SectionLabel>Balance</SectionLabel>
        <Field
          label={balance >= 0 ? 'Balance due to tenant' : 'Balance owing landlord'}
          value={formatCurrency(Math.abs(balance))}
          variant="result"
        />

        {/* Legend */}
        <div className="flex flex-wrap gap-3 mt-4 pt-3 border-t border-gray-100">
          {[
            { color: 'bg-green-300', label: 'Auto-filled' },
            { color: 'bg-blue-300', label: 'Calculated' },
            { color: 'bg-amber-300', label: 'Manual entry' },
            { color: 'bg-purple-300', label: 'Final result' },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className={`w-2.5 h-2.5 rounded-sm ${color}`} />
              <span className="text-xs text-gray-400">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run build 2>&1 | head -40
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/AgentForm/LiveFormPanel.tsx
git commit -m "feat: add LiveFormPanel color-coded form preview"
```

---

## Task 7: AgentForm orchestrator + route wiring

**Files:**
- Create: `components/AgentForm/index.tsx`
- Modify: `app/return/[id]/page.tsx`

**Interfaces:**
- Consumes: `AgentPanel`, `LiveFormPanel`, `agentScript.*`, `useSession`, `TenantReturn`
- Produces: `<AgentForm returnId={string} />` — full core processing screen

- [ ] **Step 1: Create `components/AgentForm/index.tsx`**

```tsx
// components/AgentForm/index.tsx
// Core processing screen — orchestrates AgentPanel (left) and LiveFormPanel (right).
// Drives the scripted agent conversation step by step.
// Step strip at the top advances as the agent progresses through sections.

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/context/SessionContext';
import { AgentPanel } from './AgentPanel';
import { LiveFormPanel } from './LiveFormPanel';
import {
  AgentStep, AgentMessage, STEP_ORDER,
  getOpeningMessage, getStepMessage, parseUserCorrection,
} from './agentScript';

const STEP_LABELS: Record<AgentStep | 'done', string> = {
  tenant: '1. Tenant',
  lease: '2. Lease',
  utility: '3. Utility',
  charges: '4. Charges',
  done: '5. Review',
};

const TOTAL_FIELDS = 72;

interface Props {
  returnId: string;
}

export function AgentForm({ returnId }: Props) {
  const { session, updateReturn } = useSession();
  const router = useRouter();

  const tr = session?.returns.find(r => r.id === returnId);

  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [stepIndex, setStepIndex] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [filledCount, setFilledCount] = useState(14); // starts with auto-filled fields

  // On mount, greet with opening message
  useEffect(() => {
    if (!tr) return;
    setMessages([{ role: 'agent', text: getOpeningMessage(tr) }]);
    // Auto-advance to first step after a short delay
    setTimeout(() => advanceStep(0), 800);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!session || !tr) {
    router.replace('/dashboard');
    return null;
  }

  function advanceStep(index: number) {
    if (index >= STEP_ORDER.length) return;
    const step = STEP_ORDER[index];
    const msg = getStepMessage(step, tr!);
    setMessages(prev => [...prev, { role: 'agent', text: msg }]);
    // Update filled count as steps complete
    const counts: Record<AgentStep, number> = {
      tenant: 20, lease: 35, utility: 45, charges: 65, done: TOTAL_FIELDS,
    };
    setFilledCount(counts[step] ?? filledCount);
    setStepIndex(index + 1);
  }

  function handleSend(text: string) {
    setMessages(prev => [...prev, { role: 'user', text }]);
    setProcessing(true);

    setTimeout(() => {
      const correction = parseUserCorrection(text);
      if (correction) {
        // Apply the correction to the return data
        if (['generalCleaning', 'carpetShampooing', 'painting', 'other1'].includes(correction.field)) {
          updateReturn(tr.id, {
            manualCharges: { ...tr.manualCharges, [correction.field]: correction.value },
          });
        } else if (correction.field === 'rentDue') {
          updateReturn(tr.id, {
            calculatedCharges: { ...tr.calculatedCharges, rentDue: correction.value },
          });
        } else if (correction.field === 'utilityCharge') {
          updateReturn(tr.id, {
            calculatedCharges: { ...tr.calculatedCharges, utilityCharge: correction.value },
          });
        }
        setMessages(prev => [...prev, {
          role: 'agent',
          text: `Got it — I've updated that to $${correction.value.toFixed(2)}. The live form has been recalculated.`,
        }]);
      } else {
        // Generic response if no correction detected
        setMessages(prev => [...prev, {
          role: 'agent',
          text: `Thanks for the note. If you'd like to change a specific number, type it like "cleaning was $400" and I'll update it.\n\nReady to continue whenever you are.`,
        }]);
      }
      setProcessing(false);
    }, 600);
  }

  function handleContinue() {
    if (stepIndex < STEP_ORDER.length) {
      advanceStep(stepIndex);
    } else {
      // All steps done — go to review screen
      updateReturn(tr.id, { processingStatus: 'complete' });
      router.push(`/review/${encodeURIComponent(tr.id)}`);
    }
  }

  const currentStep = STEP_ORDER[Math.min(stepIndex, STEP_ORDER.length - 1)];
  const allStepsDone = stepIndex >= STEP_ORDER.length;

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 px-4 py-2.5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/dashboard')}
            className="text-blue-600 text-sm hover:text-blue-800"
          >
            ← All returns
          </button>
          <div className="w-px h-4 bg-gray-200" />
          <div>
            <p className="text-sm font-semibold text-gray-900">
              {tr.tenantData.tenantName} — Unit {tr.tenantData.unit}
            </p>
            <p className="text-xs text-gray-400">
              Move-out {tr.tenantData.moveOutDate} ·{' '}
              {tr.utilityData.utilityType === 'RUBS' ? 'RUBS' : 'Flat fee'} ·{' '}
              Inspection {tr.tenantData.inspectionStatus}
            </p>
          </div>
        </div>

        {/* Step strip */}
        <div className="flex overflow-hidden rounded-lg border border-gray-200">
          {STEP_ORDER.map((step, i) => {
            const isDone = i < stepIndex;
            const isActive = step === currentStep && !allStepsDone;
            return (
              <div
                key={step}
                className={`px-3 py-1.5 text-xs border-r border-gray-200 last:border-r-0 whitespace-nowrap ${
                  isDone
                    ? 'bg-green-50 text-green-700 font-medium'
                    : isActive
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'bg-gray-50 text-gray-400'
                }`}
              >
                {STEP_LABELS[step]}
              </div>
            );
          })}
          <div
            className={`px-3 py-1.5 text-xs whitespace-nowrap ${
              allStepsDone ? 'bg-blue-50 text-blue-700 font-medium' : 'bg-gray-50 text-gray-400'
            }`}
          >
            {STEP_LABELS['done']}
          </div>
        </div>

        {/* Continue / Finalize button */}
        <button
          onClick={handleContinue}
          className="px-4 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          {allStepsDone ? 'Go to Review →' : 'Continue →'}
        </button>
      </div>

      {/* Two-panel body */}
      <div className="flex-1 grid grid-cols-2 gap-0 overflow-hidden">
        <div className="border-r border-gray-200 overflow-hidden flex flex-col bg-white">
          <AgentPanel messages={messages} onSend={handleSend} disabled={processing} />
        </div>
        <div className="overflow-hidden flex flex-col bg-white">
          <LiveFormPanel tr={tr} filledCount={filledCount} totalFields={TOTAL_FIELDS} />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update `app/return/[id]/page.tsx`**

```tsx
export const runtime = 'edge';

import { AgentForm } from '@/components/AgentForm';

export default async function ReturnPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AgentForm returnId={decodeURIComponent(id)} />;
}
```

- [ ] **Step 3: Verify build**

```bash
npm run build 2>&1 | head -60
```

Expected: no TypeScript errors. `/return/[id]` route renders `AgentForm`.

- [ ] **Step 4: Commit**

```bash
git add components/AgentForm/ app/return/[id]/page.tsx
git commit -m "feat: add AgentForm core processing screen"
```

---

## Task 8: ReviewSubmit screen

**Files:**
- Create: `components/ReviewSubmit/index.tsx`
- Modify: `app/review/[id]/page.tsx`

**Interfaces:**
- Consumes: `DeadlineBanner`, `useSession`, `TenantReturn`, `formatCurrency`, `fillAGMCheckoutPDF`

- [ ] **Step 1: Create `components/ReviewSubmit/index.tsx`**

```tsx
// components/ReviewSubmit/index.tsx
// Final review screen — shows calculation summary, statutory deadline notice, and PDF download.

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/context/SessionContext';
import { DeadlineBanner } from '@/components/shared/DeadlineBanner';
import { formatCurrency } from '@/lib/calculations';

interface Props {
  returnId: string;
}

export function ReviewSubmit({ returnId }: Props) {
  const { session, updateReturn } = useSession();
  const router = useRouter();
  const [complianceChecked, setComplianceChecked] = useState(false);
  const [generating, setGenerating] = useState(false);

  const tr = session?.returns.find(r => r.id === returnId);
  if (!session || !tr) {
    router.replace('/dashboard');
    return null;
  }

  const { tenantData, depositData, calculatedCharges, manualCharges } = tr;

  // Calculate totals
  const nrcOffset = Math.min(manualCharges.generalCleaning, depositData.nrcCleaningFee);
  const tenantCleaning = Math.max(0, manualCharges.generalCleaning - nrcOffset);
  const totalCredits = depositData.securityDeposit + depositData.petDeposit + depositData.keyDeposit;
  const totalCharges =
    calculatedCharges.rentDue +
    calculatedCharges.utilityCharge +
    tenantCleaning +
    manualCharges.carpetShampooing +
    manualCharges.painting +
    manualCharges.other1 +
    manualCharges.other2 +
    manualCharges.legalCourtCosts;
  const balance = totalCredits - totalCharges;
  const dueToTenant = balance >= 0 ? balance : 0;
  const owingLandlord = balance < 0 ? Math.abs(balance) : 0;

  const fwdAddr = `${tenantData.forwardingAddress.street}, ${tenantData.forwardingAddress.city} ${tenantData.forwardingAddress.state} ${tenantData.forwardingAddress.zip}`;
  const fileName = `AGM_Checkout_${tenantData.unit}_${tenantData.tenantName.split(' ').pop()}.pdf`;

  async function handleDownload() {
    if (!complianceChecked) return;
    setGenerating(true);
    try {
      const res = await fetch('/AGM_template.pdf');
      const templateBytes = await res.arrayBuffer();
      const { fillAGMCheckoutPDF } = await import('@/lib/pdfFiller');
      const pdfBytes = await fillAGMCheckoutPDF(templateBytes, tr, session.propertyName);
      const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
      updateReturn(tr.id, { pdfGenerated: true, complianceChecked: true });
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-900">
            Review & submit — {tenantData.tenantName}, Unit {tenantData.unit}
          </p>
          <p className="text-xs text-gray-400">All fields populated · Ready for compliance check</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => router.push(`/return/${encodeURIComponent(tr.id)}`)}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
          >
            ← Back to edit
          </button>
          <button
            onClick={handleDownload}
            disabled={!complianceChecked || generating}
            className="px-4 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {generating ? 'Generating…' : 'Download PDF'}
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6">
        {/* Deadline banner — full width at top */}
        <DeadlineBanner moveOutDate={tenantData.moveOutDate} />

        <div className="grid grid-cols-2 gap-6">
          {/* Left — Calculation summary */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-700">Calculation summary</h2>

            {/* Credits */}
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Credits</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Security deposit</span>
                  <span className="font-medium text-green-700">{formatCurrency(depositData.securityDeposit)}</span>
                </div>
                {depositData.petDeposit > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Pet deposit</span>
                    <span className="font-medium text-green-700">{formatCurrency(depositData.petDeposit)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-gray-200 pt-2 font-semibold">
                  <span className="text-gray-700">Total credits</span>
                  <span className="text-green-700">{formatCurrency(totalCredits)}</span>
                </div>
              </div>
            </div>

            {/* Charges */}
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Charges</p>
              <div className="space-y-2 text-sm">
                {calculatedCharges.rentDue > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Rent due {tenantData.leaseBreak ? '(lease break)' : ''}</span>
                    <span className="font-medium">{formatCurrency(calculatedCharges.rentDue)}</span>
                  </div>
                )}
                {calculatedCharges.utilityCharge > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">
                      {tr.utilityData.utilityType === 'RUBS' ? 'RUBS chargeback' : 'Utility charge'}
                    </span>
                    <span className="font-medium text-blue-700">{formatCurrency(calculatedCharges.utilityCharge)}</span>
                  </div>
                )}
                {manualCharges.generalCleaning > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Cleaning (NRC offset −{formatCurrency(nrcOffset)})</span>
                    <span className="font-medium">{formatCurrency(tenantCleaning)}</span>
                  </div>
                )}
                {manualCharges.other1 > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">{manualCharges.other1Label || 'Other'}</span>
                    <span className="font-medium">{formatCurrency(manualCharges.other1)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-gray-200 pt-2 font-semibold">
                  <span className="text-gray-700">Total charges</span>
                  <span className="text-red-700">{formatCurrency(totalCharges)}</span>
                </div>
              </div>
            </div>

            {/* Balance */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-400 mb-1">Balance due to tenant</p>
                <p className={`text-lg font-semibold ${dueToTenant > 0 ? 'text-green-700' : 'text-gray-400'}`}>
                  {formatCurrency(dueToTenant)}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-400 mb-1">Balance owing landlord</p>
                <p className={`text-lg font-semibold ${owingLandlord > 0 ? 'text-red-700' : 'text-gray-400'}`}>
                  {formatCurrency(owingLandlord)}
                </p>
              </div>
            </div>

            {/* Compliance checkbox */}
            <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
              complianceChecked ? 'bg-green-50 border-green-300' : 'bg-gray-50 border-gray-200'
            }`}>
              <input
                type="checkbox"
                checked={complianceChecked}
                onChange={e => setComplianceChecked(e.target.checked)}
                className="mt-0.5 w-4 h-4 shrink-0"
              />
              <span className="text-sm text-gray-600">
                I confirm all charges reflect company-approved rates and this return is accurate.
              </span>
            </label>
          </div>

          {/* Right — PDF preview */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-700">PDF preview</h2>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 flex flex-col items-center justify-center gap-3 min-h-64 text-center">
              <svg className="w-10 h-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-sm font-medium text-gray-600">{fileName}</p>
              <p className="text-xs text-gray-400">72 / 72 fields populated · Awaiting compliance check</p>
              <button
                onClick={handleDownload}
                disabled={!complianceChecked || generating}
                className="mt-2 px-5 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {generating ? 'Generating PDF…' : 'Download PDF'}
              </button>
            </div>

            {/* Forwarding address */}
            <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 text-sm text-blue-800">
              <span className="font-medium">Will be sent to:</span> {fwdAddr}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update `app/review/[id]/page.tsx`**

```tsx
export const runtime = 'edge';

import { ReviewSubmit } from '@/components/ReviewSubmit';

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ReviewSubmit returnId={decodeURIComponent(id)} />;
}
```

- [ ] **Step 3: Verify build**

```bash
npm run build 2>&1 | head -60
```

Expected: clean build, all routes compile.

- [ ] **Step 4: Commit**

```bash
git add components/ReviewSubmit/ app/review/[id]/page.tsx
git commit -m "feat: add ReviewSubmit screen with deadline banner and PDF download"
```

---

## Task 9: Push to main and verify deployment

- [ ] **Step 1: Final build check**

```bash
npm run build 2>&1
```

Expected: all 5 routes compile with no TypeScript errors.

- [ ] **Step 2: Push to main**

```bash
git push origin main
```

- [ ] **Step 3: Verify Cloudflare Pages deployment**

Check the Cloudflare Pages dashboard — a new Production deployment should trigger automatically. Wait for green status, then open `multifamily-security-deposits.pages.dev`, click "Load demo data", and verify:
- Dashboard shows 3 tenants with deadline pills
- Clicking Sarah L. Mitchell opens the Agent+Live Form screen
- Agent walks through steps automatically
- Live form fills in color-coded fields as steps progress
- Continue button reaches Review screen
- Review screen shows deadline banner, calculation summary, compliance checkbox, PDF download

- [ ] **Step 4: Final commit if any fixes needed**

```bash
git add -A && git commit -m "fix: post-deploy corrections" && git push origin main
```
