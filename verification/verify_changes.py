
import asyncio
from playwright.async_api import async_playwright, expect

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()

        # Navigate
        try:
            await page.goto("http://localhost:5173/retire/", timeout=10000)
        except:
             await page.goto("http://localhost:5173/", timeout=10000)

        # Wait for app load
        await expect(page.locator("h1")).to_contain_text("Retirement Planner")

        # Step 0: Target Date
        await page.locator("input[type='date']").fill("2050-01-01")
        await page.get_by_role("button", name="Next").click()

        # Step 1: Personal Info
        await page.locator("input[type='number']").first.fill("30")
        await page.get_by_role("button", name="Next").click()

        # Step 2: Tax Filing Status
        await expect(page.get_by_text("Tax Filing Status")).to_be_visible()
        select = page.locator("select")
        await select.select_option("head_of_household")
        await page.get_by_role("button", name="Next").click()

        # Step 3: Financials
        inputs = page.locator("input[type='number']")
        await inputs.nth(0).fill("100000")
        await inputs.nth(1).fill("50000")
        await page.get_by_role("button", name="Next").click()

        # Step 4: Assets
        await expect(page.get_by_text("Current Savings")).to_be_visible()

        # Target the Total Savings input more robustly
        total_input = page.get_by_placeholder("Total Amount")
        await total_input.click()
        await total_input.fill("100000")

        pre_tax = page.locator("input[type='number']").nth(1)
        roth = page.locator("input[type='number']").nth(2)
        post_tax = page.locator("input[type='number']").nth(3)

        # Verify initial auto-fill (30/30/40 split)
        # 100000 * 0.3 = 30000
        # 100000 * 0.4 = 40000
        await expect(pre_tax).to_have_value("30000")
        await expect(roth).to_have_value("30000")
        await expect(post_tax).to_have_value("40000")

        # Test Validation Logic
        # Change Pre-Tax to 50000 (Sum becomes 50k + 30k + 40k = 120k != 100k)
        await pre_tax.fill("50000")

        # Verify others did not change
        await expect(roth).to_have_value("30000")
        await expect(post_tax).to_have_value("40000")

        # Try Next -> Expect Error
        await page.get_by_role("button", name="Next").click()

        # Verify Error Message
        await expect(page.get_by_text("does not match your total")).to_be_visible()

        # Verify Fix Button
        fix_btn = page.get_by_text("Reset to Default Split")
        await expect(fix_btn).to_be_visible()

        # Click Fix
        await fix_btn.click()

        # Verify values reset
        await expect(pre_tax).to_have_value("30000")
        await expect(roth).to_have_value("30000")
        await expect(post_tax).to_have_value("40000")
        await expect(page.get_by_text("does not match your total")).not_to_be_visible()

        # Proceed
        await page.get_by_role("button", name="Next").click()

        # Step 5: SS
        await page.get_by_role("button", name="Calculate").click()

        # Results Page
        # Just check net worth graph exists
        await expect(page.locator(".recharts-surface")).to_be_visible()

        # Verify Filing Status
        await expect(page.get_by_text("Head of Household", exact=False)).to_be_visible()

        # Verify Tweak Toggle
        tweak_chk = page.get_by_text("Tweak")
        await tweak_chk.click()

        # Check for Safe Withdrawal Rate input (value 4.0 by default)
        swr_input = page.locator("input[value='4.0']")
        await expect(swr_input).to_be_visible()

        # Change SWR to 5%
        await swr_input.fill("5.0")

        # Verify display update
        await expect(page.get_by_text("Safe Withdrawal (5.0%)")).to_be_visible()

        # Take screenshot
        await page.screenshot(path="verification/verification.png", full_page=True)

        await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
