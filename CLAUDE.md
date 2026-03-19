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
npm run typecheck        # TypeScript type checking (tsc --noEmit)
npm test                 # Vitest unit tests (single run)
npm run test:coverage    # Tests with coverage report
npm run test:e2e         # Playwright E2E tests (auto-starts Vite dev server)
npm run knip             # Detect unused files, deps, and exports
```

### Backend (from `server/` directory)
```bash
npm run dev              # tsx watch mode
npm run build            # TypeScript compile to dist/
npm run lint             # ESLint (zero warnings enforced)
npm test                 # Vitest tests (requires running PostgreSQL)
npm run test:coverage    # Tests with coverage report
npm run db:migrate:latest    # Run Knex migrations
npm run db:migrate:rollback  # Rollback last migration
npm run db:migrate:make <name>  # Create new migration
npm run knip             # Detect unused files, deps, and exports
```

### Running a Single Test
```bash
npx vitest run src/path/to/file.test.tsx          # Single frontend test
cd server && npx vitest run __tests__/file.test.ts  # Single backend test
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
- Routes check for both `req.user` and `workspace-id` header to determine anonymous vs workspace mode

### Socket.IO Namespaces
Two typed namespaces: `/poker` and `/retro`. Event types defined in `server/types/sockets.ts`. Frontend hooks (`usePokerSocket`, `useRetroSocket`) manage socket lifecycle. Socket handlers also receive DB modules via DI.

### Database
- PostgreSQL with connection pooling (`server/db/pool.ts`)
- Knex for migrations (`server/data/migrations/`, config in `server/knexfile.cjs` — CommonJS required by Knex)
- DB modules in `server/db/` — each module encapsulates queries for its domain; all functions handle their own connections from pool
- Backend env loaded from `.env.development` (dev) or `.env` (prod) in the **project root** (not server/)

### Frontend–Backend Communication
- **API client**: `src/utils/apiUtils.ts` exports `apiRequest<T>()` — generic fetch wrapper that auto-injects auth token and workspace-id from localStorage
- **Config**: `src/config.ts` switches URLs based on `import.meta.env.DEV` — dev uses `localhost:3001`, prod uses `scrumtools.app`
- **No Vite proxy** — frontend calls backend directly at the configured URL
- **Sockets**: Frontend connects to `config.socketUrl` with namespace path (`/poker`, `/retro`)

### Frontend Patterns
- Route-based code splitting via `React.lazy()` in `App.tsx`
- Context providers: `AuthContext`, `WorkspaceContext`
- Chakra UI v2 with semantic color tokens for dark/light theme (`src/theme.ts`)
- React Query for API caching and token verification

## Testing

- **Frontend unit tests**: Vitest + jsdom + React Testing Library. Config in `vitest.config.ts`. Tests in `src/**/*.{test,spec}.{ts,tsx}`.
- **Backend tests**: Vitest. Config in `server/vitest.config.ts`. Tests in `server/__tests__/`. Requires real PostgreSQL — no mocks for DB. Tests run serially (`fileParallelism: false`, pool: `forks`) because they share a database.
- **E2E**: Playwright (Chromium, Firefox, WebKit). Config in `playwright.config.ts`. Tests in `e2e/` directory.
- **CI**: GitHub Actions (`.github/workflows/test.yml`) runs lint, frontend tests, and backend tests (with PostgreSQL 15 service container).

### Blog

Markdown-based blog at `/blog` for SEO content. No backend required — posts are bundled at build time.

- **Posts**: `src/content/blog/*.md` — each file has YAML frontmatter (title, description, date, slug, keywords, relatedTool) and markdown body
- **Loading**: `src/utils/blogUtils.ts` uses `import.meta.glob` with `?raw` to import all `.md` files at build time, parses with `front-matter`
- **Rendering**: `src/components/blog/MarkdownRenderer.tsx` wraps `react-markdown` with Chakra UI component overrides (internal links use React Router)
- **Pages**: `src/pages/blog/BlogIndex.tsx` (listing) and `src/pages/blog/BlogPost.tsx` (individual post)
- **SEO**: Each post gets `PageHelmet` with Article JSON-LD + BreadcrumbList. Blog index gets Blog JSON-LD

#### Adding a New Blog Post

1. Create `src/content/blog/<slug>.md` with frontmatter:
   ```yaml
   ---
   title: "Post Title"
   description: "Meta description for SEO"
   date: "YYYY-MM-DD"
   slug: "url-slug"
   keywords: "comma, separated, keywords"
   relatedTool: "/retro"  # tool path shown in RelatedTools section
   ---
   ```
2. Write markdown content with internal links to tools (e.g., `[Retro Board](/retro)`)
3. Add the post URL to `public/sitemap.xml`
4. No code changes needed — `import.meta.glob` auto-discovers new `.md` files

## Key Conventions

- **Backend ESM imports require `.js` extensions** — e.g., `import foo from './bar.js'` even for `.ts` source files (NodeNext module resolution)
- **Knex migrations use `.cjs` extension** (CommonJS required)
- Frontend ESLint excludes `server/` directory — server has its own linting context and ESLint config
- Both projects use ESLint flat config (v9) with zero-warnings enforcement
