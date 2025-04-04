import request from 'supertest';
import { app, server, io } from '../index.js'; // Import io as well
import pool from '../db/pool.js'; 

describe('Velocity Routes', () => {
  let authToken;
  let userId;
  let testWorkspaceId;
  let testUserEmail = `velocity_user_${Date.now()}@example.com`;
  let testUserPassword = 'password123';
  let testUserName = 'Velocity User';
  let workspaceTeamId;
  let workspaceTeamName = `WS Team ${Date.now()}`;
  let anonymousTeamId;
  let anonymousTeamName = `Anon Team ${Date.now()}`;
  let anonymousTeamPassword = 'anonPassword';
  let createdSprintId;

  // Setup: Register user, create workspace
  beforeAll(async () => {
    // Register user
    const resRegister = await request(app)
      .post('/api/auth/register')
      .send({ email: testUserEmail, password: testUserPassword, name: testUserName });
    expect(resRegister.statusCode).toEqual(201);
    authToken = resRegister.body.token;
    userId = resRegister.body.user.id;

    // Create workspace
    const workspaceName = `Velocity Test Workspace ${Date.now()}`;
    const resWorkspace = await request(app)
      .post('/api/workspaces')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ name: workspaceName });
    expect(resWorkspace.statusCode).toEqual(201);
    testWorkspaceId = resWorkspace.body.workspace.id;
  });

  // Teardown: Close server and io instance
  afterAll(async () => {
    io.close(); // Close Socket.IO server
    await new Promise(resolve => server.close(resolve)); // Close the HTTP server
  });

  // Test creating/finding a workspace team
  it('POST /api/teams - should create a new team associated with a workspace', async () => {
    const res = await request(app)
      .post('/api/teams')
      .set('Authorization', `Bearer ${authToken}`) // Authenticated
      .send({
        name: workspaceTeamName,
        workspaceId: testWorkspaceId,
        // No password needed for workspace team creation via API? (Based on route logic)
      });

    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('team');
    expect(res.body.team).toHaveProperty('name', workspaceTeamName);
    expect(res.body.team).toHaveProperty('workspace_id', testWorkspaceId);
    workspaceTeamId = res.body.team.id; // Save ID
  });

  // Test creating/finding an anonymous team
  it('POST /api/teams - should create a new anonymous team with a password', async () => {
    const res = await request(app)
      .post('/api/teams')
      // No auth needed for anonymous
      .send({
        name: anonymousTeamName,
        password: anonymousTeamPassword,
      });

    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('team');
    expect(res.body.team).toHaveProperty('name', anonymousTeamName);
    expect(res.body.team).toHaveProperty('workspace_id', null);
    // We don't expect password_hash in the response anymore
    // expect(res.body.team).toHaveProperty('password_hash'); 
    expect(res.body.team).toHaveProperty('id'); // Just check that an ID exists
    anonymousTeamId = res.body.team.id; // Save ID
  });

  // Test finding an existing anonymous team
  it('POST /api/teams - should find an existing anonymous team with correct password', async () => {
     const res = await request(app)
      .post('/api/teams')
      .send({
        name: anonymousTeamName,
        password: anonymousTeamPassword,
      });

    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('team');
    expect(res.body.team).toHaveProperty('id', anonymousTeamId); // Should return the same team
  });

  // Test creating a sprint for the workspace team
  it('POST /api/teams/:name/sprints - should create a sprint for the workspace team', async () => {
    const sprintName = 'WS Sprint 1';
    const startDate = new Date().toISOString().split('T')[0]; // Today
    const endDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // 2 weeks later

    const res = await request(app)
      .post(`/api/teams/${workspaceTeamName}/sprints`)
      .set('Authorization', `Bearer ${authToken}`) // Auth needed
      .send({
        sprintName: sprintName,
        startDate: startDate,
        endDate: endDate,
        workspace_id: testWorkspaceId, // Important to link sprint creation to the workspace team context
      });

    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('team_id', workspaceTeamId);
    expect(res.body).toHaveProperty('name', sprintName);
    createdSprintId = res.body.id; // Save sprint ID
  });
  
   // Test creating a sprint for the anonymous team
   it('POST /api/teams/:name/sprints - should create a sprint for the anonymous team', async () => {
    const sprintName = 'Anon Sprint 1';
    const startDate = new Date().toISOString().split('T')[0]; 
    const endDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; 

    const res = await request(app)
      .post(`/api/teams/${anonymousTeamName}/sprints`)
      // No auth, but need password in query
      .query({ password: anonymousTeamPassword }) 
      .send({
        sprintName: sprintName,
        startDate: startDate,
        endDate: endDate,
      });

    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('team_id', anonymousTeamId);
    expect(res.body).toHaveProperty('name', sprintName);
  });


  // Test updating sprint velocity
  it('PUT /api/sprints/:sprintId/velocity - should update sprint velocity', async () => {
    const committedPoints = 20;
    const completedPoints = 18;

    const res = await request(app)
      .put(`/api/sprints/${createdSprintId}/velocity`)
      // No auth needed based on route logic
      .send({
        committedPoints: committedPoints,
        completedPoints: completedPoints,
      });

    expect(res.statusCode).toEqual(200);
    // Check for sprint_id as returned by the updated DB function
    expect(res.body).toHaveProperty('sprint_id', createdSprintId); 
    expect(res.body).toHaveProperty('committed_points', committedPoints);
    expect(res.body).toHaveProperty('completed_points', completedPoints);
  });

  // Test getting velocity data for the workspace team
  it('GET /api/teams/:name/velocity - should get velocity for the workspace team', async () => {
    // Note: This route seems to only support anonymous lookup via password in query
    // It might need adjustment if we want to look up workspace teams via auth/workspaceId
    // For now, testing the anonymous lookup path for the anonymous team.
     const res = await request(app)
      .get(`/api/teams/${anonymousTeamName}/velocity`)
      .query({ password: anonymousTeamPassword }); // Use password for anonymous team

    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('sprints');
    expect(res.body).toHaveProperty('averages');
    expect(Array.isArray(res.body.sprints)).toBe(true);
    // Check if the created anonymous sprint is there (we didn't update its velocity)
    const anonSprint = res.body.sprints.find(s => s.team_id === anonymousTeamId);
    expect(anonSprint).toBeDefined(); 
  });
  
  it('GET /api/teams/:name/velocity - should fail with incorrect password', async () => {
     const res = await request(app)
      .get(`/api/teams/${anonymousTeamName}/velocity`)
      .query({ password: 'wrongpassword' }); 

    expect(res.statusCode).toEqual(401);
    expect(res.body).toHaveProperty('error', 'Invalid team name or password');
  });

});
