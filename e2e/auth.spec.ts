// e2e/auth.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test('should allow a user to log in successfully', async ({ page }) => {
    // TODO: Remove this mock when running against a real dev server with seeded data
    // Mock the API response for login
    await page.route('**/api/auth/login', async route => {
      console.log(`Intercepted ${route.request().method()} ${route.request().url()}`);
      const json = {
        user: { id: 'mock-user-123', name: 'Mock User', email: 'test@example.com' },
        token: 'mock-jwt-token-12345',
      };
      await route.fulfill({ json });
    });

    // Navigate to the login page
    await page.goto('/login');

    // Verify the login page heading is visible
    await expect(page.getByRole('heading', { name: 'Login' })).toBeVisible();

    // Fill in the email and password
    // IMPORTANT: Replace with actual test user credentials if hitting a real backend
    await page.getByLabel('Email').fill('test@example.com');
    await page.getByPlaceholder('Your password').fill('password123');

    // Click the login button
    await page.getByRole('button', { name: 'Log In' }).click();

    // Wait for navigation and assert the new URL or page content
    // Option 1: Check URL
    await expect(page).toHaveURL('/workspaces', { timeout: 10000 }); // Increased timeout for potential redirects/loading

    // Option 2: Check for an element unique to the workspaces page (more robust)
    // await expect(page.getByRole('heading', { name: 'Your Workspaces' })).toBeVisible({ timeout: 10000 });
  });

  // Add more tests later (e.g., failed login, registration)
});