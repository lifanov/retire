const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Navigate to local preview
  await page.goto('http://localhost:4174/retire/');

  // Wait for the main heading to be visible
  await page.waitForSelector('h2:has-text("When do you want to retire?")');

  // Take screenshot
  await page.screenshot({ path: 'verification/verification.png' });

  await browser.close();
})();
