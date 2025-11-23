import { test, expect } from '@playwright/test';

test('has title', async ({ page }) => {
  // We use the local preview URL
  await page.goto('/retire/');

  // Expect a title "to contain" a substring.
  await expect(page).toHaveTitle(/retirement-app/i);

  // Expect to see the Wizard "Target Date" step
  await expect(page.getByText('When do you want to retire?')).toBeVisible();
});
