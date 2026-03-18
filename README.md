# Scrum Tools

A full-stack agile collaboration suite for distributed teams. Supports both anonymous public rooms and authenticated workspaces with role-based access.

Built with React, TypeScript, Express, Socket.IO, and PostgreSQL.

## Features

### Planning Poker
- Real-time voting with configurable sequences (Fibonacci, T-Shirt sizes, etc.)
- Room-based sessions with optional password protection
- Live participant tracking, vote reveal, and reset
- Works anonymously or within a workspace

### Retrospective Board
- Three-column board: What went well / What needs improvement / Action items
- Real-time card creation, editing, and deletion
- Per-card voting system
- Configurable timer for time-boxed discussions
- Toggle card visibility and author name hiding
- Password-protected boards

### Team Velocity Tracker
- Sprint-by-sprint committed vs. completed points
- Average velocity and completion rate statistics
- Interactive velocity chart (Chart.js)
- Password-protected team data

### Daily Standup Timer
- Per-person configurable timer
- Visual and audio notifications
- Total meeting duration tracking

### Workspaces
- Authenticated multi-user collaboration spaces
- Role-based access (admin / member)
- Invitation system with time-limited tokens
- All tools (Poker, Retro, Velocity) available within workspace context

## Architecture

The project is split into two separate Node.js packages:

```
scrum-tools/
├── src/                  # React frontend (Vite + Chakra UI)
├── server/               # Express backend (TypeScript, ESM)
│   ├── routes/           # REST API endpoints
│   ├── sockets/          # Socket.IO namespace handlers
│   ├── db/               # Database query modules
│   ├── middleware/        # Auth & error handling
│   ├── data/migrations/  # Knex migrations (.cjs)
│   └── __tests__/        # Backend tests
├── e2e/                  # Playwright E2E tests
└── public/               # Static assets
```

- **Frontend**: React 18, Chakra UI v2, React Router, React Query, Socket.IO client
- **Backend**: Express, PostgreSQL (via `pg`), Socket.IO with `/poker` and `/retro` namespaces
- **Auth**: JWT-based with dual middleware (`authenticateToken` / `optionalAuthenticateToken`)
- **Real-time**: Socket.IO with typed events for Planning Poker and Retro Board

## Prerequisites

- Node.js v22+
- PostgreSQL v12+
- npm

## Getting Started

### 1. Clone and install dependencies

```bash
git clone <repo-url>
cd scrum-tools

# Frontend dependencies
npm install

# Backend dependencies
cd server
npm install
```

### 2. Configure the database

Create a PostgreSQL database and user:

```sql
CREATE USER scrum_user WITH PASSWORD 'your_password';
CREATE DATABASE scrum_tools OWNER scrum_user;
-- For running tests:
CREATE DATABASE scrum_tools_test OWNER scrum_user;
```

### 3. Set up environment variables

```bash
cd server
cp .env.example .env
```

Edit `.env` with your database credentials:

```env
DB_USER=scrum_user
DB_HOST=localhost
DB_NAME=scrum_tools
DB_PASSWORD=your_password
DB_PORT=5432
JWT_SECRET=your-secret-key
```

### 4. Run database migrations

```bash
cd server
npm run db:migrate:latest
```

### 5. Start development servers

In two separate terminals:

```bash
# Terminal 1 - Backend (from server/ directory)
npm run dev

# Terminal 2 - Frontend (from project root)
npm run dev
```

The app will be available at http://localhost:5173 (frontend) and http://localhost:3001 (API).

## Scripts

### Frontend (project root)

| Command | Description |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |
| `npm run lint` | ESLint (zero warnings enforced) |
| `npm run lint:fix` | ESLint with auto-fix |
| `npm run typecheck` | TypeScript type checking |
| `npm test` | Vitest unit tests |
| `npm run test:coverage` | Test coverage report |
| `npm run test:e2e` | Playwright E2E tests |

### Backend (`server/`)

| Command | Description |
|---|---|
| `npm run dev` | tsx watch mode |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run compiled production build |
| `npm test` | Vitest tests (requires PostgreSQL) |
| `npm run db:migrate:latest` | Run pending migrations |
| `npm run db:migrate:rollback` | Rollback last migration batch |
| `npm run db:migrate:make <name>` | Create a new migration |

## Testing

- **Frontend unit tests**: Vitest + jsdom + React Testing Library
- **Backend tests**: Vitest against a real PostgreSQL database (`scrum_tools_test`)
- **E2E tests**: Playwright across Chromium, Firefox, and WebKit

```bash
# Frontend tests
npm test

# Backend tests
cd server && npm test

# E2E tests (auto-starts Vite dev server)
npm run test:e2e
```

## License

MIT
