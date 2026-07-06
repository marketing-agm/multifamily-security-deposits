# Property Config Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Store per-property config (utility type, rates, NRC fees, manager names) as a checked-in JSON file; rewrite the AppFolio parser for the real 2-sheet export format (Tenant Ledger + Tenant Transactions); replace the PDF placeholder with the real AGM template; auto-fill utility and NRC defaults from the config while keeping them manually editable per tenant.

**Architecture:** Property config lives in `data/properties.json` — a plain JSON array of all 35 AGM properties. A lookup helper in `lib/propertyConfig.ts` matches the AppFolio `Property` column value to a config record by property code prefix (e.g. "A021"). The parser reads the two-sheet export, looks up the matching config, and seeds `utilityData` and `depositData.nrcCleaningFee`/`nrcPetFee` from it. The ReturnForm utility step shows these as editable defaults. The pdfFiller already has `siteManagerName` / `propertyManagerName` fields mapped — it just needs them wired to the config values. The actual AGM PDF replaces the placeholder at `public/AGM_template.pdf`.

**Tech Stack:** TypeScript, Next.js 15 App Router, `xlsx` (already installed), `pdf-lib` (already installed), no new packages needed.

## Global Constraints

- No new npm packages — only `xlsx` and `pdf-lib` (already in `package.json`)
- All files are TypeScript (`.ts` / `.tsx`) — no `.js` except existing scripts
- Branch: `claude/fullscreen-layout` (current working branch)
- `data/properties.json` is the source of truth — never hardcode property values in components
- Utility rate and NRC fees are defaults only — always remain editable by staff in the ReturnForm
- The `paidThroughDate` field has no direct column in the new AppFolio format; leave it blank (empty string) — staff fills it in manually
- `Tenant Address` in the export is a single string — store as `forwardingAddress.street`, leave city/state/zip blank

---

### Task 1: Create `data/properties.json`

**Files:**
- Create: `data/properties.json`

**Interfaces:**
- Produces: JSON array used by `lib/propertyConfig.ts` in Task 2

- [ ] **Step 1: Create the file**

```json
[
  {
    "code": "A021",
    "name": "ARBOR HEIGHTS",
    "address": "625 N 130th St Seattle, WA 98133",
    "utilityType": "flat_fee",
    "flatFeeRate": 65,
    "rubsUnitRatio": 0,
    "nrcCleaningFee": 0,
    "nrcPetFee": 250,
    "siteManagerName": "",
    "propertyManagerName": "Paul Wedeberg"
  },
  {
    "code": "A028",
    "name": "AVIA APARTMENTS",
    "address": "11534-11540 Greenwood Ave N Seattle, WA 98133",
    "utilityType": "flat_fee",
    "flatFeeRate": 150,
    "rubsUnitRatio": 0,
    "nrcCleaningFee": 0,
    "nrcPetFee": 300,
    "siteManagerName": "",
    "propertyManagerName": "Paul Wedeberg"
  },
  {
    "code": "A030",
    "name": "BALCRO",
    "address": "8509 14th Ave NW Seattle, WA 98117",
    "utilityType": "flat_fee",
    "flatFeeRate": 95,
    "rubsUnitRatio": 0,
    "nrcCleaningFee": 0,
    "nrcPetFee": 250,
    "siteManagerName": "",
    "propertyManagerName": "Paul Wedeberg"
  },
  {
    "code": "A034",
    "name": "BAYVIEW APARTMENTS",
    "address": "2512 14th Ave S Seattle, WA 98144",
    "utilityType": "flat_fee",
    "flatFeeRate": 120,
    "rubsUnitRatio": 0,
    "nrcCleaningFee": 35,
    "nrcPetFee": 0,
    "siteManagerName": "Alyssa Henne",
    "propertyManagerName": "Alyssa Henne"
  },
  {
    "code": "A048",
    "name": "BLANCHE CLARE APARTMENTS",
    "address": "1406 Bellevue Ave Seattle, WA 98122",
    "utilityType": "flat_fee",
    "flatFeeRate": 140,
    "rubsUnitRatio": 0,
    "nrcCleaningFee": 0,
    "nrcPetFee": 300,
    "siteManagerName": "",
    "propertyManagerName": "Paul Wedeberg"
  },
  {
    "code": "A104",
    "name": "CEDAR LANE APARTMENTS",
    "address": "12536 Greenwood Ave N Seattle, WA 98133",
    "utilityType": "flat_fee",
    "flatFeeRate": 50,
    "rubsUnitRatio": 0,
    "nrcCleaningFee": 0,
    "nrcPetFee": 350,
    "siteManagerName": "",
    "propertyManagerName": "Paul Wedeberg"
  },
  {
    "code": "A112",
    "name": "CLIFT HOUSE",
    "address": "301 E Thomas St Seattle, WA 98102",
    "utilityType": "flat_fee",
    "flatFeeRate": 75,
    "rubsUnitRatio": 0,
    "nrcCleaningFee": 0,
    "nrcPetFee": 300,
    "siteManagerName": "",
    "propertyManagerName": "Elizabeth Gessel, Isabella Gessel"
  },
  {
    "code": "A141",
    "name": "CRESTVIEW TOWNHOMES",
    "address": "3700 188th St SW Lynnwood, WA 98037",
    "utilityType": "flat_fee",
    "flatFeeRate": 90,
    "rubsUnitRatio": 0,
    "nrcCleaningFee": 350,
    "nrcPetFee": 60,
    "siteManagerName": "",
    "propertyManagerName": "Elizabeth Gessel, Isabella Gessel"
  },
  {
    "code": "A161",
    "name": "DE SELM",
    "address": "403 14th Ave E Seattle, WA 98112",
    "utilityType": "flat_fee",
    "flatFeeRate": 0,
    "rubsUnitRatio": 0,
    "nrcCleaningFee": 0,
    "nrcPetFee": 300,
    "siteManagerName": "",
    "propertyManagerName": "Elizabeth Gessel, Isabella Gessel"
  },
  {
    "code": "A187",
    "name": "EAST UNION",
    "address": "506 E Union St Seattle, WA 98122",
    "utilityType": "flat_fee",
    "flatFeeRate": 0,
    "rubsUnitRatio": 0,
    "nrcCleaningFee": 0,
    "nrcPetFee": 300,
    "siteManagerName": "Paul Wedeberg",
    "propertyManagerName": "Paul Wedeberg"
  },
  {
    "code": "A249",
    "name": "GARY APARTMENTS",
    "address": "112 147th Ave SE Bellevue, WA 98007",
    "utilityType": "flat_fee",
    "flatFeeRate": 100,
    "rubsUnitRatio": 0,
    "nrcCleaningFee": 300,
    "nrcPetFee": 300,
    "siteManagerName": "",
    "propertyManagerName": "Elizabeth Gessel, Isabella Gessel"
  },
  {
    "code": "A251",
    "name": "GILMANOR",
    "address": "4051 Gilman Ave W Seattle, WA 98199",
    "utilityType": "RUBS",
    "flatFeeRate": 0,
    "rubsUnitRatio": 0,
    "nrcCleaningFee": 0,
    "nrcPetFee": 300,
    "siteManagerName": "Alyssa Henne",
    "propertyManagerName": "Alyssa Henne"
  },
  {
    "code": "A261",
    "name": "GOLDEN INCA",
    "address": "230 14th Ave E Seattle, WA 98112",
    "utilityType": "flat_fee",
    "flatFeeRate": 75,
    "rubsUnitRatio": 0,
    "nrcCleaningFee": 0,
    "nrcPetFee": 300,
    "siteManagerName": "",
    "propertyManagerName": "Elizabeth Gessel, Isabella Gessel"
  },
  {
    "code": "A273",
    "name": "ROCKEFELLER COURT",
    "address": "3218 Rockefeller Ave Everett, WA 98201",
    "utilityType": "flat_fee",
    "flatFeeRate": 50,
    "rubsUnitRatio": 0,
    "nrcCleaningFee": 0,
    "nrcPetFee": 200,
    "siteManagerName": "",
    "propertyManagerName": "Paul Wedeberg"
  },
  {
    "code": "A302",
    "name": "HIGHWAY PLACE APARTMENTS",
    "address": "5711 Highway Place Everett, WA 98203",
    "utilityType": "flat_fee",
    "flatFeeRate": 95,
    "rubsUnitRatio": 0,
    "nrcCleaningFee": 50,
    "nrcPetFee": 0,
    "siteManagerName": "",
    "propertyManagerName": "Paul Wedeberg"
  },
  {
    "code": "A304",
    "name": "HILL TOWN",
    "address": "2201 S Main St Seattle, WA 98144",
    "utilityType": "flat_fee",
    "flatFeeRate": 0,
    "rubsUnitRatio": 0,
    "nrcCleaningFee": 0,
    "nrcPetFee": 200,
    "siteManagerName": "",
    "propertyManagerName": "Paul Wedeberg"
  },
  {
    "code": "A315",
    "name": "FAIRLAKE QUADS 4-PLEX",
    "address": "125 147th Ave SE Bellevue, WA 98007",
    "utilityType": "flat_fee",
    "flatFeeRate": 150,
    "rubsUnitRatio": 0,
    "nrcCleaningFee": 0,
    "nrcPetFee": 0,
    "siteManagerName": "",
    "propertyManagerName": "Alyssa Henne"
  },
  {
    "code": "A341",
    "name": "LAKE STREET BUILDING",
    "address": "111-117 Lake Street S Kirkland, WA 98033",
    "utilityType": "flat_fee",
    "flatFeeRate": 0,
    "rubsUnitRatio": 0,
    "nrcCleaningFee": 500,
    "nrcPetFee": 0,
    "siteManagerName": "Paul Wedeberg",
    "propertyManagerName": "Paul Wedeberg"
  },
  {
    "code": "A360",
    "name": "LORELEI",
    "address": "501 Summit Ave E Seattle, WA 98102",
    "utilityType": "flat_fee",
    "flatFeeRate": 75,
    "rubsUnitRatio": 0,
    "nrcCleaningFee": 100,
    "nrcPetFee": 300,
    "siteManagerName": "Alyssa Henne",
    "propertyManagerName": "Alyssa Henne"
  },
  {
    "code": "A368",
    "name": "MAGNOLIA CRESTVIEW APARTMENTS",
    "address": "2701 W Manor Pl Seattle, WA 98199",
    "utilityType": "flat_fee",
    "flatFeeRate": 0,
    "rubsUnitRatio": 0,
    "nrcCleaningFee": 0,
    "nrcPetFee": 0,
    "siteManagerName": "",
    "propertyManagerName": "Paul Wedeberg"
  },
  {
    "code": "A369",
    "name": "MAGNOLIA VISTA-MANOR APARTMENTS",
    "address": "2710 W Manor Pl Seattle, WA 98199",
    "utilityType": "flat_fee",
    "flatFeeRate": 65,
    "rubsUnitRatio": 0,
    "nrcCleaningFee": 0,
    "nrcPetFee": 0,
    "siteManagerName": "",
    "propertyManagerName": "Paul Wedeberg"
  },
  {
    "code": "A380",
    "name": "MARIANNE",
    "address": "633 4th Ave W Seattle, WA 98119",
    "utilityType": "flat_fee",
    "flatFeeRate": 0,
    "rubsUnitRatio": 0,
    "nrcCleaningFee": 0,
    "nrcPetFee": 0,
    "siteManagerName": "Fred Brenner",
    "propertyManagerName": "Alyssa Henne"
  },
  {
    "code": "A402",
    "name": "MERCER TOWER",
    "address": "2805 75th Pl SE Mercer Island, WA 98040",
    "utilityType": "flat_fee",
    "flatFeeRate": 0,
    "rubsUnitRatio": 0,
    "nrcCleaningFee": 250,
    "nrcPetFee": 300,
    "siteManagerName": "",
    "propertyManagerName": "Elizabeth Gessel, Isabella Gessel"
  },
  {
    "code": "A416",
    "name": "NIWA APARTMENTS",
    "address": "513 1st Ave N Seattle, WA 98109",
    "utilityType": "RUBS",
    "flatFeeRate": 0,
    "rubsUnitRatio": 0,
    "nrcCleaningFee": 0,
    "nrcPetFee": 300,
    "siteManagerName": "",
    "propertyManagerName": "Cody Chew"
  },
  {
    "code": "A440",
    "name": "THE PALMS APT",
    "address": "2712 Franklin Ave E Seattle, WA 98102",
    "utilityType": "flat_fee",
    "flatFeeRate": 65,
    "rubsUnitRatio": 0,
    "nrcCleaningFee": 125,
    "nrcPetFee": 500,
    "siteManagerName": "Kellie Seldon",
    "propertyManagerName": "Elizabeth Gessel, Isabella Gessel"
  },
  {
    "code": "A475",
    "name": "RIALTO COURT",
    "address": "1729 Boylston Ave Seattle, WA 98122",
    "utilityType": "flat_fee",
    "flatFeeRate": 0,
    "rubsUnitRatio": 0,
    "nrcCleaningFee": 0,
    "nrcPetFee": 300,
    "siteManagerName": "Debbie Weiss",
    "propertyManagerName": "Alyssa Henne"
  },
  {
    "code": "A520",
    "name": "SEWARD PARK COURT",
    "address": "5108 S Dawson Seattle, WA 98118",
    "utilityType": "flat_fee",
    "flatFeeRate": 95,
    "rubsUnitRatio": 0,
    "nrcCleaningFee": 175,
    "nrcPetFee": 300,
    "siteManagerName": "",
    "propertyManagerName": "Alyssa Henne"
  },
  {
    "code": "A540",
    "name": "6113 APARTMENTS",
    "address": "6113 Roosevelt Way NE Seattle, WA 98115",
    "utilityType": "flat_fee",
    "flatFeeRate": 0,
    "rubsUnitRatio": 0,
    "nrcCleaningFee": 500,
    "nrcPetFee": 500,
    "siteManagerName": "",
    "propertyManagerName": "Elizabeth Gessel, Isabella Gessel"
  },
  {
    "code": "A547",
    "name": "SKANDI VILLA",
    "address": "23809 84th Ave W Edmonds, WA 98026",
    "utilityType": "flat_fee",
    "flatFeeRate": 75,
    "rubsUnitRatio": 0,
    "nrcCleaningFee": 0,
    "nrcPetFee": 250,
    "siteManagerName": "",
    "propertyManagerName": "Paul Wedeberg"
  },
  {
    "code": "A560",
    "name": "SOUTH HILL",
    "address": "255 N Forest St Bellingham, WA 98225",
    "utilityType": "flat_fee",
    "flatFeeRate": 90,
    "rubsUnitRatio": 0,
    "nrcCleaningFee": 300,
    "nrcPetFee": 250,
    "siteManagerName": "Robert Sims",
    "propertyManagerName": "Alyssa Henne"
  },
  {
    "code": "A690",
    "name": "VIEWMONT",
    "address": "219 Bellevue Ave E Seattle, WA 98102",
    "utilityType": "flat_fee",
    "flatFeeRate": 65,
    "rubsUnitRatio": 0,
    "nrcCleaningFee": 200,
    "nrcPetFee": 300,
    "siteManagerName": "Gisele Brangert",
    "propertyManagerName": "Alyssa Henne"
  },
  {
    "code": "A709",
    "name": "WHITE HEATHER",
    "address": "12556 15th Ave NE Seattle, WA 98125",
    "utilityType": "flat_fee",
    "flatFeeRate": 75,
    "rubsUnitRatio": 0,
    "nrcCleaningFee": 200,
    "nrcPetFee": 300,
    "siteManagerName": "",
    "propertyManagerName": "Elizabeth Gessel, Isabella Gessel"
  },
  {
    "code": "A715",
    "name": "WILLOW CREEK",
    "address": "19306 Bothell Way NE Bothell, WA 98011",
    "utilityType": "flat_fee",
    "flatFeeRate": 95,
    "rubsUnitRatio": 0,
    "nrcCleaningFee": 250,
    "nrcPetFee": 100,
    "siteManagerName": "Tyson and Carrie Wine",
    "propertyManagerName": "Alyssa Henne"
  },
  {
    "code": "M145",
    "name": "CRESTWOOD MOBILE HOME PARK",
    "address": "1645 S 272nd Street Federal Way, WA 98003",
    "utilityType": "flat_fee",
    "flatFeeRate": 150,
    "rubsUnitRatio": 0,
    "nrcCleaningFee": 0,
    "nrcPetFee": 0,
    "siteManagerName": "Paula Toglia",
    "propertyManagerName": "Paul Wedeberg"
  },
  {
    "code": "M400",
    "name": "MALTBY MOBILE HOME PARK",
    "address": "8730 206th St SE Snohomish, WA 98296",
    "utilityType": "RUBS",
    "flatFeeRate": 0,
    "rubsUnitRatio": 0,
    "nrcCleaningFee": 0,
    "nrcPetFee": 0,
    "siteManagerName": "",
    "propertyManagerName": ""
  }
]
```

- [ ] **Step 2: Commit**

```bash
git add data/properties.json
git commit -m "feat: add per-property config JSON (utility rates, NRC fees, manager names)"
```

---

### Task 2: `PropertyConfig` type + lookup helper

**Files:**
- Modify: `types/index.ts` — add `PropertyConfig` interface and extend `SessionState`
- Create: `lib/propertyConfig.ts` — `lookupProperty(propertyValue: string): PropertyConfig | null`

**Interfaces:**
- Consumes: `data/properties.json` (Task 1)
- Produces:
  - `PropertyConfig` type (used in Tasks 3, 5)
  - `lookupProperty(propertyValue: string): PropertyConfig | null` — matches on code prefix ("A021") or name substring (case-insensitive)

- [ ] **Step 1: Add `PropertyConfig` to `types/index.ts`**

Add after the existing `SessionState` interface at the bottom of the file:

```typescript
export interface PropertyConfig {
  code: string;            // e.g. "A021"
  name: string;            // e.g. "ARBOR HEIGHTS"
  address: string;
  utilityType: UtilityType;
  flatFeeRate: number;
  rubsUnitRatio: number;   // 0 for RUBS — entered per-tenant manually
  nrcCleaningFee: number;
  nrcPetFee: number;
  siteManagerName: string;
  propertyManagerName: string;
}
```

Also extend `SessionState` to carry the matched config:

```typescript
export interface SessionState {
  propertyName: string;
  uploadDate: string;
  returns: TenantReturn[];
  propertyConfig: PropertyConfig | null;  // null if property not matched in config
}
```

- [ ] **Step 2: Create `lib/propertyConfig.ts`**

```typescript
import properties from '@/data/properties.json';
import { PropertyConfig } from '@/types';

const CONFIG: PropertyConfig[] = properties as PropertyConfig[];

/**
 * Match the AppFolio "Property" column value to a config record.
 * AppFolio typically formats it as "A021 - ARBOR HEIGHTS" or just the full name.
 * Tries code prefix match first, then name substring match (case-insensitive).
 */
export function lookupProperty(propertyValue: string): PropertyConfig | null {
  if (!propertyValue) return null;
  const upper = propertyValue.toUpperCase();

  // Try code prefix match: "A021" at the start of the value
  const codeMatch = CONFIG.find(p => upper.startsWith(p.code));
  if (codeMatch) return codeMatch;

  // Fall back to name substring match
  const nameMatch = CONFIG.find(p => upper.includes(p.name.toUpperCase()));
  return nameMatch ?? null;
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add types/index.ts lib/propertyConfig.ts
git commit -m "feat: add PropertyConfig type and lookupProperty helper"
```

---

### Task 3: Rewrite parser for real AppFolio 2-sheet format

**Files:**
- Modify: `lib/parser.ts` — full rewrite to handle Tenant Ledger + Tenant Transactions sheets

**Interfaces:**
- Consumes:
  - `lookupProperty(s: string): PropertyConfig | null` from `lib/propertyConfig.ts` (Task 2)
  - `PropertyConfig` from `types/index.ts` (Task 2)
- Produces: `ParseResult` (same interface as before — `{ returns: TenantReturn[], errors: ParseError[], propertyName: string }`)

The new AppFolio export has two sheets:
- **Sheet 0 — "Tenant Ledger"** columns: `Date`, `Property`, `Unit`, `Tags`, `Unit Type`, `Tenant`, `Additional Tenants`, `Tenant Phone Number`, `Tenant Email`, `Rent`, `Deposit`, `Lease from`, `Lease To`, `Move in Date`, `Move Out Date`, `Move Out Reason`, `Notice Given Date`, `Tenant Address`, `Unit Address`, `Event`, `Eligible for eCheck Security Deposit Return`
- **Sheet 1 — "Tenant Transactions"** columns: `Unit`, `Name`, `Beginning Balance`, `Rent Charges`, `Late Charges`, `Other Charges`, `Cash Payments`, `NSFs`, `Concessions`, `Other Credits`, `Ending Balance`, `Amount`, `Status`

Key mapping decisions:
- `Tenant` → `tenantData.tenantName`
- `Additional Tenants` → `tenantData.coTenant`
- `Unit` → `tenantData.unit`
- `Property` → used to look up `PropertyConfig`; also stored as `propertyName`
- `Rent` → `tenantData.monthlyRent`
- `Deposit` → `depositData.securityDeposit` (the security deposit amount)
- `Lease from` → `tenantData.moveInDate`
- `Lease To` → `tenantData.leaseEndDate`
- `Move in Date` → also `tenantData.moveInDate` (prefer this over "Lease from" if present)
- `Move Out Date` → `tenantData.moveOutDate`
- `Notice Given Date` → `tenantData.noticeDate`
- `Tenant Address` → `tenantData.forwardingAddress.street` (full string; city/state/zip left blank)
- `Tags` or `Move Out Reason` → `tenantData.leaseBreak` (true if contains "lease break" case-insensitive)
- `paidThroughDate` → blank (not in export; staff fills manually)
- From `PropertyConfig` → `depositData.nrcCleaningFee`, `depositData.nrcPetFee`, `utilityData.utilityType`, `utilityData.flatFeeRate`
- From Tenant Transactions → `ledgerData.outstandingBalances` (Ending Balance), `ledgerData.lateFees` (Late Charges), `ledgerData.credits` (Other Credits), `ledgerData.partialPayments` (Cash Payments)
- `depositData.petDeposit`, `keyDeposit`, `garageOpenerDeposit` → 0 (not in this export format)

- [ ] **Step 1: Rewrite `lib/parser.ts`**

```typescript
import * as XLSX from 'xlsx';
import {
  TenantData,
  DepositData,
  UtilityData,
  TenantReturn,
  UtilityType,
  ManualCharges,
} from '@/types';
import { computeCalculatedCharges } from './calculations';
import { lookupProperty } from './propertyConfig';

type Row = Record<string, unknown>;

function parseDate(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'number') {
    const jsDate = XLSX.SSF.parse_date_code(value);
    const month = String(jsDate.m).padStart(2, '0');
    const day = String(jsDate.d).padStart(2, '0');
    return `${jsDate.y}-${month}-${day}`;
  }
  if (typeof value === 'string' && value.trim()) {
    const d = new Date(value);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  }
  return '';
}

function num(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const n = parseFloat(value.replace(/[$,]/g, ''));
    return isNaN(n) ? 0 : n;
  }
  return 0;
}

function str(value: unknown): string {
  return value != null ? String(value).trim() : '';
}

function pick(row: Row, ...keys: string[]): unknown {
  for (const k of keys) {
    if (row[k] != null && row[k] !== '') return row[k];
  }
  return '';
}

export interface ParseError {
  message: string;
  row?: number;
  sheet?: string;
}

export interface ParseResult {
  returns: TenantReturn[];
  errors: ParseError[];
  propertyName: string;
}

const EMPTY_MANUAL_CHARGES: ManualCharges = {
  generalCleaning: 0,
  blindDrapeCleaning: 0,
  windowCoveringReplacement: 0,
  carpetShampooing: 0,
  flooringRestoration: 0,
  painting: 0,
  other1Label: 'Other',
  other1: 0,
  other2Label: 'Other',
  other2: 0,
  legalCourtCosts: 0,
};

export function parseAppFolioExport(buffer: ArrayBuffer): ParseResult {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: false });
  const errors: ParseError[] = [];
  const sheetNames = workbook.SheetNames;

  if (sheetNames.length < 2) {
    errors.push({
      message: 'Upload must contain at least 2 sheets (Tenant Ledger, Tenant Transactions). Check your AppFolio export.',
    });
    return { returns: [], errors, propertyName: '' };
  }

  const ledgerRows = XLSX.utils.sheet_to_json<Row>(workbook.Sheets[sheetNames[0]], { defval: '' });
  const transactionRows = XLSX.utils.sheet_to_json<Row>(workbook.Sheets[sheetNames[1]], { defval: '' });

  // Index transactions by unit for joining
  const txByUnit = new Map<string, Row>();
  for (const row of transactionRows) {
    const unit = str(pick(row, 'Unit', 'unit'));
    if (unit) txByUnit.set(unit.toLowerCase(), row);
  }

  // Detect property name and config from first row
  const firstPropertyValue = str(pick(ledgerRows[0] ?? {}, 'Property', 'property'));
  const propertyConfig = lookupProperty(firstPropertyValue);
  const propertyName = propertyConfig
    ? `${propertyConfig.code} - ${propertyConfig.name}`
    : firstPropertyValue;

  const returns: TenantReturn[] = [];

  for (let i = 0; i < ledgerRows.length; i++) {
    const row = ledgerRows[i];
    const unit = str(pick(row, 'Unit', 'unit'));
    const tenantName = str(pick(row, 'Tenant', 'tenant'));

    if (!tenantName && !unit) continue;

    if (!tenantName) {
      errors.push({ message: `Row ${i + 2}: Missing tenant name.`, row: i + 2, sheet: sheetNames[0] });
    }
    if (!unit) {
      errors.push({ message: `Row ${i + 2}: Missing unit number.`, row: i + 2, sheet: sheetNames[0] });
    }

    const tx: Row = txByUnit.get(unit.toLowerCase()) ?? {};

    // Lease break: check Tags and Move Out Reason
    const tags = str(pick(row, 'Tags', 'tags')).toLowerCase();
    const moveOutReason = str(pick(row, 'Move Out Reason', 'move_out_reason')).toLowerCase();
    const leaseBreak = tags.includes('lease break') || moveOutReason.includes('lease break');

    // Prefer "Move in Date" over "Lease from" for moveInDate
    const moveInDate = parseDate(pick(row, 'Move in Date', 'Move In Date')) ||
                       parseDate(pick(row, 'Lease from', 'Lease From'));

    const tenantData: TenantData = {
      tenantName,
      coTenant: str(pick(row, 'Additional Tenants', 'additional_tenants')),
      unit,
      monthlyRent: num(pick(row, 'Rent', 'rent')),
      moveInDate,
      moveOutDate: parseDate(pick(row, 'Move Out Date', 'move_out_date')),
      paidThroughDate: '',  // not in export — staff fills manually
      noticeDate: parseDate(pick(row, 'Notice Given Date', 'notice_given_date')),
      leaseEndDate: parseDate(pick(row, 'Lease To', 'Lease to', 'lease_to')),
      leaseBreak,
      newTenantMoveInDate: null,
      forwardingAddress: {
        street: str(pick(row, 'Tenant Address', 'tenant_address')),
        city: '',
        state: '',
        zip: '',
      },
      inspectionStatus: 'missing',
    };

    const depositData: DepositData = {
      securityDeposit: num(pick(row, 'Deposit', 'deposit')),
      petDeposit: 0,
      keyDeposit: 0,
      garageOpenerDeposit: 0,
      // NRC fees come from property config; fall back to 0 if no match
      nrcCleaningFee: propertyConfig?.nrcCleaningFee ?? 0,
      nrcPetFee: propertyConfig?.nrcPetFee ?? 0,
    };

    const utilityType: UtilityType = propertyConfig?.utilityType ?? 'flat_fee';
    const utilityData: UtilityData = {
      utilityType,
      flatFeeRate: propertyConfig?.flatFeeRate ?? 0,
      flatFeeBillingMethod: 'billed_at_moveout',
      rubsBuildingTotal: 0,
      rubsUnitRatio: 0,  // entered per-tenant manually in ReturnForm
    };

    const ledgerData = {
      outstandingBalances: num(pick(tx, 'Ending Balance', 'ending_balance')),
      lateFees: num(pick(tx, 'Late Charges', 'late_charges')),
      credits: num(pick(tx, 'Other Credits', 'other_credits')),
      partialPayments: num(pick(tx, 'Cash Payments', 'cash_payments')),
      priorCharges: num(pick(tx, 'Other Charges', 'other_charges')),
    };

    const partial = {
      id: `${unit}-${i}`,
      tenantData,
      depositData,
      utilityData,
      ledgerData,
      manualCharges: { ...EMPTY_MANUAL_CHARGES },
      rubsManualInput: null,
      processingStatus: 'not_started' as const,
      complianceChecked: false,
      pdfGenerated: false,
    };

    const calculatedCharges = computeCalculatedCharges(partial);
    returns.push({ ...partial, calculatedCharges });
  }

  return { returns, errors, propertyName };
}
```

- [ ] **Step 2: Update `context/SessionContext.tsx` — carry `propertyConfig` in session**

Find the `setSession` call in `app/page.tsx` and update `SessionState` usage. The `SessionContext` stores a `SessionState` object — since we added `propertyConfig` to `SessionState` in Task 2, we need to pass it when creating the session after parsing.

In `app/page.tsx`, update the `setSession` call inside `handleFile`:

```typescript
// after: const result = parseAppFolioExport(buffer);
import { lookupProperty } from '@/lib/propertyConfig';

// inside handleFile, after parsing:
const propertyConfig = lookupProperty(result.propertyName);
setSession({
  propertyName: result.propertyName || file.name.replace(/\.xlsx?$/, ''),
  uploadDate: new Date().toLocaleDateString('en-US'),
  returns: result.returns,
  propertyConfig: propertyConfig,
});
```

- [ ] **Step 3: Check TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors. Fix any type errors before continuing.

- [ ] **Step 4: Commit**

```bash
git add lib/parser.ts app/page.tsx
git commit -m "feat: rewrite parser for AppFolio Tenant Ledger + Tenant Transactions format"
```

---

### Task 4: Replace PDF template with real AGM Checkout Report

**Files:**
- Replace: `public/AGM_template.pdf`

The real AGM Checkout Report PDF was uploaded to the session at:
`/root/.claude/uploads/e4d2f12e-3dbf-5b83-84b1-8219af331318/0a6e6f07-AGM_Security_Deposit_Checkout_Report.pdf`

The existing `public/AGM_template.pdf` is a placeholder. The `fieldMap.ts` field names were already verified against the real form — they should work. If any fields are missing or misnamed after the swap, run `node scripts/listPdfFields.mjs` to inspect.

- [ ] **Step 1: Copy the real PDF into public/**

```bash
cp /root/.claude/uploads/e4d2f12e-3dbf-5b83-84b1-8219af331318/0a6e6f07-AGM_Security_Deposit_Checkout_Report.pdf public/AGM_template.pdf
```

- [ ] **Step 2: Verify the file is a real PDF (not zero bytes)**

```bash
ls -lh public/AGM_template.pdf
file public/AGM_template.pdf
```

Expected: size ~607KB, `file` output says `PDF document`.

- [ ] **Step 3: Commit**

```bash
git add public/AGM_template.pdf
git commit -m "feat: replace PDF placeholder with real AGM Checkout Report template"
```

---

### Task 5: Wire manager names from property config into PDF filler

**Files:**
- Modify: `lib/pdfFiller.ts`

The `FIELD_MAP` in `lib/fieldMap.ts` already has `siteManagerName: 'Site Manager'` and `propertyManagerName: 'Property Manager'`. The pdfFiller just needs to receive these values. Currently `fillAGMCheckoutPDF` takes `(templateBytes, tenantReturn, propertyName)` — extend the signature to accept an optional `propertyConfig`.

- [ ] **Step 1: Read current `lib/pdfFiller.ts`** to understand the fill logic before editing it.

```bash
cat lib/pdfFiller.ts
```

- [ ] **Step 2: Update `fillAGMCheckoutPDF` signature and fill manager fields**

The function currently fills everything from `tenantReturn` and `propertyName`. Add a third optional parameter:

```typescript
import { PropertyConfig } from '@/types';

export async function fillAGMCheckoutPDF(
  templateBytes: ArrayBuffer,
  tenantReturn: TenantReturn,
  propertyName: string,
  propertyConfig?: PropertyConfig | null,
): Promise<Uint8Array> {
  // ... existing fill logic ...

  // Add these two fills (already mapped in FIELD_MAP):
  if (propertyConfig?.siteManagerName) {
    safeSetField(form, FIELD_MAP.siteManagerName, propertyConfig.siteManagerName);
  }
  if (propertyConfig?.propertyManagerName) {
    safeSetField(form, FIELD_MAP.propertyManagerName, propertyConfig.propertyManagerName);
  }

  // ... rest of existing logic ...
}
```

- [ ] **Step 3: Update the call site in `components/Review/index.tsx`**

Find the `fillAGMCheckoutPDF` call and pass `session.propertyConfig`:

```typescript
const filled = await fillAGMCheckoutPDF(
  templateBytes,
  tenantReturn!,
  session!.propertyName,
  session!.propertyConfig,
);
```

- [ ] **Step 4: TypeScript check**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add lib/pdfFiller.ts components/Review/index.tsx
git commit -m "feat: auto-fill site manager and property manager names in PDF from property config"
```

---

### Task 6: ReturnForm — show editable utility defaults from property config

**Files:**
- Modify: `components/ReturnForm/index.tsx` — utility step shows pre-filled rate with edit capability

Currently the utility step (`StepUtility`) shows the RUBS inputs but nothing editable for flat fee rate. We need to add an editable flat fee rate field for flat-fee properties, pre-filled from the property config (which already seeded `utilityData.flatFeeRate` during parse).

The `utilityData` is part of `tenantReturn` which is in session — it's already pre-filled by the parser. The ReturnForm uses local `manualCharges` state but passes `utilityData` straight from `tenantReturn` without a local copy. We need to add local state for the editable utility rate.

- [ ] **Step 1: Add `utilityRate` local state to `ReturnForm`**

In `ReturnForm`, after the existing state declarations, add:

```typescript
const [utilityRate, setUtilityRate] = useState<number>(
  tenantReturn?.utilityData.flatFeeRate ?? 0
);
```

- [ ] **Step 2: Build an updated `utilityData` that uses local `utilityRate`**

Inside the component body (before `saveProgress`), add:

```typescript
const liveUtilityData = {
  ...tenantReturn.utilityData,
  flatFeeRate: utilityRate,
};
```

Then pass `liveUtilityData` instead of `tenantReturn.utilityData` into `computeCalculatedCharges`:

```typescript
const withCharges = {
  ...tenantReturn,
  manualCharges,
  rubsManualInput: rubsInput,
  utilityData: liveUtilityData,
  tenantData: { ...tenantReturn.tenantData, inspectionStatus: currentInspectionStatus },
};
```

- [ ] **Step 3: Save `utilityRate` when `saveProgress` is called**

```typescript
function saveProgress(extraStatus?: TenantReturn['processingStatus']) {
  updateReturn(returnId, {
    manualCharges,
    rubsManualInput: rubsInput,
    calculatedCharges,
    utilityData: liveUtilityData,   // <-- add this line
    tenantData: { ...tenantReturn!.tenantData, inspectionStatus: currentInspectionStatus },
    processingStatus: extraStatus ?? (step < 4 ? 'in_progress' : tenantReturn!.processingStatus),
  });
}
```

- [ ] **Step 4: Update `StepUtility` to show editable flat fee rate**

Update the `StepUtility` component props and body to accept and display an editable rate:

```typescript
function StepUtility({
  utilityData, rubsInput, onRubsChange, utilityCharge, utilityRate, onRateChange,
}: {
  utilityData: TenantReturn['utilityData'];
  rubsInput: RUBSManualInput;
  onRubsChange: (v: RUBSManualInput) => void;
  utilityCharge: number;
  utilityRate: number;
  onRateChange: (v: number) => void;
}) {
  return (
    <div className="bg-white dark:bg-[#2c2c2e] rounded-2xl border border-[#e5e5ea] dark:border-[#38383a] p-5 space-y-4">
      <p className="text-xs font-semibold text-[#8e8e93] uppercase tracking-wider">Utility</p>
      <div className="flex items-center gap-2">
        <UtilityTag type={utilityData.utilityType} />
      </div>

      {utilityData.utilityType === 'flat_fee' && (
        <div className="space-y-3 border-t border-[#e5e5ea] dark:border-[#38383a] pt-4">
          <p className="text-sm text-[#8e8e93]">
            Monthly flat fee charged at move-out. Pre-filled from property config — edit if this unit differs.
          </p>
          <label className="block">
            <span className="text-xs text-[#8e8e93] font-medium">Flat Fee Rate ($/month)</span>
            <div className="relative mt-1 w-40">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8e8e93] text-sm">$</span>
              <input
                type="number"
                min={0}
                step={0.01}
                value={utilityRate}
                onChange={e => onRateChange(parseFloat(e.target.value) || 0)}
                className="w-full bg-[#f2f2f7] dark:bg-[#3a3a3c] border border-[#e5e5ea] dark:border-[#48484a] rounded-xl pl-7 pr-3 py-2 text-sm text-[#1c1c1e] dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </label>
          {utilityCharge === 0 ? (
            <p className="text-sm text-[#8e8e93]">Utility included in rent — no charge at move-out.</p>
          ) : (
            <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
              Calculated Utility Charge: {formatCurrency(utilityCharge)}
            </p>
          )}
        </div>
      )}

      {utilityData.utilityType === 'RUBS' && (
        <div className="space-y-3 border-t border-[#e5e5ea] dark:border-[#38383a] pt-4">
          <p className="text-sm text-[#8e8e93]">
            Enter the final water bill from the city. RUBS charge = Building Total × Unit Ratio.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs text-[#8e8e93] font-medium">Building Total ($)</span>
              <input
                type="number" min={0} step={0.01} value={rubsInput.buildingTotal}
                onChange={e => onRubsChange({ ...rubsInput, buildingTotal: parseFloat(e.target.value) || 0 })}
                className="mt-1 w-full bg-[#f2f2f7] dark:bg-[#3a3a3c] border border-[#e5e5ea] dark:border-[#48484a] rounded-xl px-3 py-2 text-sm text-[#1c1c1e] dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
            <label className="block">
              <span className="text-xs text-[#8e8e93] font-medium">Unit Ratio (e.g. 0.08)</span>
              <input
                type="number" min={0} max={1} step={0.0001} value={rubsInput.unitRatio}
                onChange={e => onRubsChange({ ...rubsInput, unitRatio: parseFloat(e.target.value) || 0 })}
                className="mt-1 w-full bg-[#f2f2f7] dark:bg-[#3a3a3c] border border-[#e5e5ea] dark:border-[#48484a] rounded-xl px-3 py-2 text-sm text-[#1c1c1e] dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
          </div>
          <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
            Calculated Tenant Share: {formatCurrency(utilityCharge)}
          </p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Update the `StepUtility` call site in `ReturnForm` to pass the new props**

```typescript
{step === 2 && (
  <StepUtility
    utilityData={liveUtilityData}
    rubsInput={rubsInput}
    onRubsChange={setRubsInput}
    utilityCharge={calculatedCharges.utilityCharge}
    utilityRate={utilityRate}
    onRateChange={setUtilityRate}
  />
)}
```

- [ ] **Step 6: TypeScript check**

```bash
npx tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
git add components/ReturnForm/index.tsx
git commit -m "feat: editable utility rate in ReturnForm, pre-filled from property config"
```

---

## Self-Review

### Spec coverage

| Requirement | Covered by |
|---|---|
| Store per-property config (utility type, rates, NRC fees, managers) | Task 1 + 2 |
| Auto-fill utility rate from stored config | Task 3 (parser seeds utilityData) + Task 6 (UI shows pre-filled) |
| Utility rate manually editable per tenant | Task 6 |
| NRC fees auto-filled from config | Task 3 |
| Replace PDF placeholder with real AGM template | Task 4 |
| Manager names in PDF | Task 5 |
| New 2-sheet AppFolio format (Tenant Ledger + Tenant Transactions) | Task 3 |
| `paidThroughDate` left blank (not in export) | Task 3 |

### Placeholder scan — none found.

### Type consistency check

- `PropertyConfig` defined in Task 2 `types/index.ts`, consumed identically in Tasks 2, 3, 5
- `SessionState.propertyConfig: PropertyConfig | null` added in Task 2, written in Task 3, read in Task 5
- `fillAGMCheckoutPDF(templateBytes, tenantReturn, propertyName, propertyConfig?)` — 4th param optional, call site in Task 5 passes `session!.propertyConfig`
- `liveUtilityData` in Task 6 has the same shape as `UtilityData` (spread + override)
