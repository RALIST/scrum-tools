import request from 'supertest';
import { app, server, io } from '../index.js'; // Import io as well
import pool from '../db/pool.js'; 

// Basic test suite for authentication routes
describe('Auth Routes', () => {
  let testUserEmail = `testuser_${Date.now()}@example.com`;
  let testUserPassword = 'password123';
  let testUserName = 'Test User';
  let authToken;

  // Close the server and io instance after all tests are done
  afterAll(async () => {
    io.close(); // Close Socket.IO server
    await new Promise(resolve => server.close(resolve)); // Close the HTTP server
  });

  // Test user registration
  it('should register a new user successfully', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: testUserEmail,
        password: testUserPassword,
        name: testUserName,
      });
    
    expect(res.statusCode).toEqual(201);
    expect(res.body).toHaveProperty('message', 'User registered successfully');
    expect(res.body).toHaveProperty('user');
    expect(res.body.user).toHaveProperty('email', testUserEmail);
    expect(res.body.user).toHaveProperty('name', testUserName);
    expect(res.body).toHaveProperty('token');
    authToken = res.body.token; // Save token for later tests if needed
  });

  // Test registration with existing email
  it('should fail to register with an existing email', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: testUserEmail, // Use the same email
        password: 'anotherpassword',
        name: 'Another User',
      });
    
    expect(res.statusCode).toEqual(409);
    expect(res.body).toHaveProperty('error', 'User already exists');
  });

  // Test registration with missing fields
  it('should fail to register with missing fields', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: `missing_${Date.now()}@example.com`,
        // Missing password and name
      });
    
    expect(res.statusCode).toEqual(400);
    expect(res.body).toHaveProperty('error', 'Email, password, and name are required');
  });

  // Test successful login
  it('should login the registered user successfully', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: testUserEmail,
        password: testUserPassword,
      });
    
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('message', 'Login successful');
    expect(res.body).toHaveProperty('user');
    expect(res.body.user).toHaveProperty('email', testUserEmail);
    expect(res.body).toHaveProperty('token');
  });

  // Test login with incorrect password
  it('should fail to login with incorrect password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: testUserEmail,
        password: 'wrongpassword',
      });
    
    expect(res.statusCode).toEqual(401);
    expect(res.body).toHaveProperty('error', 'Invalid credentials');
  });

  // Test login with non-existent email
  it('should fail to login with non-existent email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: `nonexistent_${Date.now()}@example.com`,
        password: 'somepassword',
      });
    
    expect(res.statusCode).toEqual(401);
    expect(res.body).toHaveProperty('error', 'Invalid credentials');
  });

   // Test login with missing fields
   it('should fail to login with missing fields', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: testUserEmail,
        // Missing password
      });
    
    expect(res.statusCode).toEqual(400);
    expect(res.body).toHaveProperty('error', 'Email and password are required');
  });

});
