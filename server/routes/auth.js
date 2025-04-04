import express from 'express';
import jsonwebtoken from 'jsonwebtoken';
import { createUser, getUserByEmail, updateLastLogin, verifyPassword } from '../db/users.js';
import logger from '../logger.js'; // Import the logger

const jwt = jsonwebtoken;

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'; // TODO: Ensure this is properly set in .env

// Register a new user
// Add 'next'
router.post('/register', async (req, res, next) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name are required' });
    }
    
    // Create the user
    const user = await createUser(email, password, name);
    
    // Generate token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    // Update last login
    await updateLastLogin(user.id);
    
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
      // Keep specific client error handling
      return res.status(409).json({ error: 'User already exists' });
    }
    // Use logger.error before passing to centralized handler
    logger.error('Registration error:', { error: error.message, stack: error.stack, email: req.body.email }); 
    // Pass error to the centralized handler
    next(error);
  }
});

// Login
// Add 'next'
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    // Find the user
    const user = await getUserByEmail(email);
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Verify password
    const isPasswordValid = await verifyPassword(password, user.password_hash);
    
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Generate token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    // Update last login
    await updateLastLogin(user.id);
    
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
    // Use logger.error before passing to centralized handler
    logger.error('Login error:', { error: error.message, stack: error.stack, email: req.body.email });
    // Pass error to the centralized handler
    // Pass error to the centralized handler
    next(error);
  }
});

// Verify token validity
// Import the middleware we need
import { authenticateToken } from '../middleware/auth.js'; 

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

export default router;
