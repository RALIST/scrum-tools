import bcrypt from 'bcryptjs';
import type {PoolClient, QueryResult} from 'pg';
import { v4 as uuidv4 } from 'uuid';
import type { User } from '../types/db.js'; // Import User interface (needs .js extension)
import { pool } from './pool.js'; // Import pool directly (needs .js extension)

function getPool() {
  if (!pool) throw new Error('Database pool is not initialized');
  return pool;
}

// Create a new user
export const createUser = async (email: string, password: string, name: string): Promise<User> => {
  const client: PoolClient = await getPool().connect(); // Assert pool type
  try {
    // Check if the user already exists
    const checkResult: QueryResult<User> = await client.query(
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
    const result: QueryResult<User> = await client.query(
      'INSERT INTO users (id, email, password_hash, name) VALUES ($1, $2, $3, $4) RETURNING id, email, name, created_at',
      [id, email, passwordHash, name]
    );
    
    const user = result.rows[0];
    if (!user) throw new Error('Expected user row not found after insert');
    return user;
  } finally {
    client.release();
  }
};

// Get a user by email
export const getUserByEmail = async (email: string): Promise<User | null> => {
  const client: PoolClient = await getPool().connect(); // Assert pool type
  try {
    const result: QueryResult<User> = await client.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    
    return result.rows[0] ?? null;
  } finally {
    client.release();
  }
};

// Get a user by ID
export const getUserById = async (id: string): Promise<User | null> => {
  const client: PoolClient = await getPool().connect(); // Assert pool type
  try {
    const result: QueryResult<User> = await client.query(
      'SELECT id, email, name, created_at FROM users WHERE id = $1',
      [id]
    );
    
    return result.rows[0] ?? null;
  } finally {
    client.release();
  }
};

// Update user last login time
export const updateLastLogin = async (userId: string): Promise<void> => {
  const client: PoolClient = await getPool().connect(); // Assert pool type
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
export const verifyPassword = async (password: string, passwordHash: string): Promise<boolean> => {
  return bcrypt.compare(password, passwordHash);
};