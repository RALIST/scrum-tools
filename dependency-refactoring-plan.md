# Dependency Injection Refactoring Plan

## Analysis Summary

The investigation confirms a significant inconsistency in how dependencies, particularly database access logic, are managed across the application:

1.  **Routes:** Use a partial dependency injection approach where DB modules are injected, but often require explicit passing of lower-level constructs like the database `pool` or the `executeQuery` utility, which are also directly imported within the route files. This explicit passing is not uniform across all DB modules or function calls.
2.  **Sockets:** Completely bypass dependency injection for database logic. They directly import and use specific functions from the DB modules, assuming these functions handle their own database access internally without needing `pool` or `executeQuery` passed in.

This mixed approach leads to:

- **Reduced Maintainability:** Changes to database connection handling might require modifications in many places (DB modules, route files).
- **Increased Complexity:** Developers need to remember which DB functions require `pool`, which require `executeQuery`, and which require neither.
- **Difficult Testing:** Mocking dependencies for unit testing becomes harder, especially for the socket handlers relying on direct imports.
- **Inconsistency:** Different parts of the application follow different patterns for accessing the same resources.

## Proposed Refactoring Plan

The goal is to establish a single, consistent dependency injection strategy for database access throughout the server.

**Core Idea:** All modules requiring database access (routes, sockets) should receive their necessary database logic (e.g., `userDb`, `pokerDb`) through injection. The database modules themselves should encapsulate the details of how they interact with the database (using the `pool` or `executeQuery` internally).

**Steps:**

1.  **Standardize DB Modules (`db/*.js`):**

    - **Goal:** Ensure all exported DB functions manage their own database connection/query execution internally.
    - **Action:** Modify functions in `db/users.js`, `db/workspaces.js`, `db/velocity.js`, and `db/poker.js` that currently accept `pool` or `executeQuery` as parameters OR pass `pool` explicitly to internal calls like `executeQuery`. Remove these parameters/arguments. Inside these functions, use the `pool` or `executeQuery` utility imported directly within the module.
    - **Example (Conceptual):**

      ```javascript
      // Inside db/workspaces.js
      import { pool } from "./pool.js"; // Import pool directly

      // Change this:
      // export const isWorkspaceMember = async (workspaceId, userId, pool) => { ... pool.query(...) ... }
      // To this:
      export const isWorkspaceMember = async (workspaceId, userId) => {
        // Use the pool imported within this module
        const client = await pool.connect();
        const result = await client.query("...", [workspaceId, userId]);
        client.release();
        // ...
      };
      ```

      ```javascript
      // Inside db/poker.js
      import { executeQuery } from "./dbUtils.js"; // Import executeQuery directly

      // Change this:
      // export const getRooms = async () => { ... await executeQuery(pool, queryText); ... }
      // To this:
      export const getRooms = async () => {
        // Use executeQuery imported within this module (assuming executeQuery handles pool internally)
        const result = await executeQuery(queryText);
        // ...
      };
      ```

2.  **Refactor Route Modules (`routes/*.js`):**

    - **Goal:** Rely solely on injected dependencies for database operations.
    - **Action:**
      - Remove all `import { pool } from '../db/pool.js';` statements.
      - Remove all `import { executeQuery } from '../db/dbUtils.js';` statements.
      - Modify all calls to functions from injected DB modules (e.g., `workspaceDb.isWorkspaceMember(...)`) to _no longer_ pass `pool` or `executeQuery` as arguments.

3.  **Refactor Socket Modules (`sockets/*.js`):**

    - **Goal:** Inject database dependencies instead of using direct imports.
    - **Action:**
      - Modify `initializePokerSocket` and `initializeRetroSocket` to accept the necessary DB modules as parameters (e.g., `initializePokerSocket(pokerIo, pokerDb)`).
      - Remove the direct `import { ... } from '../db/poker.js';` and `import { ... } from '../db/retro.js';` statements.
      - Inside the socket event handlers, use the functions from the _injected_ DB modules (e.g., `pokerDb.getRoom(...)`, `retroDb.addRetroCard(...)`).

4.  **Update Entry Point (`server/index.js`):**
    - **Goal:** Pass the required DB dependencies to the socket initialization functions.
    - **Action:** Modify the calls in `server/index.js`:
      - Change `initializePokerSocket(pokerIo);` to `initializePokerSocket(pokerIo, pokerDb);`
      - Change `initializeRetroSocket(retroIo);` to `initializeRetroSocket(retroIo, retroDb);` (Ensure `retroDb` is imported if not already).

## Visual Representation (Mermaid Diagram)

```mermaid
graph TD
    subgraph server/index.js
        I_Pool[initializePool()]
        I_UserDb[import * as userDb]
        I_PokerDb[import * as pokerDb]
        I_RetroDb[import * as retroDb]
        I_VelocityDb[import * as velocityDb]
        I_WorkspaceDb[import * as workspaceDb]

        I_SetupAuth[setupAuthRoutes(userDb)]
        I_SetupPoker[setupPokerRoutes(pokerDb, workspaceDb)]
        I_SetupRetro[setupRetroRoutes(retroDb, workspaceDb)]
        I_SetupVelocity[setupVelocityRoutes(velocityDb, workspaceDb)]
        I_SetupWorkspaces[setupWorkspaceRoutes(workspaceDb, userDb, pokerDb, retroDb, velocityDb)]

        I_InitPokerSock[initializePokerSocket(pokerIo, pokerDb)]
        I_InitRetroSock[initializeRetroSocket(retroIo, retroDb)]

        I_Pool --> I_UserDb & I_PokerDb & I_RetroDb & I_VelocityDb & I_WorkspaceDb;
        I_UserDb --> I_SetupAuth & I_SetupWorkspaces;
        I_PokerDb --> I_SetupPoker & I_SetupWorkspaces & I_InitPokerSock;
        I_RetroDb --> I_SetupRetro & I_SetupWorkspaces & I_InitRetroSock;
        I_VelocityDb --> I_SetupVelocity & I_SetupWorkspaces;
        I_WorkspaceDb --> I_SetupPoker & I_SetupRetro & I_SetupVelocity & I_SetupWorkspaces;

    end

    subgraph routes/auth.js
        R_Auth[Auth Routes]
        R_Auth_Dep(userDb)
        I_SetupAuth --> R_Auth_Dep --> R_Auth;
    end

    subgraph routes/poker.js
        R_Poker[Poker Routes]
        R_Poker_Dep1(pokerDb)
        R_Poker_Dep2(workspaceDb)
        I_SetupPoker --> R_Poker_Dep1 & R_Poker_Dep2 --> R_Poker;
    end

    subgraph routes/retro.js
        R_Retro[Retro Routes]
        R_Retro_Dep1(retroDb)
        R_Retro_Dep2(workspaceDb)
        I_SetupRetro --> R_Retro_Dep1 & R_Retro_Dep2 --> R_Retro;
    end

     subgraph routes/velocity.js
        R_Velocity[Velocity Routes]
        R_Velocity_Dep1(velocityDb)
        R_Velocity_Dep2(workspaceDb)
        I_SetupVelocity --> R_Velocity_Dep1 & R_Velocity_Dep2 --> R_Velocity;
    end

     subgraph routes/workspaces.js
        R_Workspaces[Workspaces Routes]
        R_Workspaces_Dep1(workspaceDb)
        R_Workspaces_Dep2(userDb)
        R_Workspaces_Dep3(pokerDb)
        R_Workspaces_Dep4(retroDb)
        R_Workspaces_Dep5(velocityDb)
        I_SetupWorkspaces --> R_Workspaces_Dep1 & R_Workspaces_Dep2 & R_Workspaces_Dep3 & R_Workspaces_Dep4 & R_Workspaces_Dep5 --> R_Workspaces;
    end

    subgraph sockets/poker.js
        S_Poker[Poker Socket Handlers]
        S_Poker_Dep(pokerDb)
        I_InitPokerSock --> S_Poker_Dep --> S_Poker;
    end

    subgraph sockets/retro.js
        S_Retro[Retro Socket Handlers]
        S_Retro_Dep(retroDb)
        I_InitRetroSock --> S_Retro_Dep --> S_Retro;
    end

    subgraph db/*.js (After Refactor)
        DB_Modules[DB Modules (userDb, pokerDb, etc.)]
        DB_Pool[pool (Internal Import)]
        DB_Utils[dbUtils (Internal Import)]
        DB_Modules -- Uses --> DB_Pool;
        DB_Modules -- Uses --> DB_Utils;
    end

    R_Auth -- Uses --> DB_Modules;
    R_Poker -- Uses --> DB_Modules;
    R_Retro -- Uses --> DB_Modules;
    R_Velocity -- Uses --> DB_Modules;
    R_Workspaces -- Uses --> DB_Modules;
    S_Poker -- Uses --> DB_Modules;
    S_Retro -- Uses --> DB_Modules;

    style DB_Pool fill:#f9f,stroke:#333,stroke-width:2px
    style DB_Utils fill:#f9f,stroke:#333,stroke-width:2px
```

## Revised Testing Strategy (ESM Compatibility)

The original code refactoring is complete. The following strategy addresses testing in an ES Module environment where standard `jest.mock` hoisting has limitations for mocking direct imports within the module under test.

1.  **DB Unit Tests (`*.db.test.js`):**

    - **Goal:** Test the logic within the DB module (e.g., `db/users.js`) and verify its interaction with its direct dependencies (`pool.js`, `dbUtils.js`).
    - **Method:**
      - Import the _actual_ dependency module (e.g., `import { pool } from '../db/pool.js';`, `import * as dbUtils from '../db/dbUtils.js';`).
      - Use `jest.spyOn()` to mock the specific _methods or functions_ called by the DB module under test (e.g., `jest.spyOn(pool, 'connect').mockResolvedValue(...)`, `jest.spyOn(dbUtils, 'executeQuery').mockResolvedValue(...)`).
      - In `beforeEach` or `beforeAll`, set up these spies.
      - In `afterEach` or `afterAll`, restore the original implementations using `mockRestore()` on the spies.
      - Ensure test assertions verify that the mocked dependency methods/functions were called correctly by the function under test.
      - Remove any arguments previously used to pass mocks directly into the DB functions being tested.

2.  **Socket/Route/Integration Tests:**
    - **Goal:** Test the logic of consumers (routes, sockets) and verify their interaction with the _public API_ of the DB modules.
    - **Method:**
      - Use `jest.mock()` to mock the _entire DB module_ being consumed (e.g., `jest.mock('../db/users.js', () => ({ createUser: jest.fn(), getUserByEmail: jest.fn(), ... }))`). This approach generally works better for mocking the direct imports of the _module under test_ (the route/socket handler).
      - Provide mock implementations for the specific DB functions needed by the test case within the `jest.mock` factory function.
      - Ensure test assertions verify that the route/socket handler correctly calls the mocked DB functions with the expected arguments.

This revised testing strategy avoids the pitfalls of standard `jest.mock` hoisting for deep dependencies in ESM while still allowing thorough testing at different levels.
