# Frontend Testing Plan

## 1. Analysis Summary

- **Stack:** React, TypeScript, Vite, Chakra UI, React Query, React Router, Socket.IO.
- **Current State:** No frontend tests. Backend has tests (`server/__tests__`).
- **Goal:** Establish a robust frontend testing strategy covering unit, integration, and end-to-end tests, prioritizing safety for upcoming refactoring.

## 2. Proposed Testing Strategy &amp; Tools

We'll adopt a standard testing pyramid approach: prioritizing Unit tests (most frequent, using Vitest + RTL), followed by Integration tests (Vitest + RTL), and finally End-to-End tests (fewest, using Playwright). However, the initial _implementation_ focus will be on Integration and E2E tests for critical areas to support refactoring.

- **Unit Tests (Vitest + React Testing Library):**
  - **Focus:** Test individual React components (especially presentational ones), utility functions (`src/utils`), simple hooks, and configuration logic (`src/theme.ts`, `src/config.ts`) in isolation. Will be added more comprehensively _after_ initial refactoring safety nets are in place.
  - **Goal:** Verify component rendering based on props, internal logic of hooks/utils. Fast execution.
  - **Mocks:** Mock dependencies (props, context, simple functions).
- **Integration Tests (Vitest + React Testing Library):**
  - **Focus:** **(Initial Priority)** Test interactions between several units – components rendering together, components interacting with hooks, context updates, routing changes within a feature.
  - **Goal:** Verify user flows within specific features (e.g., submitting a form, opening/closing modals, interacting with a specific tool like the Poker or Retro board). Provide safety net for refactoring internal implementation.
  - **Mocks:** Mock API calls (`apiUtils.ts`), WebSocket interactions (`usePokerSocket`, `useRetroSocket`), and potentially `react-router` (using `MemoryRouter`).
- **End-to-End (E2E) Tests (Playwright):**
  - **Focus:** **(High Priority for Core Flows)** Test critical user journeys across the entire application from the user's perspective.
  - **Goal:** Verify that complete workflows function correctly in a browser environment, including navigation, API interactions, and basic WebSocket message flows. Slower but provide high confidence for refactoring.
  - **Mocks:** Minimal mocks; ideally run against a real (or near-real) backend/environment.

## 3. Tooling Setup Plan

- **Install Dependencies:**
  - Unit/Integration: `npm install -D vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event` _(Completed)_
  - E2E: `npm install -D @playwright/test` followed by `npx playwright install`
- **Configure Vitest:**
  - Create `vitest.config.ts` with `environment: 'jsdom'`, `globals: true`, `setupFiles`, and `include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}']`. _(Completed)_
  - Create setup file (`src/setupTests.ts`) importing `@testing-library/jest-dom/vitest`. _(Completed)_
- **Configure Playwright:**
  - Initialize Playwright config: `playwright.config.ts`.
  - Configure `baseURL` (e.g., `http://localhost:5173` if using `npm run dev`).
  - Define projects for different browsers if needed.
- **Add Test Scripts to `package.json`:**
  ```json
  "scripts": {
    // ... existing scripts
    "test": "vitest", // Runs Vitest tests
    "test:ui": "vitest --ui", // Optional: Vitest UI
    "test:e2e": "playwright test", // Runs Playwright tests
    "test:e2e:report": "playwright show-report" // Optional: View Playwright report
  },
  ```
  _(Partially Completed - Vitest scripts added)_

## 4. Implementation Plan (Prioritizing Refactoring Safety)

- **Phase 1: Setup & Foundational Unit Tests:**
  - Execute tooling setup steps for Vitest/RTL (Dependencies, Config, Setup File, Scripts). _(Already Completed)_
  - Write initial unit tests for stable utility functions (e.g., `src/utils/localStorage` helpers). _(Partially Completed)_
- **Phase 2: Critical Flow Integration Tests:**
  - Write integration tests for the core Authentication flow (Login/Register pages in `src/pages/auth/`). Mock `AuthContext` and API calls. This ensures the fundamental entry point is stable.
- **Phase 3: First Refactor Target Integration Tests:**
  - Identify the first major feature area planned for refactoring (e.g., Retro Board, Poker Room, Workspaces).
  - Write integration tests covering the main user interactions and flows within that specific feature area (e.g., for Retro: viewing the board, adding/editing/voting on cards). Mock necessary hooks (like `useRetroSocket`) and API calls.
- **Phase 4 (Optional but Recommended): Core E2E Tests:**
  - Set up Playwright (Install dependencies, configure `playwright.config.ts`, add scripts).
  - Implement 1-3 essential E2E tests covering absolute critical paths, such as:
    - Successful user login and navigation to the main dashboard/workspace.
    - Basic loading and rendering of the first refactor target feature.
- **Phase 5: Refactor & Iterate:**
  - Begin refactoring the first target area, using the integration (and potentially E2E) tests as a safety net.
  - Add more focused unit tests for complex logic introduced or modified during refactoring _as needed_.
  - Repeat Phase 3 & 5 for subsequent refactoring targets, building integration test coverage before refactoring each area.
- **Phase 6: Broaden Coverage:**
  - Once major refactoring is stable, broaden test coverage by adding:
    - Integration tests for remaining features and flows.
    - Unit tests for core layout components (`Navbar`, `Footer`, etc.) and other reusable components.
    - More E2E tests for less critical but important user journeys.
  - Cover edge cases and error handling scenarios.

## 5. Mocking Strategy

- **APIs:** Use `vi.mock` in Vitest to mock the `src/utils/apiUtils.ts` module or specific functions within it. Return mock data.
- **WebSockets:** This is crucial. Mock the `socket.io-client` library or, more likely, the custom hooks (`usePokerSocket`, `useRetroSocket`). Provide mock functions to simulate receiving messages (`socket.emit`) and allow tests to simulate sending messages.
- **Contexts:** Use wrapper components in tests to provide mock context values or mock the context modules directly using `vi.mock`.
- **Routing:** Use `<MemoryRouter>` from `react-router-dom` in tests to control the route and test navigation/rendering based on routes.
- **External Libraries:** Mock libraries like `Chart.js` if their rendering interferes with tests or isn't the focus of the test.

## 6. CI Integration

- Configure your CI/CD pipeline (e.g., GitHub Actions, GitLab CI) to run `npm test` and `npm run test:e2e` on each push or pull request to the main branches. Ensure the environment for E2E tests can run the application (or use a dedicated test environment).
