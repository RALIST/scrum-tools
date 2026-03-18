# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Scrum Tools is a full-stack agile collaboration suite with four main features: Planning Poker, Retrospective Boards, Team Velocity Tracking, and Daily Standup Timer. It supports both anonymous (public rooms with optional passwords) and authenticated workspace modes.

## Development Commands

### Frontend (from project root)
```bash
npm run dev              # Vite dev server at http://localhost:5173
npm run build            # Production build
npm run lint             # ESLint (zero warnings enforced)
npm run lint:fix         # ESLint with auto-fix
npm run format           # Prettier format
npm test                 # Vitest unit tests (single run)
npm run test:e2e         # Playwright E2E tests (starts Vite dev server automatically)
```

### Backend (from `server/` directory)
```bash
npm run dev              # tsx watch mode
npm run build            # TypeScript compile to dist/
npm test                 # Jest tests (requires running PostgreSQL)
npm run db:migrate:latest    # Run Knex migrations
npm run db:migrate:rollback  # Rollback last migration
npm run db:migrate:make <name>  # Create new migration
```

### Running Both Servers
Start backend (`npm run server` from root, or `cd server && npm run dev`) and frontend (`npm run dev`) in separate terminals.

## Architecture

### Two Separate Node Projects
- **Root**: React frontend (Vite, TypeScript, Chakra UI)
- **`server/`**: Express backend (TypeScript, ESM, PostgreSQL)

Each has its own `package.json`, `tsconfig.json`, and test configuration. Install dependencies separately in each.

### Backend Dependency Injection
All route and socket modules export setup functions that receive DB modules as parameters. This is the core testability pattern — never import DB modules directly in routes/sockets.

```
server/index.ts → setupPokerRoutes(pokerDb, workspaceDb) → router
server/index.ts → initializePokerSocket(pokerIo, pokerDb) → void
```

### Dual Authentication
- `authenticateToken` — requires JWT (used for workspace/private routes)
- `optionalAuthenticateToken` — supports both anonymous and authenticated requests
- Workspace context determined by `workspace-id` request header

### Socket.IO Namespaces
Two typed namespaces: `/poker` and `/retro`. Event types defined in `server/types/sockets.ts`. Frontend hooks (`usePokerSocket`, `useRetroSocket`) manage socket lifecycle.

### Database
- PostgreSQL with connection pooling (`server/db/pool.ts`)
- Knex for migrations (`server/data/migrations/`, config in `server/knexfile.cjs` — CommonJS required by Knex)
- DB modules in `server/db/` — each module encapsulates queries for its domain
- Backend env loaded from `.env.development` (dev) or `.env` (prod) in the **project root** (not server/)

### Frontend Patterns
- Route-based code splitting via `React.lazy()` in `App.tsx`
- Context providers: `AuthContext`, `WorkspaceContext`
- Chakra UI v2 with dark/light theme (`src/theme.ts`)
- React Query for API caching

## Testing

- **Frontend unit tests**: Vitest + jsdom + React Testing Library. Config in `vitest.config.ts`. Tests in `src/**/*.{test,spec}.{ts,tsx}`.
- **Backend tests**: Jest with ts-jest ESM preset. Config in `server/jest.config.js`. Tests in `server/__tests__/`. Requires real PostgreSQL — no mocks for DB.
- **E2E**: Playwright (Chromium, Firefox, WebKit). Config in `playwright.config.ts`. Tests in `e2e/` directory.

## Key Conventions

- **Backend ESM imports require `.js` extensions** — e.g., `import foo from './bar.js'` even for `.ts` source files (NodeNext module resolution)
- **Pre-commit hook**: runs `lint-staged` (Prettier + ESLint fix on staged files)
- **Knex migrations use `.cjs` extension** (CommonJS required)
- Frontend ESLint excludes `server/` directory — server has its own linting context
