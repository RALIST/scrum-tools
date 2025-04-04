import jsonwebtoken from 'jsonwebtoken';
import logger  from '../logger.js';
const jwt = jsonwebtoken;

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'; // Should be in env variables

export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
  
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    // Log the specific error but return a generic 401 for all token issues
    logger.warn('Token verification failed:', { error: error.message, tokenProvided: !!token }); 
    return res.status(401).json({ error: 'Invalid or expired token' }); // Changed 403 to 401
  }
};

// Optional middleware to make authentication optional
export const optionalAuthenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
  
  if (!token) {
    req.user = null;
    return next();
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    // Even in optional auth, if a token is provided but invalid, treat it as an auth failure for consistency?
    // Or just set req.user = null and let the route handler decide?
    // Let's keep the current behavior: set user to null and proceed.
    // If a route *needs* a valid user after optional auth, it should check req.user itself.
    logger.warn('Optional token verification failed:', { error: error.message });
    req.user = null; 
    next();
  }
};
