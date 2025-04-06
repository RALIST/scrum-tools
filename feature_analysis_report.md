# Feature Analysis Report

This report documents the findings from analyzing the interaction between the backend and frontend for various features of the scrum-tools application.

## Feature: Retro Board

**Analysis Date:** 2025-04-06

**Backend Files Analyzed:**

- `server/routes/retro.ts`
- `server/sockets/retro.ts`
- `server/db/retro.ts`
- `server/types/db.ts`
- `server/types/sockets.ts`

**Frontend Files Analyzed:**

- `src/pages/retro/RetroBoard.tsx`
- `src/hooks/useRetroSocket.ts`

**Findings:**

1.  **Naming Conventions:** Consistent difference between backend `snake_case` (e.g., `board_id`, `hide_cards_by_default`) and frontend `camelCase` (e.g., `boardId`, `hideCardsByDefault`). This is handled correctly but requires awareness during development.
2.  **Frontend Error Handling Type:** The `handleRetroError` function in `useRetroSocket.ts` accepts an error payload typed as `any`. Consider typing this more strictly, potentially using the server's `SocketErrorPayload` (`{ message: string }`) for improved type safety.

**Overall:** The interfaces and data flow seem reasonably well-aligned.

---

## Feature: Planning Poker

**Analysis Date:** 2025-04-06

**Backend Files Analyzed:**

- `server/routes/poker.ts`
- `server/sockets/poker.ts`
- `server/db/poker.ts`
- `server/types/db.ts`
- `server/types/sockets.ts`

**Frontend Files Analyzed:**

- `src/pages/poker/PlanningPokerRoom.tsx`
- `src/hooks/usePokerSocket.ts`

**Findings:**

1.  **Naming Conventions:** Similar `snake_case` (backend) vs. `camelCase` (frontend) difference as Retro Board. Handled correctly.
2.  **Frontend Error Handling Type:** The `handlePokerError` function in `usePokerSocket.ts` uses type `any`. Consider using `SocketErrorPayload` for better type safety.
3.  **Vote Type Discrepancy:** The frontend `vote` function (`usePokerSocket.ts`) sends a `string`. The backend (`PokerVotePayload`) expects `string | null`. The frontend currently cannot send `null` to clear a vote. If clearing votes is required, the frontend hook needs adjustment.
4.  **Participant Data Structure:** Backend DB function `getRoom` returns participants as a `Map`, while socket events and frontend state use an `Array`. This is consistent for the socket communication layer.
5.  **Initial Room Check:** The frontend page component correctly uses an HTTP request to check room status/password before attempting a socket connection.

**Overall:** Mostly aligned, with a potential issue in the frontend's handling of clearing votes.

---

## Feature: Authentication

**Analysis Date:** 2025-04-06

**Backend Files Analyzed:**

- `server/routes/auth.ts`
- `server/middleware/auth.ts`
- `server/db/users.ts`
- `server/types/db.ts` (User type)

**Frontend Files Analyzed:**

- `src/contexts/AuthContext.tsx`
- `src/pages/auth/Login.tsx`
- `src/pages/auth/Register.tsx`

**Findings:**

1.  **Mechanism:** Standard JWT approach. Backend generates tokens, frontend stores in `localStorage`. Backend middleware (`authenticateToken`, `optionalAuthenticateToken`) verifies tokens from `Authorization` header. Passwords hashed server-side (bcrypt).
2.  **Flow:**
    - **Frontend:** `AuthContext` manages token/user state, handles API calls (`/login`, `/register`, `/verify`). Login/Register pages use context.
    - **Backend:** `auth.ts` routes handle requests, use `users.ts` for DB, JWT library for tokens. `auth.ts` middleware protects endpoints.
3.  **Alignment:** API endpoints, payloads, and responses seem consistent between frontend and backend.
4.  **Potential Improvement (Security):** Storing JWTs in `localStorage` is vulnerable to XSS. Consider HttpOnly cookies set by the backend for better security.

**Overall:** Functionally aligned, standard JWT implementation with a noted security consideration regarding token storage.

---

## Feature: Team Velocity

**Analysis Date:** 2025-04-06

**Backend Files Analyzed:**

- `server/routes/velocity.ts`
- `server/db/velocity.ts`
- `server/types/db.ts` (VelocityTeam, VelocitySprint, SprintVelocity, TeamVelocityData, etc.)

**Frontend Files Analyzed:**

- `src/pages/velocity/TeamVelocity.tsx`
- `src/components/velocity/VelocityChart.tsx`
- `src/components/velocity/VelocityStats.tsx`
- `src/components/velocity/TeamSetupForm.tsx`
- `src/components/velocity/AddSprintModal.tsx`

**Findings:**

1.  **Mechanism:** Purely HTTP-based. Frontend calls backend API for team/sprint CRUD and velocity data retrieval.
2.  **Flow:**
    - **Frontend:** `TeamVelocity.tsx` manages state, calls API endpoints (`/api/velocity/...`), uses child components for UI.
    - **Backend:** `velocity.ts` routes handle requests, use `velocity.ts` DB functions. Likely protected by auth middleware.
3.  **Alignment:** API endpoints and data structures appear aligned between frontend and backend. `TeamVelocityData` matches `VelocityChart` expectations.
4.  **Naming Conventions:** `snake_case` (backend) vs. `camelCase` (frontend) difference persists, handled appropriately.
5.  **Data Types:** Points and averages stored as numbers/decimals (strings) in DB, handled as numbers in frontend.

**Overall:** The feature appears well-aligned between backend API and frontend implementation.

---

## Feature: Workspaces

**Analysis Date:** 2025-04-06

**Backend Files Analyzed:**

- `server/routes/workspaces.ts`
- `server/db/workspaces.ts`
- `server/types/db.ts` (Workspace, WorkspaceMember, WorkspaceInvitation, etc.)

**Frontend Files Analyzed:**

- `src/contexts/WorkspaceContext.tsx`
- `src/pages/workspaces/Workspaces.tsx`
- `src/pages/workspaces/WorkspaceDetail.tsx`
- `src/hooks/useWorkspaceTools.ts`
- `src/hooks/useWorkspaceMembers.ts`
- `src/components/workspaces/...` (various components)

**Findings:**

1.  **Mechanism:** Purely HTTP-based. Frontend uses `WorkspaceContext` for state and API interaction (CRUD for workspaces, members, invitations). Specific hooks fetch associated tools/members.
2.  **Flow:**
    - **Frontend:** `WorkspaceContext` fetches user's workspaces. `WorkspaceDetail.tsx` displays details, tools, members using context and hooks. Calls context functions for mutations.
    - **Backend:** `workspaces.ts` routes handle requests, use `workspaces.ts` DB functions. Other DB modules fetch associated tools. Auth middleware protects routes.
3.  **Alignment:** API endpoints and data structures seem well-aligned between frontend and backend.
4.  **Naming Conventions:** `snake_case` (backend) vs. `camelCase` (frontend) difference persists, handled appropriately.
5.  **Completeness:** Comprehensive CRUD for workspaces/members/invitations, except for workspace deletion which seems missing on both backend and frontend.

**Overall:** Robust and well-aligned feature, with a potential gap in workspace deletion functionality.

---

## Cross-Cutting Issues (Revised based on Final Understanding)

**Analysis Date:** 2025-04-06

**Files Analyzed:**

- `src/pages/retro/RetroBoard.tsx` (`fetchInitialBoardData` function)
- `server/routes/retro.ts` (`GET /:boardId` handler)
- `server/index.ts` (Middleware application)

**Findings:**

1.  **Retro Board Access Issue for Logged-in Users:** When a logged-in user creates/accesses a Retro Board associated with a workspace, they encounter an "Authentication failed..." error during the initial page load.
    - **Root Cause:** The frontend function `fetchInitialBoardData` in `src/pages/retro/RetroBoard.tsx` explicitly calls the backend API endpoint `GET /api/retro/:boardId` with authentication disabled (`includeAuth: false`).
    - **Impact:** Although the backend route correctly uses `optionalAuthenticateToken` and has logic to verify workspace membership _if_ a user token is provided, the frontend prevents this verification by not sending the token. This leads to the backend denying access (401 error) because it cannot confirm the authenticated user's membership for the workspace-associated board.
    - **Design Alignment:** The backend logic correctly supports the design (anonymous access to public boards, authenticated access to workspace boards), but the frontend implementation prevents it from working for authenticated users accessing workspace boards.

**Overall:** The primary issue identified is the frontend's incorrect configuration of the initial API call for Retro Board data, specifically setting `includeAuth: false`, which prevents the backend from verifying workspace membership for authenticated users.

---
