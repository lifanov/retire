# Data Maintenance Agents

This application relies on hardcoded data for tax calculations, healthcare costs, and other financial parameters. This data must be manually updated annually or when significant tax law changes occur.

## Files to Maintain

*   `src/data/federal_tax_data.json`: Federal tax brackets, standard deductions, and capital gains rates.
*   `src/data/state_tax_config.json`: State income tax rates, brackets, **standard deductions**, and capital gains configurations.
*   `src/data/healthcare_data.json`: Pre-Medicare and Medicare cost estimates.

## Update Instructions

### 1. Federal Tax Data (`federal_tax_data.json`)

*   **Source:** IRS Revenue Procedures (e.g., Rev. Proc. 24-xx for 2024 tax year).
*   **Fields:**
    *   `standard_deduction`: Update for Single, Married Jointly, Married Separately, and Head of Household.
    *   `brackets`: Update income thresholds for each tax bracket.
    *   `capital_gains`: Update income thresholds for 0%, 15%, and 20% rates.

### 2. State Tax Data (`state_tax_config.json`)

*   **Source:** State Department of Revenue websites, Tax Foundation, or reliable tax software summaries.
*   **Fields:**
    *   `income_tax`: Update rates and bracket thresholds.
    *   `standard_deduction`: **CRITICAL** - Ensure this reflects the *state-specific* standard deduction, not the federal one.
        *   If a state conforms to Federal, copy the Federal amount.
        *   If a state has no income tax, set to 0.
        *   If a state has a fixed/decoupled amount (e.g., CA, NY, VA), find the specific state amount for the tax year.
    *   `capital_gains_tax`: Check for specific state capital gains rules (e.g., WA 7% excise tax).

### 3. Healthcare Data (`healthcare_data.json`)

*   **Source:** Medicare.gov, KFF (Kaiser Family Foundation), and ACA exchange data.
*   **Fields:**
    *   `pre_medicare_annual_cost`: Estimate average Silver plan premiums.
    *   `medicare_annual_cost`: Update Part B premiums + average Medigap + Part D costs.
    *   `state_multipliers`: Adjust if certain states see massive deviation from national average.

## Verification

After updating data files:
1.  Run the application locally.
2.  Use the "Results" dashboard to verify that tax calculations for a sample high-income earner in a high-tax state (e.g., CA/NY) and a no-tax state (e.g., TX/FL) look reasonable compared to online tax calculators.
