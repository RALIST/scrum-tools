import express, { type Router, type Request, type Response, type NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import type * as userDbFunctions from '../db/users.js'; // Import DB functions (needs .js)
import { authenticateToken } from '../middleware/auth.js';
import type { User } from '../types/db.js'; // Import User type (needs .js)
// Import the middleware we need (needs .js)

// Define the type for the injected userDb module
type UserDbModule = typeof userDbFunctions;

const JWT_SECRET = process.env.JWT_SECRET ?? 'your-secret-key'; // TODO: Ensure this is properly set in .env

// Wrap routes in a setup function that accepts db dependency
export default function setupAuthRoutes(userDb: UserDbModule): Router {
    const router: Router = express.Router();

    // Register a new user
    router.post('/register', async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { email, password, name } = req.body as { email: string; password: string; name: string };

        if (!email || !password || !name) {
          res.status(400).json({ error: 'Email, password, and name are required' });
          return;
        }

        // Use injected dependency
        const user: User = await userDb.createUser(email, password, name); // Removed pool

        // Generate token
        const token: string = jwt.sign(
          { userId: user.id, email: user.email },
          JWT_SECRET,
          { expiresIn: '7d' }
        );

        // Use injected dependency
        await userDb.updateLastLogin(user.id); // Removed pool

        res.status(201).json({
          message: 'User registered successfully',
          user: {
            id: user.id,
            email: user.email,
            name: user.name
          },
          token
        });
      } catch (error: unknown) {
        if (error instanceof Error && error.message === 'User already exists') {
          res.status(409).json({ error: 'User already exists' });
          return;
        }
        next(error);
      }
    });

    // Login
    router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { email, password } = req.body as { email: string; password: string };

        if (!email || !password) {
          res.status(400).json({ error: 'Email and password are required' });
          return;
        }

        // Use injected dependency
        const user: User | null = await userDb.getUserByEmail(email); // Removed pool

        if (!user) {
          res.status(401).json({ error: 'Invalid credentials' });
          return;
        }

        // Use injected dependency
        // Use non-null assertion for password_hash as logic ensures user exists
        if (!user.password_hash) {
          res.status(401).json({ error: 'Invalid credentials' });
          return;
        }
        const isPasswordValid: boolean = await userDb.verifyPassword(password, user.password_hash);

        if (!isPasswordValid) {
          res.status(401).json({ error: 'Invalid credentials' });
          return;
        }

        // Generate token
        const token: string = jwt.sign(
          { userId: user.id, email: user.email },
          JWT_SECRET,
          { expiresIn: '7d' }
        );

        // Use injected dependency
        await userDb.updateLastLogin(user.id); // Removed pool

        res.json({
          message: 'Login successful',
          user: {
            id: user.id,
            email: user.email,
            name: user.name
          },
          token,
        });
      } catch (error: unknown) {
        next(error);
      }
    });

    // Verify token validity
    router.get('/verify', authenticateToken, (req: Request, res: Response) => {
      // If authenticateToken middleware passes without error, the token is valid.
      // We get user info from the middleware via req.user.
      // It's good practice to send back some user info to confirm who is verified.
      const userId = req.user?.userId;
      const email = req.user?.email;
      if (!userId || !email) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      res.status(200).json({
          message: 'Token is valid',
          user: { // Send back user info attached by middleware
              id: userId,
              email: email
              // We might need to fetch the name from DB if it's not in the token
          }
      });
    });

    return router; // Return the configured router
}

// Removed default export of router instance
