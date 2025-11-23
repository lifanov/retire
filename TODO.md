# TODO

-   [ ] **Fix Broken Deployment**: Investigate why the live site is failing to load assets or scripts (likely 404s or build configuration mismatches).
-   [ ] **Real Data Fetching**: Implement actual scraping or API calls in `scripts/fetch_tax_data.js` to pull live IRS tax brackets instead of using hardcoded defaults.
-   [ ] **Granular State Taxes**: Improve `src/data/state_tax_config.json` with more precise brackets for all 50 states (currently a mix of exact and estimated models).
-   [ ] **Roth Accounts**: Add a specific input for Roth IRA/401k to handle tax-free withdrawals correctly.
-   [ ] **UI Polish**: Improve the mobile responsiveness of the Formula view in `Results.tsx`.
-   [ ] **Testing**: Add comprehensive unit tests for `RetirementCalculator.ts` to cover edge cases like "Start SS at 70" or "Retire at 40".
