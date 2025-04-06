import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import setupPokerRoutes from './routes/poker.js'; // Import setup function
import setupRetroRoutes from './routes/retro.js'; // Import setup function
import setupVelocityRoutes from './routes/velocity.js'; // Import setup function
import setupAuthRoutes from './routes/auth.js'; // Import setup function
import setupWorkspaceRoutes from './routes/workspaces.js'; // Import setup function
import { authenticateToken } from './middleware/auth.js'; // Import auth middleware
import { initializePokerSocket } from './sockets/poker.js';
import { initializeRetroSocket } from './sockets/retro.js';
import { optionalAuthenticateToken } from './middleware/auth.js';
import errorHandler from './middleware/errorHandler.js'; // Import the error handler
import logger from './logger.js'; // Import the logger
import { pathToFileURL } from 'url'; // Import pathToFileURL for ES Module check
import dotenv from 'dotenv'; // Import dotenv for environment variable management
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { initializePool } from './db/pool.js'; // Import the pool initialization function
// Import the actual database functions to inject
import * as retroDb from './db/retro.js';
import * as userDb from './db/users.js';
import * as pokerDb from './db/poker.js'; // Import poker DB functions
import * as velocityDb from './db/velocity.js'; // Import velocity DB functions
import * as workspaceDb from './db/workspaces.js'; // Import workspace DB functions

// Create proper __dirname equivalent for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const env = process.env.NODE_ENV || 'development';
console.log(`Current environment: ${env}`);

if (env == "development") {
   dotenv.config({ path: join(__dirname, '.env.development') });
   console.log('Development environment variables loaded from .env.development');
} else if (env == "production") {
   dotenv.config({ path: join(__dirname, '.env') });
   console.log('Production environment variables loaded from .env');
} else {
   console.warn('No environment variables loaded. Using default environment variables if available.');
}


initializePool(); // Initialize the database pool

const app = express();
app.use(cors());
app.use(express.json());

// Mount routes, injecting dependencies
app.use('/api/auth', setupAuthRoutes(userDb));
// Inject all required DB dependencies for workspaces
app.use('/api/workspaces', authenticateToken, setupWorkspaceRoutes(workspaceDb, userDb, pokerDb, retroDb, velocityDb));
app.use('/api/poker', optionalAuthenticateToken, setupPokerRoutes(pokerDb)); // Inject pokerDb
app.use('/api/retro', optionalAuthenticateToken, setupRetroRoutes(retroDb, workspaceDb)); // Add workspaceDb injection
// Inject velocityDb and workspaceDb
app.use('/api/velocity', optionalAuthenticateToken, setupVelocityRoutes(velocityDb, workspaceDb));

const server = createServer(app);
const io = new Server(server, {
    cors: {
        origin: "http://localhost:5173",
        methods: ["GET", "POST"]
    }
});

// Create namespaces for different features
const pokerIo = io.of('/poker');
const retroIo = io.of('/retro');

// Initialize socket namespaces
initializePokerSocket(pokerIo, pokerDb); // Pass pokerDb dependency
initializeRetroSocket(retroIo, retroDb); // Pass retroDb dependency

// --- Test Routes for Error Handling ---
app.get('/api/test-error', (req, res, next) => {
  // Simulate an unexpected error
  next(new Error('Simulated unexpected error'));
});

app.get('/api/test-error-400', (req, res, next) => {
  // Simulate an error with a specific status code
  const err = new Error('Simulated bad request error');
  err.statusCode = 400;
  next(err);
});
// --- End Test Routes ---

// Apply the centralized error handler *after* all routes
app.use(errorHandler);

// Use environment variable for port or default to 3001

// Dummy route for testing authenticateToken middleware
app.get('/api/test-auth', authenticateToken, (req, res) => {
  res.json({ message: 'Authenticated!', userId: req.user.userId });
});

const PORT = process.env.PORT || 3001;

// Start the server only if this file is run directly (ES Module way)
const isMainModule = import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
    server.listen(PORT, () => {
        // Use logger instead of console.log
        logger.info(`Server running on port ${PORT}`);
    });
}

// Export app, server, and io for testing
export { app, server, io };
