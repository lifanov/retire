# Updating Data Files

This project relies on several JSON data files in `src/data/` which must be kept up-to-date with current economic and tax laws. These files should be reviewed and updated annually (typically Q4 for the upcoming tax year).

## Federal Tax Data (`src/data/federal_tax_data.json`)

**Source:** IRS Revenue Procedures (e.g., "Revenue Procedure 2024-xx" for 2025).
**Secondary Sources:** Tax Foundation, NerdWallet, Bankrate (for easier reading).

**Verification Checklist:**
1.  **Standard Deductions:** Verify for all filing statuses (Single, MFJ, MFS, Head of Household).
2.  **Ordinary Income Brackets:**
    *   Double-check the income thresholds for each rate (10%, 12%, 22%, 24%, 32%, 35%, 37%).
    *   Ensure the "Married Filing Separately" brackets are correct (often distinct from Single at high incomes).
    *   Ensure "Head of Household" brackets are correct.
3.  **Capital Gains Brackets:**
    *   Verify Long-Term Capital Gains thresholds (0%, 15%, 20%).
    *   **Important:** These apply to *taxable income*, not just the gains themselves.

## Healthcare Data (`src/data/healthcare_data.json`)

**Source:** KFF (Kaiser Family Foundation), CMS.gov (Medicare premiums).

**Verification Checklist:**
1.  **Pre-Medicare Costs:** Update the base annual cost for a private plan (Silver plan average is a good proxy).
2.  **Deductible:** Update `deductible` based on the average marketplace (Silver) plan deductible. Source: KFF or HealthCare.gov.
3.  **Medicare Costs:** Update Part B premiums + average Part D + Medigap estimates.
4.  **State Multipliers:** Review if certain states have significantly diverged in healthcare costs relative to the national average.

## State Tax Data (`src/data/state_tax_config.json`)

**Source:** State Department of Revenue websites, Tax Foundation "State Individual Income Tax Rates and Brackets", "State Capital Gains Tax Rates".

**Verification Checklist:**
1.  **No Tax States:** Ensure list is current (e.g., TX, FL, TN, WA, NV, etc.).
2.  **Flat Tax States:** Update the flat rate if changed.
3.  **Progressive States:**
    *   This file often uses a simplified model (e.g. top bracket or effective estimate).
    *   If a state undergoes major tax reform (e.g., switching from progressive to flat), update the `type` and `rate`.
4.  **Capital Gains:**
    *   The file now supports a `capital_gains_tax` object for each state.
    *   Default is `{"type": "same_as_income"}` which applies the income tax logic.
    *   If a state has a specific capital gains tax (e.g., WA, HI, MA), update this object with `flat` or `progressive` structure similar to `income_tax`.

## General Verification

*   Always run `npm test` after updating data files to ensure JSON structure is valid and logic doesn't break.
*   Check that `year` fields in the JSON files are updated to the target tax year.
