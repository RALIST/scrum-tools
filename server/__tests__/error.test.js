import request from 'supertest';
import { app } from '../index.js'; // Import app

describe('Error Handler Middleware', () => {

  it('should return 500 and generic message for unexpected errors', async () => {
    const res = await request(app).get('/api/test-error');
    
    expect(res.statusCode).toEqual(500);
    expect(res.body).toHaveProperty('status', 'error');
    expect(res.body).toHaveProperty('statusCode', 500);
    expect(res.body).toHaveProperty('message', 'Internal Server Error');
    // Stack trace should not be included by default in production/test
    expect(res.body).not.toHaveProperty('stack'); 
  });

  it('should return specific status code and message if set on error', async () => {
    const res = await request(app).get('/api/test-error-400');
    
    expect(res.statusCode).toEqual(400);
    expect(res.body).toHaveProperty('status', 'error'); // Or 'fail' depending on implementation
    expect(res.body).toHaveProperty('statusCode', 400);
    expect(res.body).toHaveProperty('message', 'Simulated bad request error');
    expect(res.body).not.toHaveProperty('stack');
  });

  // Note: Testing the NODE_ENV === 'development' stack trace requires setting the env var
  // You might need a separate test script or setup for that.
});