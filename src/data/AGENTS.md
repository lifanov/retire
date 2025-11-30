# Data Maintenance Instructions for AI Agents

This file contains instructions for maintaining the external data files used in the Retirement Simulator.
Future agents should consult this file when asked to update tax data, social security thresholds, or healthcare costs.

## 1. Tax Rules & Social Security (`src/data/tax_rules.json`)

This file contains critical constants for the financial model that are not automatically updated.

### Social Security Provisional Income Thresholds
These thresholds determine the taxable portion of Social Security benefits. They are **not** indexed for inflation (historically).
Source: IRS Publication 915 "Social Security and Equivalent Railroad Retirement Benefits"

**Reference Values (Check `src/data/tax_rules.json` for current code values):**

**Single, Head of Household, Qualifying Widow(er)**
*   Threshold 1 (0% -> 50%): $25,000
*   Threshold 2 (50% -> 85%): $34,000

**Married Filing Jointly**
*   Threshold 1 (0% -> 50%): $32,000
*   Threshold 2 (50% -> 85%): $44,000

**Married Filing Separately**
*   Thresholds are $0. 85% of benefits are taxable immediately (unless lived apart for entire year, which we simplify to standard MFS rules).

**To Update:**
1.  Search for "IRS Publication 915" or "Social Security tax thresholds".
2.  Update the `social_security_thresholds` object in `src/data/tax_rules.json`.

### FICA Tax Limits (2025 Base)
Source: IRS Publication 15 (Circular E)

**Reference Values (Check `src/data/tax_rules.json`):**
*   **Social Security Tax Rate:** 6.2%
*   **Medicare Tax Rate:** 1.45%
*   **Social Security Wage Base Limit:** $176,100 (This limit rises with average wages).

**To Update:**
1.  Search for "IRS Publication 15 Circular E" or "Social Security wage base limit [Year]".
2.  Update the `fica_tax` object in `src/data/tax_rules.json`. Update `ss_wage_base_2025` (the code inflates this automatically, but updating the base year provides accuracy).

### Tax Bracket Inflation
The simulator uses a fixed **2.5% inflation rate** (`TAX_BRACKET_INFLATION`) for tax brackets to mimic Chained CPI, separate from the user's general inflation input.

**To Update:**
1.  Verify the long-term assumption for Chained CPI if economic conditions shift significantly.
2.  Update `constants.TAX_BRACKET_INFLATION` in `src/data/tax_rules.json`.

## 2. Federal Tax Data (`src/data/federal_tax_data.json`)

This file contains the federal income tax brackets and standard deductions for the *current* base year. The application automatically inflates these values for future years in the simulation.

**Source:** Latest IRS Revenue Procedure for Inflation Adjustments (e.g., "Revenue Procedure 2024-40").

**Fields to Maintain:**
*   `year`: The tax year these numbers represent.
*   `standard_deduction`: Object containing flat deduction amounts for `single`, `married_filing_jointly`, `married_filing_separately`, and `head_of_household`.
*   `brackets`: Object containing arrays of tax brackets for each filing status.
    *   `rate`: The decimal tax rate (e.g., 0.10, 0.12).
    *   `min`: The lower bound of taxable income for this bracket.
    *   `max`: The upper bound (use `null` for the highest bracket).
*   `capital_gains`: Similar structure to `brackets` but for Long-Term Capital Gains rates (0%, 15%, 20%).

**To Update:**
1.  Locate the IRS Revenue Procedure for the new tax year.
2.  Update all bracket `min`/`max` values and standard deductions.
3.  Ensure `capital_gains` brackets are also updated (usually found in the same IRS document).

## 3. State Tax Configuration (`src/data/state_tax_config.json`)

This file contains specific income tax logic for all 50 US states (plus DC).

**Source:** State Department of Revenue websites or aggregated tax summaries (e.g., Tax Foundation).

**Critical Information & Warnings:**
*   **Standard Deductions:** Many states have their own standard deductions that differ from Federal. Do **not** assume they match Federal. Some states (like PA) have *no* standard deduction.
*   **Progressive vs. Flat:**
    *   `type: "flat"`: Use `rate` (e.g., 0.0425).
    *   `type: "progressive"`: Use `brackets` array (same structure as Federal).
*   **Capital Gains:**
    *   Most states tax capital gains as ordinary income (`type: "same_as_income"`).
    *   Some have specific treatment (e.g., WA 7% excise tax on gains >$250k). Use the `capital_gains_tax` object for these exceptions.
*   **No Income Tax States:** (AK, FL, NV, SD, TN, TX, WY, NH, WA). Ensure `income_tax` type is `none` (or specific for WA/NH capital gains/interest).

**To Update:**
1.  Check for significant state tax legislation changes annually.
2.  If a state moves from progressive to flat (e.g., GA, IA recent changes), change the `type` and remove `brackets`.

## 4. Healthcare Costs (`src/data/healthcare_data.json`)

This file drives the healthcare expense estimation model.

**Source:** KFF (Kaiser Family Foundation) Average Premiums, Medicare.gov.

**Fields to Maintain:**
*   `medicare_annual_cost`:
    *   `part_b_monthly`: Standard Part B premium.
    *   `part_d_average`: Average Part D plan premium.
    *   `medigap_average`: Average Medigap (Plan G) premium.
    *   `total`: The sum of the above * 12.
*   `pre_medicare_annual_cost`:
    *   `base`: National average annual premium for a Silver plan for a 40-year-old (benchmark).
    *   `deductible`: Average deductible for a Silver plan.
    *   `age_multiplier`: The curve factor for age-based pricing (typically 3:1 ratio from age 21 to 64).
*   `state_multipliers`: A dictionary of state codes (e.g., "CA", "TX") to multipliers relative to the national average.
    *   **Source:** CMS Marketplace Open Enrollment Public Use Files (average premiums by state).

**To Update:**
1.  Annually review Medicare Part B premiums and adjust `medicare_annual_cost`.
2.  Review ACA exchange rate changes to update `pre_medicare_annual_cost.base` and `state_multipliers`.
