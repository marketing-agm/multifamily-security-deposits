# AGM Security Deposit Return Tool — UI Redesign Spec
**Date:** 2026-06-26  
**Status:** Approved for implementation planning

---

## Overview

Replace the existing 6-step wizard form with a three-screen agent-driven UI. The agent auto-fills what it can from the uploaded Excel, explains every calculation in plain language, and allows property managers to correct or adjust any value. Maximum three screens.

---

## Screen 1 — Move-out Dashboard

**Purpose:** Give the property manager a bird's-eye view of all tenant returns for the current period.

**Layout:** Full-width table with a header bar.

**Header bar:**
- Left: "Security Deposit Returns" title + property name + period (e.g. "AGM Real Estate · June 2026")
- Right: count of pending returns + "New return" button (triggers Excel upload)

**Table columns:**
| Column | Description |
|---|---|
| Tenant / Unit | Full name + unit number + property name |
| Move-out | Move-out date |
| Due date | 21-day statutory deadline (move-out + 21 days) |
| Days left | Countdown — green if >7 days, amber if ≤7, red if ≤3 or overdue |
| Utility | RUBS or Flat fee badge |
| Inspection | Signed (green) or Missing (red) badge |
| Status | Not started / In progress / Complete badge |

**Behavior:** Clicking any row navigates to Screen 2 for that tenant.

---

## Screen 2 — Agent + Live Form (Core Processing Screen)

**Purpose:** The main workspace. The agent walks the property manager through every section, auto-fills from Excel, explains calculations, and accepts corrections.

### Top Bar
- Back arrow → dashboard
- Tenant name + unit number
- Step strip: 1. Tenant → 2. Lease → 3. Utility → 4. Charges → 5. Review
- Step strip advances automatically as agent progresses

### Left Panel — Agent Chat

**On load:** Agent greets with a summary of what it pulled from Excel and what it's about to process. Example:
> "I've loaded Jordan K. Patel, Unit 205C. Security deposit: $500.00, NRC: $150.00, flat fee included in rent. Move-out matches lease end — no lease break. Walking through the calculation now."

**Agent behavior per section:**
1. **Tenant** — confirms name, unit, forwarding address, inspection status from Excel
2. **Lease** — states move-in, move-out, paid-through, lease break status; calculates rent due and explains the formula (e.g. "$2,800 ÷ 30 days × 6 days = $560.00")
3. **Utility** — states billing method; for RUBS asks PM to paste the water bill; for flat fee included in rent confirms $0 due
4. **Charges** — prompts PM to enter any damage charges (cleaning, carpet, painting, other); explains NRC offset math
5. **Review** — summarizes everything, confirms total credits vs total charges, states final balance

**Corrections:** PM can type at any point to correct a value. Agent recalculates and updates the live form. Examples:
- "Actually the cleaning was $300" → agent recalculates NRC offset and updates balance
- "How did you calculate the rent due?" → agent re-explains the formula

**Input:** Text input at the bottom + Send button. Enter key submits.

### Right Panel — Live AGM Checkout Report Preview

Fields fill in as the agent progresses. Field counter in top-right corner (e.g. "42 / 72 fields").

**Field color coding:**
| Color | Meaning |
|---|---|
| Green | Auto-filled from Excel |
| Blue | Calculated by the app |
| Orange | Manually entered by property manager |
| Purple | Final result (balance) |
| Gray/italic | Not yet filled — "waiting…" |

**Sections shown:**
- Property + Unit + Tenant name + Forwarding address
- Inspection badge
- Lease summary: monthly rent, security deposit, NRC fee, utility billing method, move-in, move-out, lease break
- Charges table: rent due, utility, cleaning, carpet/painting/other, total
- Deposit/credits: security deposit, other deposits, total credits
- Balance: due to tenant / owing landlord

**Legend** at the bottom of the panel showing the four color codes.

---

## Screen 3 — Review & Submit

**Purpose:** Final compliance check, calculation summary, and PDF download.

**Top bar:**
- Tenant name + unit + "All fields populated · Ready for compliance check"
- Back to edit button
- Download PDF button (disabled until compliance checkbox is checked)

### Statutory Deadline Notice (prominent, top of screen)

Formal compliance notice block, color-coded by urgency:

> **NOTICE: Deposit return due within 21 days of move-out.**
> Full deposit return or itemized statement of deductions must be delivered by **[move-out + 21 days]**. Failure to comply within the statutory period may result in forfeiture of the right to make deductions and liability for damages under California Civil Code §1950.5.
> **[N] days remaining.**

| Days remaining | Color |
|---|---|
| > 7 days | Green |
| 4–7 days | Amber |
| ≤ 3 days or overdue | Red |

### Left Panel — Calculation Summary

**Credits block:**
- Security deposit
- Pet deposit (if applicable)
- Other deposits (if applicable)
- **Total credits** (green)

**Charges block:**
- Rent due (with date range)
- Utility chargeback (RUBS amount or $0 for flat fee)
- Cleaning (with NRC offset shown, e.g. "Cleaning −$150 NRC offset")
- Carpet / painting / other damage items
- **Total charges** (red)

**Balance block (two cards side by side):**
- Balance due to tenant
- Balance owing landlord
- One will always be $0.00

**Compliance checkbox:**
> "I confirm all charges reflect company-approved rates and this return is accurate."
Must be checked before Download PDF unlocks.

### Right Panel — PDF Preview

- File name: `AGM_Checkout_[Unit]_[LastName].pdf`
- Field count: "72 / 72 fields populated"
- Preview button (opens PDF in new tab)
- Download button (grayed out until compliance checked, then active)
- Forwarding address confirmation: "Will be sent to: [address]"

---

## Data & State

- All data for the mockup is pre-loaded dummy data simulating an Excel upload
- Real Excel integration (`lib/parser.ts`) will be wired in later once column names are confirmed
- Session state persists via existing `localStorage` / `SessionContext` — no changes needed to that layer
- The agent conversation is a scripted state machine (not a live AI call) — each step has defined agent messages and expected inputs

---

## What's Not In This Spec

- Real LLM/AI API integration (future phase)
- Email sending
- Multi-property support
- Mobile layout
- User authentication

---

## Dummy Data for Mockup

**Tenant:** Sarah L. Mitchell  
**Unit:** 204B — Westlake Commons  
**Move-out:** 06/24/2026  
**Lease end:** 07/27/2026 (lease break)  
**Monthly rent:** $2,800.00  
**Security deposit:** $1,850.00  
**Pet deposit:** $300.00  
**NRC cleaning fee:** $250.00  
**Utility:** RUBS — 8.3% of building water bill  
**Building water bill:** $1,240.00 (06/01–06/24/2026)  
**RUBS chargeback:** $102.92  
**Cleaning charge:** $350.00 (tenant portion after NRC: $100.00)  
**Key replacement:** $50.00  
**Forwarding address:** 412 Elmwood Dr, Kirkland WA 98033  
**Inspection:** Signed  
**21-day deadline:** 07/15/2026
