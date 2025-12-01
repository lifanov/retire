from playwright.sync_api import sync_playwright

def verify_tax_inflation_input():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        # 1. Navigate to the app
        page.goto("http://localhost:4173/retire/")
        print("Loaded Page")

        # Handle Potential Starting States
        if page.get_by_text("YES").is_visible() or page.get_by_text("NO").is_visible():
             print("State: Results Page. Clicking Start Over.")
             page.get_by_text("Start Over").click()

        start_btn = page.get_by_role("button", name="Start Planning")
        if start_btn.is_visible():
             print("State: Welcome Page. Clicking Start Planning.")
             start_btn.click()

        if page.get_by_text("Target Retirement Date").is_visible():
             print("State: Step 1 (Target Date). Filling date.")
             page.get_by_label("Target Retirement Date").fill("2055-01-01")
             page.get_by_role("button", name="Next").click()

        # Step 2: About You
        print("State: Step 2 (About You).")
        # Sometimes fields are auto-filled from persistence.
        # Just click Next if fields are filled, or fill them.
        # Check if we can just click Next?
        # But let's try to fill.

        # Wait for animation?
        page.wait_for_timeout(500)

        # Try filling strictly if empty? Or just fill.
        # The timeout earlier suggests it couldn't find the 2nd input.
        # Maybe step 2 only has 1 input visible initially?

        # Let's just blindly fill current age and see if Next becomes enabled.
        if page.get_by_label("Current Age").is_visible():
            page.get_by_label("Current Age").fill("30")

        # Check if "Retirement Age" is visible? Maybe it's "Target Retirement Age"
        # The previous code used keyboard tab which is fragile if focus isn't right.
        # Let's use labels.

        # Assuming the labels are "Current Age", "Retirement Age", "Life Expectancy"
        if page.get_by_label("Retirement Age").is_visible():
             page.get_by_label("Retirement Age").fill("60")

        if page.get_by_label("Life Expectancy").is_visible():
             page.get_by_label("Life Expectancy").fill("90")

        page.get_by_role("button", name="Next").click()

        # Step 3: Location (Single, CA)
        print("State: Step 3 (Location).")
        page.wait_for_timeout(200)
        page.get_by_role("button", name="Next").click()

        # Step 4: Income
        print("State: Step 4 (Income).")
        page.wait_for_timeout(200)
        # Use placeholders or labels if possible
        if page.get_by_label("Annual Pre-Tax Income").is_visible():
             page.get_by_label("Annual Pre-Tax Income").fill("100000")
        elif page.locator("input[type='number']").count() > 0:
             page.locator("input[type='number']").first.fill("100000")

        # Expenses
        if page.get_by_label("Annual Expenses").is_visible():
             page.get_by_label("Annual Expenses").fill("50000")
        elif page.locator("input[type='number']").count() > 1:
             page.locator("input[type='number']").nth(1).fill("50000")

        page.get_by_role("button", name="Next").click()

        # Step 5: Savings
        print("State: Step 5 (Savings).")
        page.wait_for_timeout(200)
        page.get_by_placeholder("Total Amount").fill("500000")
        page.get_by_role("button", name="Next").click()

        # Step 6: Social Security
        print("State: Step 6 (Social Security).")
        page.wait_for_timeout(200)
        page.get_by_role("button", name="Calculate").click()
        print("Loaded Results Page")

        # 3. Open "Assumptions" tweak mode
        page.get_by_label("Tweak").check()

        # 4. Verify "Tax Bracket Inflation" input exists
        label = page.get_by_text("Tax Bracket Inflation")
        if label.is_visible():
            print("Found 'Tax Bracket Inflation' label.")

        # Take screenshot
        page.screenshot(path="verification_tax_inflation.png", full_page=True)
        print("Screenshot taken")

        browser.close()

if __name__ == "__main__":
    verify_tax_inflation_input()
