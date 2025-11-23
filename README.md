# Retirement Calculator Web App

**⚠️ STATUS: The live site is currently broken. Please see HACKING.md for local development instructions.**

A simple yet sophisticated web application designed to help US citizens determine if they can retire by a specific target date.

## Features

-   **Simple Interface**: A non-daunting, step-by-step wizard guides you through the process.
-   **Sophisticated Logic**:
    -   **Taxes**: Calculates Federal Income Tax (2025 brackets), State Income Tax (Configurable per state), and Capital Gains Tax.
    -   **Healthcare**: Estimates annual healthcare costs based on age, factoring in pre-Medicare private insurance curves and Medicare premiums (Part B/D/Medigap) with specific inflation rates.
    -   **Social Security**: Estimates benefits with actuarial adjustments for early (62+) or late (70) claiming.
    -   **Inflation & Growth**: Accounts for annual inflation and investment returns.
-   **Interactive Dashboard**:
    -   Visualizes the "First Year of Retirement" solvency formula.
    -   **Detailed Graphs**: Plots your Total Net Worth over time to visualize asset depletion or growth.
    -   **Transparency**: Displays all key assumptions (inflation, tax brackets, healthcare base costs) and allows comparing results across different US states instantly.
    -   Allows real-time tweaking of assumptions (Retirement Age, Expenses, Savings, etc.) via sliders.
    -   Provides an immediate "YES" or "NO" solvency answer with a suggested feasible retirement date if the plan fails.
-   **Persistence**: Automatically saves your progress to your browser's local storage so you don't lose your data.

## How it Works

1.  **Input**: Users provide their target date, age, location (state), financials, and savings breakdown.
2.  **Simulation**: The app runs a year-by-year cash flow simulation from the current age until age 95.
    -   It withdraws from taxable accounts first, then tax-advantaged accounts.
    -   It calculates taxes annually based on the specific withdrawal mix and income.
3.  **Result**: It determines if assets remain positive through the life expectancy.

## Hosting

The application is designed to be hosted on GitHub Pages.
