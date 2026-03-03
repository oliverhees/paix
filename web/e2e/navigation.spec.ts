import { test, expect } from '@playwright/test';

const VALID_EMAIL = 'oliver@test.de';
const VALID_PASSWORD = 'test1234';

/**
 * Helper: login and store auth tokens in localStorage so subsequent
 * page navigations start authenticated.
 */
async function loginViaUI(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(VALID_EMAIL);
  await page.getByLabel('Password').fill(VALID_PASSWORD);
  await page.getByRole('button', { name: 'Login' }).click();
  // Wait until we leave the login page
  await expect(page).not.toHaveURL(/\/login/, { timeout: 10000 });
}

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page);
  });

  test('/chat route is accessible after login', async ({ page }) => {
    await page.goto('/chat');
    // Should stay on /chat and not be redirected to /login
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8000 });
    await expect(page).toHaveURL(/\/chat/, { timeout: 8000 });
  });

  test('/telos route is accessible after login', async ({ page }) => {
    await page.goto('/telos');
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8000 });
    await expect(page).toHaveURL(/\/telos/, { timeout: 8000 });
  });

  test('/settings route is accessible after login', async ({ page }) => {
    await page.goto('/settings');
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8000 });
    await expect(page).toHaveURL(/\/settings/, { timeout: 8000 });
  });

  test('theme toggle opens dropdown with light/dark/system options', async ({ page }) => {
    await page.goto('/chat');

    // The theme toggle button has sr-only text "Theme wechseln"
    const themeButton = page.getByRole('button', { name: 'Theme wechseln' });
    await expect(themeButton).toBeVisible({ timeout: 8000 });

    // Open dropdown
    await themeButton.click();

    // Verify dropdown options appear
    await expect(page.getByRole('menuitem', { name: /Hell/i })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /Dunkel/i })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /System/i })).toBeVisible();

    // Click "Dunkel" to switch to dark mode
    await page.getByRole('menuitem', { name: /Dunkel/i }).click();

    // html element should have class "dark" after switching
    const htmlClass = await page.locator('html').getAttribute('class');
    expect(htmlClass).toContain('dark');
  });
});
