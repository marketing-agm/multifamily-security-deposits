# AppFolio Export Specification

**STATUS: DRAFT — Column names below are placeholder assumptions. Must be verified against the actual AppFolio report before dev is complete.**

## Required Report

> **OPEN QUESTION:** Which specific AppFolio report(s) should the manager run to get all required data? What are the exact column headers and sheet names in the export?

The tool expects a single `.xlsx` file containing 4 sheets. The exact report name and column headers must be confirmed with a test export from AppFolio.

---

## Sheet 1 — Tenant & Lease

Expected columns (confirm exact names from AppFolio):

| Column Header | Description | Required |
|---|---|---|
| `Unit` | Unit number | Yes |
| `Tenant Name` | Full name of primary tenant | Yes |
| `Co-Tenant` | Co-tenant name (may be blank) | No |
| `Monthly Rent` | Current monthly rent | Yes |
| `Move-In Date` | Lease start / move-in date | Yes |
| `Move-Out Date` | Actual move-out date | Yes |
| `Paid Through` | Date rent is paid through | Yes |
| `Notice Date` | Date notice was given | No |
| `Lease End Date` | Original lease end date | Yes |
| `Lease Break` | Yes/No — is this a lease break? | Yes |
| `New Tenant Move-In` | Move-in date of incoming tenant (if applicable) | No |
| `Forwarding Address` | Street address | No |
| `Forwarding City` | City | No |
| `Forwarding State` | State | No |
| `Forwarding Zip` | ZIP code | No |
| `Inspection Status` | `Signed` or `Missing` | No |
| `Property` | Property name (used as session label) | No |

> **OPEN QUESTION:** Does AppFolio export inspection status in the same report as lease data, or is it a separate report?

---

## Sheet 2 — Deposits & Fees

| Column Header | Description | Required |
|---|---|---|
| `Unit` | Unit number (join key) | Yes |
| `Security Deposit` | Security deposit amount | Yes |
| `Pet Deposit` | Pet deposit (0 if none) | No |
| `Key Deposit` | Key deposit (0 if none) | No |
| `Garage Opener Deposit` | Garage opener deposit (0 if none) | No |
| `NRC Cleaning Fee` | Non-refundable cleaning fee paid at move-in | No |
| `NRC Pet Fee` | Non-refundable pet fee paid at move-in | No |

---

## Sheet 3 — Utility

| Column Header | Description | Required |
|---|---|---|
| `Unit` | Unit number (join key) | Yes |
| `Utility Type` | `RUBS` or `flat_fee` | Yes |
| `Flat Fee Rate` | Monthly flat fee rate (property-specific) | If flat fee |
| `Billing Method` | `included_in_rent` or `billed_at_moveout` | If flat fee |
| `RUBS Building Total` | Building-level water bill total (pre-populated if available) | If RUBS |
| `RUBS Unit Ratio` | Unit's share ratio of building water bill | If RUBS |

> **OPEN QUESTION:** Is the flat fee utility always included in monthly rent, or does it vary by property? If it varies, where is the billing method stored in AppFolio?

---

## Sheet 4 — Ledger

| Column Header | Description | Required |
|---|---|---|
| `Unit` | Unit number (join key) | Yes |
| `Outstanding Balance` | Outstanding ledger balance | No |
| `Late Fees` | Accumulated late fees | No |
| `Credits` | Credits on account | No |
| `Partial Payments` | Partial payments applied | No |
| `Prior Charges` | Charges already applied before move-out | No |

---

## Parser Resilience

The parser handles common AppFolio formatting variations:
- Excel serial dates and string dates
- Dollar amounts with/without `$` and commas
- Case-insensitive column name matching (multi-key fallback)
- Blank co-tenant and forwarding address fields

Clear user-facing errors are shown for:
- Missing required sheets
- Missing tenant name or unit on any row
- File format issues

---

## Getting the Export from AppFolio

1. Log into AppFolio
2. Navigate to **Reports** → (report name TBD)
3. Filter to the target property and move-out date range
4. Click **Export to Excel**
5. Save the `.xlsx` file
6. Upload to this tool

> This spec must be updated with the actual report name and confirmed column headers once a test export is reviewed.
