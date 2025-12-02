# Retirement Calculator Web App

A simple yet sophisticated web application designed to help US citizens determine if they can retire by a specific target date.

## Features

-   **Simple Interface**: A non-daunting, step-by-step wizard guides you through the process.
-   **Sophisticated Logic**:
    -   **Taxes**: Calculates Federal Income Tax (2025 brackets for Single, MFJ, MFS, Head of Household), State Income Tax (Configurable per state), and Capital Gains Tax.
    -   **Healthcare**: Estimates annual healthcare costs based on age and **state of residence**, factoring in pre-Medicare private insurance curves and Medicare premiums (Part B/D/Medigap) with specific inflation rates.
    -   **HSA & Roth Support**: Prioritizes withdrawals from HSA (tax-free for healthcare), then Post-Tax (taxable), Pre-Tax (tax-deferred), and Roth (tax-free) to optimize tax efficiency.
    -   **Social Security**: Estimates benefits with actuarial adjustments for early (62+) or late (70) claiming.
    -   **Inflation & Growth**: Accounts for annual inflation and investment returns.
    -   **Asset Classes**: Supports Cash, Pre-Tax, Roth, and Taxable Investments with distinct growth and tax characteristics.
-   **Interactive Dashboard**:
    -   Visualizes the "First Year of Retirement" solvency formula.
    -   **Detailed Graphs**: Plots your Total Net Worth over time to visualize asset depletion or growth. Includes optional visualization of annual withdrawal amounts against safe limits.
    -   **Transparency**: Displays all key assumptions (inflation, tax brackets, healthcare base costs) and allows comparing results across different US states instantly.
    -   **Tweakable Assumptions**: Allows real-time tweaking of variables (Retirement Age, Expenses, Savings) and constants (Inflation, Return Rate, Safe Withdrawal Rate) to stress-test your plan.
    -   Provides an immediate "YES" or "NO" solvency answer with a suggested feasible retirement date if the plan fails.
-   **Persistence**: Automatically saves your progress to your browser's local storage so you don't lose your data.

## How it Works

1.  **Input**: Users provide their target date, age, tax filing status, location (state), financials, and savings breakdown (Pre-Tax, Roth, Post-Tax, HSA).
2.  **Simulation**: The app runs a year-by-year cash flow simulation from the current age until age 95.
    -   It follows a tax-efficient withdrawal strategy: HSA (for healthcare) -> Post-Tax -> Pre-Tax -> Roth.
    -   It calculates taxes annually based on the specific withdrawal mix and income.
3.  **Result**: It determines if assets remain positive through the life expectancy.

## Details: Financial Model & Assumptions

The simulator strives for high fidelity in its tax and expense modeling. Below are the key assumptions used in the calculations:

### Taxation
-   **Social Security**: Uses the Provisional Income method to calculate the taxable portion of benefits (0%, 50%, or 85% tiers) based on filing status thresholds.
-   **FICA**: Calculates Social Security (6.2% up to wage base) and Medicare (1.45%) taxes on labor income.
-   **Bracket Inflation**: Tax brackets and standard deductions are inflated annually by a fixed **2.5%** (approximating Chained CPI) to prevent unrealistic bracket creep, separate from the general inflation rate used for expenses.
-   **Capital Gains**: Gains are stacked on top of ordinary income to determine the applicable tax rate (0%, 15%, or 20%).
-   **Early Withdrawal Penalty**: A 10% penalty is applied to withdrawals from Pre-Tax accounts if the user is under age 60.

### Withdrawal Strategy (Order of Operations)
1.  **HSA**: Used first to cover qualified healthcare expenses (tax-free).
2.  **Cash**: Used next until depleted.
3.  **Post-Tax (Brokerage)**: Used next. Gains are calculated using a linear basis decay model (simulating selling recent lots first, then older lots).
4.  **Pre-Tax (401k/IRA)**: Used next. Withdrawals are taxed as ordinary income.
5.  **Roth**: Used last (tax-free).

### Healthcare
-   Costs are estimated based on age and state-specific multipliers.
-   **Pre-65**: Uses an age-curve for private insurance premiums.
-   **65+ (Medicare)**: Switches to a flat inflation-adjusted estimate for Medicare Part B, Part D, and Medigap.

### Data Sources
Key financial data (tax brackets, SS thresholds) is stored in `src/data/` and includes references to IRS Publications (Pub 15, Pub 915) for verification.

## Hosting

The application is designed to be hosted on GitHub Pages.
