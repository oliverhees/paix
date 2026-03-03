import { test, expect } from '@playwright/test';

const VALID_EMAIL = 'oliver@test.de';
const VALID_PASSWORD = 'test1234';
const WRONG_PASSWORD = 'wrongpassword999';

test.describe('Authentication', () => {
  test('login page renders with title and form fields', async ({ page }) => {
    await page.goto('/login');
    // Wait for client-side hydration
    await page.waitForLoadState('networkidle');

    // CardTitle renders as a <div data-slot="card-title">, not a semantic heading
    await expect(page.locator('[data-slot="card-title"]')).toContainText('Login');

    // Email and password inputs present
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();

    // Submit button present
    await expect(page.getByRole('button', { name: 'Login' })).toBeVisible();
  });

  test('login with valid credentials redirects to dashboard', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel('Email').fill(VALID_EMAIL);
    await page.getByLabel('Password').fill(VALID_PASSWORD);
    await page.getByRole('button', { name: 'Login' }).click();

    // After login, user should land on a dashboard route (not /login)
    await expect(page).not.toHaveURL(/\/login/, { timeout: 10000 });
  });

  test('unauthenticated user visiting /chat is redirected to /login', async ({ page }) => {
    // Clear any stored auth state
    await page.context().clearCookies();
    await page.addInitScript(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    await page.goto('/chat');

    // AuthGuard should redirect to /login
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });

  test('login with wrong password shows error message', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel('Email').fill(VALID_EMAIL);
    await page.getByLabel('Password').fill(WRONG_PASSWORD);
    await page.getByRole('button', { name: 'Login' }).click();

    // Error message should appear — the store sets error from API response
    const errorDiv = page.locator('.bg-destructive\\/10');
    await expect(errorDiv).toBeVisible({ timeout: 8000 });
  });
});
