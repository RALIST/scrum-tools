import express, { Express, Request, Response, NextFunction } from 'express';
import { createServer, Server as HttpServer } from 'http';
import { Server as SocketIOServer, Namespace } from 'socket.io';
import cors from 'cors';
import setupPokerRoutes from './routes/poker.js';
import setupRetroRoutes from './routes/retro.js';
import setupVelocityRoutes from './routes/velocity.js';
import setupAuthRoutes from './routes/auth.js';
import setupWorkspaceRoutes from './routes/workspaces.js';
import { authenticateToken, optionalAuthenticateToken } from './middleware/auth.js';
import { initializePokerSocket } from './sockets/poker.js';
import { initializeRetroSocket } from './sockets/retro.js';
import errorHandler from './middleware/errorHandler.js';
import logger from './logger.js';
// Import types for Socket.IO namespaces
import {
    PokerClientToServerEvents, PokerServerToClientEvents, PokerInterServerEvents, PokerSocketData,
    RetroClientToServerEvents, RetroServerToClientEvents, RetroInterServerEvents, RetroSocketData
} from './types/sockets.js'; // Needs .js
import { pathToFileURL } from 'url'; // Import pathToFileURL for ES Module check
import dotenv from 'dotenv'; // Import dotenv for environment variable management
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { initializePool } from './db/pool.js'; // Import the pool initialization function
// Import DB modules (ensure paths have .js extension)
import * as retroDb from './db/retro.js';
import * as userDb from './db/users.js';
import * as pokerDb from './db/poker.js';
import * as velocityDb from './db/velocity.js';
import * as workspaceDb from './db/workspaces.js';

// Create proper __dirname equivalent for ESM
const __filename: string = fileURLToPath(import.meta.url);
const __dirname: string = dirname(__filename);

const env: string = process.env.NODE_ENV || 'development';

if (env == "development") {
   dotenv.config({ path: join(__dirname, '.env.development') });
} else if (env == "production") {
   dotenv.config({ path: join(__dirname, '.env') });
} else {
   //console.warn('No environment variables loaded. Using default environment variables if available.');
}

initializePool(); // Initialize the database pool

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
const pokerIo: Namespace<PokerClientToServerEvents, PokerServerToClientEvents, PokerInterServerEvents, PokerSocketData> = io.of('/poker');
const retroIo: Namespace<RetroClientToServerEvents, RetroServerToClientEvents, RetroInterServerEvents, RetroSocketData> = io.of('/retro');

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
  (err as any).statusCode = 400; // Add statusCode property (might need custom Error type)
  next(err);
});
// --- End Test Routes ---

// Apply the centralized error handler *after* all routes
app.use(errorHandler);

// Use environment variable for port or default to 3001

// Dummy route for testing authenticateToken middleware
app.get('/api/test-auth', authenticateToken, (req: Request, res: Response) => {
  // Assert req.user exists
  res.json({ message: 'Authenticated!', userId: req.user!.userId });
});

const PORT: string | number = process.env.PORT || 3001;

// Start the server only if this file is run directly (ES Module way)
const isMainModule: boolean = import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
    server.listen(PORT, () => {
        // Use logger instead of console.log
        logger.info(`Server running on port ${PORT}`);
    });
}

// Export app, server, and io for testing
export { app, server, io };
