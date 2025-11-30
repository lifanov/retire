# Data Maintenance Instructions for AI Agents

This file contains instructions for maintaining the hardcoded data used in the Retirement Simulator.
Future agents should consult this file when asked to update tax data, social security thresholds, or healthcare costs.

## Tax Rules & Social Security (`src/data/tax_rules.json`)

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

## Federal & State Tax Brackets (`src/data/federal_tax_data.json` & `state_tax_config.json`)

*   **Federal:** Run by `RetirementCalculator` which automatically inflates the base year brackets found in this file. To update the *base* year, find the latest IRS Revenue Procedure for tax brackets and standard deductions.
*   **State:** Update `state_tax_config.json` with new legislation. Note that some states have fixed brackets while others index them. The simulator applies inflation to these brackets unless configured otherwise (currently applies to all).

## Healthcare Costs (`src/data/healthcare_data.json`)

*   Update `medicare_annual_cost` with the latest Part B + Part D + Medigap average premiums.
*   Update `pre_medicare_annual_cost` with recent ACA benchmark silver plan data.
*   Includes pre-medicare base premiums, age multipliers, and state multipliers.
