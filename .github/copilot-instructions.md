# Scrum Tools - AI Coding Agent Instructions

A comprehensive suite of free online tools for Agile/Scrum teams. Built with React, Node.js, and PostgreSQL.

## Features

### Planning Poker 🎯

- Real-time voting system for story points estimation
- Room-based collaboration with team members
- Configurable voting sequences (Fibonacci, T-Shirt sizes)
- Instant result visualization
- Password protection for rooms

### Retrospective Board 📝

- Digital board for sprint retrospectives
- Three-column format (What went well, What needs improvement, Action items)
- Real-time collaboration with team members
- Card voting system
- Timer for time-boxed discussions
- Password-protected boards
- Configurable card visibility

### Daily Standup Timer ⏱️

- Configurable timer for each team member
- Visual and audio notifications
- Easy team member management
- Total meeting duration tracking
- Mobile-friendly interface

### Team Velocity Tracker 📈

- Sprint velocity tracking and visualization
- Team-based data management
- Committed vs. Completed points tracking
- Average velocity statistics
- Completion rate analysis
- Password-protected team data
- Interactive velocity chart

## Tech Stack

### Frontend

- React with TypeScript
- Chakra UI for components
- Chart.js for data visualization
- Socket.io client for real-time features
- React Router for navigation
- Dark/Light theme support

### Backend

- Node.js with Express
- PostgreSQL database
- Socket.io for real-time communication
- RESTful API architecture
- JWT for authentication

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- PostgreSQL (v12 or higher)
- npm or yarn

### Installation

1. Clone the repository:
   \`\`\`bash
   git clone https://github.com/yourusername/scrum-tools.git
   cd scrum-tools
   \`\`\`

2. Install dependencies for both frontend and backend:
   \`\`\`bash

# Install frontend dependencies

npm install

# Install backend dependencies

cd server
npm install
\`\`\`

3. Set up the database:
   \`\`\`bash

# Create a PostgreSQL database

createdb scrum_tools

# Run the schema setup script

cd server
node db/schema.js
\`\`\`

4. Configure environment variables:
   \`\`\`bash

# In the server directory, create .env file

cp .env.example .env

# Update the .env file with your database credentials

\`\`\`

5. Start the development servers:
   \`\`\`bash

# Start the backend server

npm run server

# In a new terminal, start the frontend (from project root)

npm run dev
\`\`\`

The application will be available at http://localhost:5173

## Usage

### Planning Poker

1. Create a new room or join existing
2. Share room ID with team members
3. Select voting sequence
4. Vote on stories in real-time
5. Reveal votes and discuss

### Retrospective Board

1. Create a new board with password
2. Share board ID with team
3. Add cards to appropriate columns
4. Vote on important items
5. Use timer for focused discussions
6. Track action items

### Daily Standup Timer

1. Add team members
2. Set time limit per person
3. Start the timer
4. Get notifications when time is up
5. Track total meeting duration

### Team Velocity Tracker

1. Create a team with password
2. Add sprint data (committed/completed points)
3. View velocity trends
4. Analyze team performance
5. Track completion rates

## Contributing

1. Fork the repository
2. Create your feature branch (\`git checkout -b feature/AmazingFeature\`)
3. Commit your changes (\`git commit -m 'Add some AmazingFeature'\`)
4. Push to the branch (\`git push origin feature/AmazingFeature\`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- [Chakra UI](https://chakra-ui.com/) for the component library
- [Socket.io](https://socket.io/) for real-time functionality
- [Chart.js](https://www.chartjs.org/) for data visualization
- All contributors who have helped improve this project

## Architecture Overview

Full-stack agile tool suite with React/TypeScript frontend and Node.js/TypeScript backend supporting real-time collaboration.

### Core Features

- **Planning Poker**: Real-time story point estimation with configurable sequences (Fibonacci, T-shirt)
- **Retrospective Boards**: Three-column retro format with card voting and timers
- **Team Velocity Tracking**: Sprint velocity visualization with Chart.js
- **Daily Standup Timer**: Configurable team member timers
- **Workspace Management**: Multi-tenant authentication with JWT and workspace invitations

## Critical Architectural Patterns

### Dependency Injection System

The backend uses a consistent DI pattern for testability:

```typescript
// All route modules export setup functions accepting dependencies
export default function setupPokerRoutes(
  pokerDb: PokerDbModule,
  workspaceDb: WorkspaceDbModule
): Router {
  // Routes use injected dependencies, never direct imports
  const rooms = await pokerDb.getRooms();
}

// Entry point injects all dependencies
app.use('/api/poker', optionalAuthenticateToken, setupPokerRoutes(pokerDb, workspaceDb));
```

### Dual-Mode Authentication

- **Anonymous Mode**: Public rooms/boards with optional passwords
- **Workspace Mode**: JWT-authenticated with role-based access (admin/member)
- Routes use `optionalAuthenticateToken` middleware to support both modes

### Socket.IO Real-time Architecture

Two typed namespaces with dependency injection:

```typescript
// Typed socket definitions in types/sockets.ts
type TypedPokerNamespace = Namespace<PokerClientToServerEvents, PokerServerToClientEvents>;

// Socket handlers receive injected dependencies
initializePokerSocket(pokerIo, pokerDb);
```

### Database Layer

- PostgreSQL with Knex migrations in `server/data/migrations/`
- DB modules in `server/db/` encapsulate all database logic
- Connection pooling via `server/db/pool.ts`
- All DB functions handle their own connections internally

## Development Patterns

### Frontend React Patterns

- **Context Providers**: `AuthContext` and `WorkspaceContext` for global state
- **Custom Hooks**: Socket management (`usePokerSocket`, `useRetroSocket`) with cleanup
- **React Query**: Token verification and API caching
- **Chakra UI**: Component library with dark/light theme support

### API Route Structure

Routes follow workspace-aware patterns:

```typescript
// Workspace header determines context
const workspaceId = req.headers['workspace-id'];
if (userId && workspaceId) {
  // Workspace mode - verify membership
  const isMember = await workspaceDb.isWorkspaceMember(workspaceId, userId);
} else {
  // Anonymous/public mode
}
```

### Testing Strategy

- **Unit Tests**: Jest with dependency injection mocks
- **Integration Tests**: Real database with cleanup in `beforeEach`
- **Socket Tests**: Real Socket.IO connections with proper teardown
- **E2E Tests**: Playwright with dev server integration

## Build & Development

### Essential Commands

```bash
# Frontend development
npm run dev                    # Vite dev server (http://localhost:5173)
npm run build                  # Production build
npm test                       # Vitest unit tests
npm run test:e2e              # Playwright E2E tests

# Backend development
cd server
npm run dev                    # TypeScript watch mode
npm run build                  # Compile TypeScript
npm test                       # Jest tests with real DB
npm run db:migrate:latest      # Run Knex migrations
```

### Environment Setup

- Frontend: Vite with TypeScript, Chakra UI, React Query
- Backend: Node.js + TypeScript with ESM modules (`.js` imports required)
- Database: PostgreSQL with connection pooling

## Code Conventions

### File Organization

```
src/
  components/           # Reusable UI components
  contexts/            # React contexts (Auth, Workspace)
  hooks/               # Custom hooks (socket management)
  pages/               # Route components
  utils/               # API utilities

server/
  routes/              # Express routes with DI setup functions
  sockets/             # Socket.IO handlers with DI
  db/                  # Database modules (users, poker, retro, etc.)
  middleware/          # Auth middleware
  types/               # TypeScript definitions
```

### TypeScript Usage

- Strict typing with interface definitions in `types/`
- ESM modules requiring `.js` extensions in imports
- Non-null assertions (`!`) used after auth middleware validation
- Socket events strictly typed with custom interfaces

### Database Patterns

- All DB functions are async and handle their own connections
- Use `executeQuery` utility for simple queries
- Proper connection release in try/finally blocks
- Knex migrations for schema changes

## Common Integration Points

### Adding New Real-time Features

1. Define socket events in `types/sockets.ts`
2. Create DB module with DI pattern
3. Implement socket handlers with injected dependencies
4. Add custom React hook for socket management
5. Update route setup in `server/index.ts`

### Workspace Integration

For features supporting both anonymous and workspace modes:

1. Add `optionalAuthenticateToken` middleware
2. Check for `workspace-id` header and `req.user`
3. Verify workspace membership when required
4. Handle both authenticated and anonymous data access

### Testing New Components

- Use dependency injection for mocking in unit tests
- Real database connections for integration tests
- Socket tests require proper connection/disconnection cleanup
- E2E tests should test both anonymous and authenticated flows

## Security Considerations

- JWT tokens with 7-day expiration
- Password hashing with bcryptjs (10 rounds)
- SQL injection prevention via parameterized queries
- CORS configuration for development/production
- Workspace-based authorization for multi-tenant features
