import { test, expect } from '@playwright/test';

test.describe('Single-User Mode', () => {
  test('visiting / loads dashboard directly without login', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Should not be redirected to /login
    await expect(page).not.toHaveURL(/\/login/, { timeout: 10000 });
  });

  test('/login redirects to dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // Middleware should redirect /login to /
    await expect(page).not.toHaveURL(/\/login/, { timeout: 10000 });
  });

  test('/register redirects to dashboard', async ({ page }) => {
    await page.goto('/register');
    await page.waitForLoadState('networkidle');

    // Middleware should redirect /register to /
    await expect(page).not.toHaveURL(/\/register/, { timeout: 10000 });
  });
});
