import express from 'express';
import jsonwebtoken from 'jsonwebtoken';
// Removed direct DB imports
// import { createUser, getUserByEmail, updateLastLogin, verifyPassword } from '../db/users.js';
import logger from '../logger.js'; // Import the logger
// Import the middleware we need
import { authenticateToken } from '../middleware/auth.js';

const jwt = jsonwebtoken;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'; // TODO: Ensure this is properly set in .env

// Wrap routes in a setup function that accepts db dependency
export default function setupAuthRoutes(userDb) {
    const router = express.Router();

    // Register a new user
    router.post('/register', async (req, res, next) => {
      try {
        const { email, password, name } = req.body;

        if (!email || !password || !name) {
          return res.status(400).json({ error: 'Email, password, and name are required' });
        }

        // Use injected dependency
        const user = await userDb.createUser(email, password, name);

        // Generate token
        const token = jwt.sign(
          { userId: user.id, email: user.email },
          JWT_SECRET,
          { expiresIn: '7d' }
        );

        // Use injected dependency
        await userDb.updateLastLogin(user.id);

        res.status(201).json({
          message: 'User registered successfully',
          user: {
            id: user.id,
            email: user.email,
            name: user.name
          },
          token
        });
      } catch (error) {
        if (error.message === 'User already exists') {
          return res.status(409).json({ error: 'User already exists' });
        }
        logger.error('Registration error:', { error: error.message, stack: error.stack, email: req.body.email });
        next(error);
      }
    });

    // Login
    router.post('/login', async (req, res, next) => {
      try {
        const { email, password } = req.body;

        if (!email || !password) {
          return res.status(400).json({ error: 'Email and password are required' });
        }

        // Use injected dependency
        const user = await userDb.getUserByEmail(email);

        if (!user) {
          return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Use injected dependency
        const isPasswordValid = await userDb.verifyPassword(password, user.password_hash);

        if (!isPasswordValid) {
          return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Generate token
        const token = jwt.sign(
          { userId: user.id, email: user.email },
          JWT_SECRET,
          { expiresIn: '7d' }
        );

        // Use injected dependency
        await userDb.updateLastLogin(user.id);

        res.json({
          message: 'Login successful',
          user: {
            id: user.id,
            email: user.email,
            name: user.name
          },
          token,
        });
      } catch (error) {
        logger.error('Login error:', { error: error.message, stack: error.stack, email: req.body.email });
        next(error);
      }
    });

    // Verify token validity
    router.get('/verify', authenticateToken, (req, res) => {
      // If authenticateToken middleware passes without error, the token is valid.
      // We get user info from the middleware via req.user.
      // It's good practice to send back some user info to confirm who is verified.
      res.status(200).json({
          message: 'Token is valid',
          user: { // Send back user info attached by middleware
              id: req.user.userId,
              email: req.user.email
              // We might need to fetch the name from DB if it's not in the token
          }
      });
    });

    return router; // Return the configured router
}

// Removed default export of router instance
