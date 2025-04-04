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
// Import the initializers instead of the direct handlers
import { initializePokerSocket } from './sockets/poker.js';
import { initializeRetroSocket } from './sockets/retro.js';
// Removed unused db imports for poker disconnect logic
import { optionalAuthenticateToken } from './middleware/auth.js';
import errorHandler from './middleware/errorHandler.js'; // Import the error handler
import logger from './logger.js'; // Import the logger
import { fileURLToPath, pathToFileURL } from 'url'; // Import pathToFileURL for ES Module check

// Remove CommonJS helpers
// const require = createRequire(import.meta.url); 
// const __filename = fileURLToPath(import.meta.url); 

const app = express();
app.use(cors());
app.use(express.json());

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/workspaces', workspaceRoutes);
app.use('/api/history', historyRoutes);
app.use('/api', optionalAuthenticateToken, pokerRoutes);
app.use('/api', optionalAuthenticateToken, retroRoutes);
app.use('/api', optionalAuthenticateToken, velocityRoutes);

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

// Export app and server for testing
export { app, server };
