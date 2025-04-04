import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import pokerRoutes from './routes/poker.js';
import retroRoutes from './routes/retro.js';
import velocityRoutes from './routes/velocity.js';
import authRoutes from './routes/auth.js';
import workspaceRoutes from './routes/workspaces.js';
import historyRoutes from './routes/history.js';
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

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/workspaces', workspaceRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/poker', optionalAuthenticateToken, pokerRoutes);
app.use('/api/retro', optionalAuthenticateToken, retroRoutes);
app.use('/api/velocity', optionalAuthenticateToken, velocityRoutes);

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
initializePokerSocket(pokerIo);
initializeRetroSocket(retroIo);

// Apply the centralized error handler *after* all routes
app.use(errorHandler);

// Use environment variable for port or default to 3001
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
