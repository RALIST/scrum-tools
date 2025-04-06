// e2e/retro.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Retrospective Board Flow', () => {

  // Helper to perform login via UI (using API mock)
  async function login(page: any) {
     // TODO: Remove this mock when running against a real dev server with seeded data
    await page.route('**/api/auth/login', async route => {
      const json = {
        user: { id: 'mock-user-123', name: 'Mock User', email: 'test@example.com' },
        token: 'mock-jwt-token-12345',
      };
      await route.fulfill({ json });
    });

    await page.goto('/login');
    await page.getByLabel('Email').fill('test@example.com');
    await page.getByPlaceholder('Your password').fill('password123');
    await page.getByRole('button', { name: 'Log In' }).click();
    // Wait for navigation to workspaces page to confirm login worked
    await expect(page).toHaveURL('/workspaces', { timeout: 10000 });
  }

  test('should allow a logged-in user to view a retro board', async ({ page }) => {
    // Log in first
    await login(page);

    const boardId = 'test-board-123';
    const boardName = 'E2E Test Retro Board';

    // TODO: Remove this mock when running against a real dev server
    // Mock the initial board data fetch
    await page.route(`**/api/retro/${boardId}`, async route => {
        console.log(`Intercepted ${route.request().method()} ${route.request().url()}`);
        const json = {
            id: boardId,
            name: boardName,
            columns: [
                { id: 'c1', name: 'Went Well', cards: [] },
                { id: 'c2', name: 'To Improve', cards: [] },
            ],
            participants: [{ id: 'user-1', name: 'Mock User' }],
            hasPassword: false, // Assume no password for this test
            isPublic: true, // Assume public for simplicity
            // Add other necessary fields based on RetroBoardType
        };
        await route.fulfill({ json });
    });

    // Navigate to the retro board page
    await page.goto(`/retro/${boardId}`);

    // --- Interact with Join Modal if necessary ---
    // The component logic might show the modal if auto-join fails or isn't applicable.
    // We find the modal by its test ID (defined in the Vitest mock component).
    const joinModal = page.getByTestId('join-retro-modal');
    // Try clicking Join within the modal if it appears
    // Use a shorter timeout as it might not appear if auto-join works
    try {
      await joinModal.getByRole('button', { name: 'Join' }).click({ timeout: 3000 });
      console.log('Clicked Join button in modal.');
    } catch (e) {
      console.log('Join modal or button not found/clicked (might be expected if auto-join worked).');
    }

    // --- Assert Page Title ---
    // Since mocking socket state in E2E is complex, we'll verify the page loaded
    // by checking the title set by PageHelmet, which should use the board name
    // from the mocked API response.
    await expect(page).toHaveTitle(new RegExp(boardName), { timeout: 10000 });

  });

});