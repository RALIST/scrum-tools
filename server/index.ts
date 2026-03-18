import { createServer, type Server as HttpServer } from 'http';
import { dirname, join } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import cors from 'cors';
import dotenv from 'dotenv';
import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import { Server as SocketIOServer, type Namespace } from 'socket.io';
import * as pokerDb from './db/poker.js';
import { initializePool } from './db/pool.js';
import * as retroDb from './db/retro.js';
import * as userDb from './db/users.js';
import * as velocityDb from './db/velocity.js';
import * as workspaceDb from './db/workspaces.js';
import logger from './logger.js';
import { authenticateToken, optionalAuthenticateToken } from './middleware/auth.js';
import errorHandler from './middleware/errorHandler.js';
import setupAuthRoutes from './routes/auth.js';
import setupPokerRoutes from './routes/poker.js';
import setupRetroRoutes from './routes/retro.js';
import setupVelocityRoutes from './routes/velocity.js';
import setupWorkspaceRoutes from './routes/workspaces.js';
import { initializePokerSocket } from './sockets/poker.js';
import { initializeRetroSocket } from './sockets/retro.js';
import type {
    PokerClientToServerEvents, PokerServerToClientEvents, PokerInterServerEvents, PokerSocketData,
    RetroClientToServerEvents, RetroServerToClientEvents, RetroInterServerEvents, RetroSocketData
} from './types/sockets.js';

// Create proper __dirname equivalent for ESM
const __filename: string = fileURLToPath(import.meta.url);
const __dirname: string = dirname(__filename);

const env: string = process.env['NODE_ENV'] ?? 'development';

if (env === "development") {
   dotenv.config({ path: join(__dirname, '../.env.development') });
} else if (env === "production") {
   dotenv.config({ path: join(__dirname, '../.env') });
} else if (env === "test") {
   dotenv.config({ path: join(__dirname, '.env.test') });
}

if (process.env['NODE_ENV'] === "production") {
    logger.info('Running in production mode');
    logger.info('Environment variables loaded from .env file');
    logger.info("Database connection details:", {
      user: process.env['DB_USER'],
      host: process.env['DB_HOST'],
      database: process.env['DB_NAME'],
      port: process.env['DB_PORT']
    });
}

initializePool();

const app: Express = express();
app.use(cors());
app.use(express.json());

// Mount routes, injecting dependencies
app.use('/api/auth', setupAuthRoutes(userDb));
// Inject all required DB dependencies for workspaces
app.use('/api/workspaces', authenticateToken, setupWorkspaceRoutes(workspaceDb, userDb, pokerDb, retroDb, velocityDb)); // Pass velocityDb namespace
app.use('/api/poker', optionalAuthenticateToken, setupPokerRoutes(pokerDb, workspaceDb)); // Inject pokerDb and workspaceDb
app.use('/api/retro', optionalAuthenticateToken, setupRetroRoutes(retroDb, workspaceDb)); // Add workspaceDb injection
// Inject velocityDb and workspaceDb
app.use('/api/velocity', optionalAuthenticateToken, setupVelocityRoutes(velocityDb, workspaceDb)); // Pass velocityDb namespace

const server: HttpServer = createServer(app);
// Define the main IO server type (can be generic or more specific if needed)
const io = new SocketIOServer(server, {
    cors: {
        origin: "http://localhost:5173",
        methods: ["GET", "POST"]
    }
});

// Create namespaces for different features
// Type the namespaces using the defined event maps
const pokerIo = io.of('/poker') as Namespace<PokerClientToServerEvents, PokerServerToClientEvents, PokerInterServerEvents, PokerSocketData>;
const retroIo = io.of('/retro') as Namespace<RetroClientToServerEvents, RetroServerToClientEvents, RetroInterServerEvents, RetroSocketData>;

// Initialize socket namespaces
initializePokerSocket(pokerIo, pokerDb); // Pass pokerDb dependency
initializeRetroSocket(retroIo, retroDb); // Pass retroDb dependency

// --- Test Routes for Error Handling ---
app.get('/api/test-error', (_req: Request, _res: Response, next: NextFunction) => {
  // Simulate an unexpected error
  next(new Error('Simulated unexpected error'));
});

app.get('/api/test-error-400', (_req: Request, _res: Response, next: NextFunction) => {
  // Simulate an error with a specific status code
  const err = new Error('Simulated bad request error');
  (err as Error & { statusCode: number }).statusCode = 400;
  next(err);
});
// --- End Test Routes ---

// Apply the centralized error handler *after* all routes
app.use(errorHandler);

// Use environment variable for port or default to 3001

// Dummy route for testing authenticateToken middleware
app.get('/api/test-auth', authenticateToken, (req: Request, res: Response) => {
  // Assert req.user exists
  const userId = req.user?.userId;
  if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }
  res.json({ message: 'Authenticated!', userId });
});

const PORT: string | number = process.env['PORT'] ?? 3001;

// Start the server only if this file is run directly (ES Module way)
const mainArg = process.argv[1];
const isMainModule: boolean = !!mainArg && import.meta.url === pathToFileURL(mainArg).href;

if (isMainModule) {
    server.listen(PORT, () => {
      logger.info(`Server running on port ${String(PORT)}`);
    });
}

// Export app, server, and io for testing
export { app, server, io };
