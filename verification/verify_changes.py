
import asyncio
from playwright.async_api import async_playwright, expect

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()

        await page.goto("http://localhost:3000/retire/")

        # Step 0: Date
        await page.locator("input[type='date']").fill('2040-01-01')
        await page.click('text=Next')

        # Step 1: Personal
        await page.locator("input[type='number']").first.fill('40')
        await page.select_option("select", 'CA')
        await page.click('text=Next')

        # Step 2: Financials
        inputs = await page.locator("input[type='number']").all()
        if len(inputs) >= 2:
            await inputs[0].fill('100000')
            await inputs[1].fill('50000')
        await page.click('text=Next')

        # Step 3: Assets
        # The button "Next (Apply Defaults)" MIGHT NOT EXIST if the input for "Total Savings Estimate" is empty.
        # By default, totalSavings is ''.
        # So we see "I know the breakdown (Show)" logic.
        # Actually, let's look at Wizard code again.
        # {showBreakdown && ( ... inputs ... )}
        # {showBreakdown ? <button>Next</button> : <button>Next (Apply Defaults)</button>}
        # Default showBreakdown is TRUE.
        # So the button text is just "Next".
        # And we need to fill the breakdown inputs or toggle the breakdown.

        # Let's fill the breakdown inputs as they are visible by default.
        assets_inputs = await page.locator("input[type='number']").all()
        # There should be 3 inputs (Total Estimate, Pre-Tax, Post-Tax)
        # But let's just find them by label or index.
        # Pre-Tax Savings
        # Post-Tax Savings
        # Note: Previous step inputs are gone (unmounted).
        if len(assets_inputs) >= 2:
             # The first one might be "Total Savings Estimate"
             # The next two are Pre/Post tax.
             # Let's fill all just in case.
             for inp in assets_inputs:
                 await inp.fill('10000')

        await page.click('button:has-text("Next")')

        # Step 4: SS
        await page.locator("input[type='number']").fill('25000')
        await page.click('text=Calculate')

        # Wait for results
        await expect(page.get_by_text("First Year of Retirement Snapshot")).to_be_visible()

        # Verify Graph header
        await expect(page.get_by_text("Total Net Worth Over Time")).to_be_visible()

        # Verify Assumptions Section and State Dropdown
        await expect(page.get_by_text("Assumptions & Details")).to_be_visible()

        # Change state
        await page.locator('select').select_option('TX')

        await page.wait_for_timeout(500)

        await page.screenshot(path="verification/results_page.png", full_page=True)

        await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
