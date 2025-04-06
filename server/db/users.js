import { pool } from './pool.js'; // Import pool directly
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

// Create a new user
export const createUser = async (email, password, name) => { // Remove pool argument
  const client = await pool.connect();
  try {
    // Check if the user already exists
    const checkResult = await client.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    
    if (checkResult.rows.length > 0) {
      throw new Error('User already exists');
    }
    
    // Hash the password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    
    // Generate a unique ID
    const id = uuidv4();
    
    // Insert the new user
    const result = await client.query(
      'INSERT INTO users (id, email, password_hash, name) VALUES ($1, $2, $3, $4) RETURNING id, email, name, created_at',
      [id, email, passwordHash, name]
    );
    
    return result.rows[0];
  } finally {
    client.release();
  }
};

// Get a user by email
export const getUserByEmail = async (email) => { // Remove pool argument
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    
    return result.rows[0] || null;
  } finally {
    client.release();
  }
};

// Get a user by ID
export const getUserById = async (id) => { // Remove pool argument
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT id, email, name, created_at FROM users WHERE id = $1',
      [id]
    );
    
    return result.rows[0] || null;
  } finally {
    client.release();
  }
};

// Update user last login time
export const updateLastLogin = async (userId) => { // Remove pool argument
  const client = await pool.connect();
  try {
    await client.query(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
      [userId]
    );
  } finally {
    client.release();
  }
};

// Verify password
export const verifyPassword = async (password, passwordHash) => {
  return bcrypt.compare(password, passwordHash);
};