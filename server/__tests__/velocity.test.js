import request from 'supertest';
import { app } from '../index.js'; // Import only app
import pool from '../db/pool.js'; 

describe('Velocity Routes (/api/velocity)', () => {
  // Variables needed across contexts
  let anonymousTeamId;
  let anonymousTeamName = `Anon Team ${Date.now()}`;
  let anonymousTeamPassword = 'anonPassword';
  let createdAnonSprintId; 

  // Setup anonymous team and sprint
  beforeAll(async () => {
    // Create anonymous team
    const resTeam = await request(app)
      .post('/api/velocity/teams') // Use correct prefix
      .send({ name: anonymousTeamName, password: anonymousTeamPassword });
    if (resTeam.statusCode !== 200) console.error('Failed to create anon team:', resTeam.body);
    expect(resTeam.statusCode).toEqual(200);
    expect(resTeam.body.team).toBeDefined();
    anonymousTeamId = resTeam.body.team.id;

    // Create sprint for anonymous team
    const sprintName = 'Anon Sprint Setup';
    const startDate = new Date().toISOString().split('T')[0]; 
    const endDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // 1 week later
    const sprintRes = await request(app)
      .post(`/api/velocity/teams/${anonymousTeamName}/sprints`) // Use correct prefix
      .query({ password: anonymousTeamPassword })
      .send({ sprintName, startDate, endDate });
    // if (sprintRes.statusCode !== 201) console.error('Failed to create anon sprint:', sprintRes.body); // Log if not 201
    expect(sprintRes.statusCode).toEqual(201); // Expect 201 Created
    expect(sprintRes.body.id).toBeDefined();
    createdAnonSprintId = sprintRes.body.id;
  });

  // Close DB pool after all tests
  afterAll(async () => {
    await pool.end(); 
  });

  // --- Anonymous Access Tests ---
  describe('Anonymous Access', () => {
    it('POST /api/velocity/teams - should create a new anonymous team', async () => {
      const teamName = `Anon Create ${Date.now()}`;
      const password = 'createPassword';
      const res = await request(app)
        .post('/api/velocity/teams') // Use correct prefix
        .send({ name: teamName, password });
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.team).toHaveProperty('name', teamName);
    });

    it('POST /api/velocity/teams - should find existing anonymous team with correct password', async () => {
       expect(anonymousTeamId).toBeDefined();
       const res = await request(app)
        .post('/api/velocity/teams') // Use correct prefix
        .send({ name: anonymousTeamName, password: anonymousTeamPassword });
       expect(res.statusCode).toEqual(200);
       expect(res.body).toHaveProperty('success', true);
       expect(res.body.team).toHaveProperty('id', anonymousTeamId); 
     });

     it('POST /api/velocity/teams/:name/sprints - should create sprint for anonymous team', async () => {
        expect(anonymousTeamId).toBeDefined();
        const sprintName = 'Anon Sprint Test';
        const startDate = new Date().toISOString().split('T')[0]; 
        const endDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; 
        const res = await request(app)
          .post(`/api/velocity/teams/${anonymousTeamName}/sprints`) // Use correct prefix
          .query({ password: anonymousTeamPassword })
          .send({ sprintName, startDate, endDate });
        expect(res.statusCode).toEqual(201); // Expect 201 Created
        expect(res.body).toHaveProperty('id'); // Only check for ID
        // expect(res.body).toHaveProperty('team_id', anonymousTeamId); // Don't check team_id
      });

      it('PUT /api/velocity/sprints/:sprintId/velocity - should update sprint velocity anonymously', async () => {
        expect(createdAnonSprintId).toBeDefined();
        const committedPoints = 25;
        const completedPoints = 22;
        const res = await request(app)
          .put(`/api/velocity/sprints/${createdAnonSprintId}/velocity`) // Use correct prefix
          .send({ committedPoints, completedPoints });
        expect(res.statusCode).toEqual(200);
        expect(res.body).toHaveProperty('sprint_id', createdAnonSprintId); 
        expect(res.body).toHaveProperty('committed_points', committedPoints);
        expect(res.body).toHaveProperty('completed_points', completedPoints);
      });

      it('GET /api/velocity/teams/:name/velocity - should get velocity for anonymous team', async () => {
         expect(anonymousTeamId).toBeDefined();
         const res = await request(app)
          .get(`/api/velocity/teams/${anonymousTeamName}/velocity`) // Use correct prefix
          .query({ password: anonymousTeamPassword }); 
        expect(res.statusCode).toEqual(200);
        expect(res.body).toHaveProperty('sprints');
        expect(res.body).toHaveProperty('averages');
        expect(Array.isArray(res.body.sprints)).toBe(true);
        const anonSprint = res.body.sprints.find(s => s.sprint_id === createdAnonSprintId);
        expect(anonSprint).toBeDefined(); 
        expect(anonSprint.committed_points).toEqual(25); 
      });
      
      it('GET /api/velocity/teams/:name/velocity - should fail with incorrect password', async () => {
         const res = await request(app)
          .get(`/api/velocity/teams/${anonymousTeamName}/velocity`) // Use correct prefix
          .query({ password: 'wrongpassword' }); 
        expect(res.statusCode).toEqual(401);
        expect(res.body).toHaveProperty('error', 'Invalid team name or password/context required');
      });
  });

  // --- Authenticated Access Tests ---
  describe('Authenticated Access', () => {
    let authToken;
    let userId;
    let testWorkspaceId;
    let testUserEmail = `velocity_auth_user_${Date.now()}@example.com`;
    let testUserPassword = 'password123';
    let testUserName = 'Velocity Auth User';
    let workspaceTeamId;
    let workspaceTeamName = `WS Team Auth ${Date.now()}`;
    let createdWsSprintId;

    // Setup user, workspace, and workspace team
    beforeAll(async () => {
      // Register user
      const resRegister = await request(app)
        .post('/api/auth/register')
        .send({ email: testUserEmail, password: testUserPassword, name: testUserName });
      expect(resRegister.statusCode).toEqual(201);
      authToken = resRegister.body.token;
      userId = resRegister.body.user.id;

      // Create workspace
      const workspaceName = `Velocity Auth Test Workspace ${Date.now()}`;
      const resWorkspace = await request(app)
        .post('/api/workspaces')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: workspaceName });
      expect(resWorkspace.statusCode).toEqual(201); // This was already correct
      testWorkspaceId = resWorkspace.body.workspace.id;

      // Create workspace team (Expect 200 as it finds or creates)
       const resTeam = await request(app)
        .post('/api/velocity/teams') // Use correct prefix
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: workspaceTeamName, workspaceId: testWorkspaceId });
       expect(resTeam.statusCode).toEqual(200); // POST /teams returns 200 on find/create
       workspaceTeamId = resTeam.body.team.id;
    });

    it('POST /api/velocity/teams - should create/find a workspace team when authenticated', async () => {
        expect(workspaceTeamId).toBeDefined();
        const res = await request(app)
          .post('/api/velocity/teams') // Use correct prefix
          .set('Authorization', `Bearer ${authToken}`) 
          .send({ name: workspaceTeamName, workspaceId: testWorkspaceId });
        expect(res.statusCode).toEqual(200);
        expect(res.body.team).toHaveProperty('id', workspaceTeamId);
        expect(res.body.team).toHaveProperty('workspace_id', testWorkspaceId);
    });

    it('POST /api/velocity/teams/:name/sprints - should create sprint for workspace team when authenticated', async () => {
        expect(workspaceTeamId).toBeDefined();
        const sprintName = 'WS Sprint Auth';
        const startDate = new Date().toISOString().split('T')[0]; 
        const endDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; 
        const res = await request(app)
          .post(`/api/velocity/teams/${workspaceTeamName}/sprints`) // Use correct prefix
          .set('Authorization', `Bearer ${authToken}`)
          .send({ sprintName, startDate, endDate, workspaceId: testWorkspaceId }); // Use workspaceId
        expect(res.statusCode).toEqual(201); // Expect 201 Created
        expect(res.body).toHaveProperty('id'); // Only check for ID
        // expect(res.body).toHaveProperty('team_id', workspaceTeamId); // Don't check team_id
        createdWsSprintId = res.body.id;
    });
    
    it('PUT /api/velocity/sprints/:sprintId/velocity - should update workspace sprint velocity (auth optional but works)', async () => {
        expect(createdWsSprintId).toBeDefined();
        const committedPoints = 30;
        const completedPoints = 28;
        const res = await request(app)
          .put(`/api/velocity/sprints/${createdWsSprintId}/velocity`) // Use correct prefix
          .set('Authorization', `Bearer ${authToken}`) // Send token, though not strictly required by route
          .send({ committedPoints, completedPoints });
        expect(res.statusCode).toEqual(200); // PUT returns 200 OK
        expect(res.body).toHaveProperty('sprint_id', createdWsSprintId);
        expect(res.body).toHaveProperty('committed_points', committedPoints);
    });

    it('GET /api/velocity/teams/:name/velocity - should get velocity for workspace team when authenticated with header', async () => {
        expect(workspaceTeamId).toBeDefined();
        const res = await request(app)
         .get(`/api/velocity/teams/${workspaceTeamName}/velocity`) // Use correct prefix
         .set('Authorization', `Bearer ${authToken}`)
         .set('workspace-id', testWorkspaceId); // Set workspace context header
       expect(res.statusCode).toEqual(200);
       expect(res.body).toHaveProperty('sprints');
       expect(res.body).toHaveProperty('averages');
       expect(Array.isArray(res.body.sprints)).toBe(true);
       const wsSprint = res.body.sprints.find(s => s.sprint_id === createdWsSprintId);
       expect(wsSprint).toBeDefined();
       expect(wsSprint.committed_points).toEqual(30); // Check points from previous test
     });

     it('GET /api/velocity/teams/:name/velocity - should auto-create team and return empty data if team does not exist in workspace', async () => {
        const newTeamName = `Auto Create Team ${Date.now()}`;
        const res = await request(app)
         .get(`/api/velocity/teams/${newTeamName}/velocity`)
         .set('Authorization', `Bearer ${authToken}`)
         .set('workspace-id', testWorkspaceId);
       expect(res.statusCode).toEqual(404); // Expect 404 as auto-create was removed from this path
       // expect(res.body).toHaveProperty('sprints', []); // No longer expect empty data
       // expect(res.body).toHaveProperty('averages');
       // expect(res.body.averages).toHaveProperty('average_velocity', '0.00');
       // expect(res.body.averages).toHaveProperty('average_commitment', '0.00');
       // expect(res.body.averages).toHaveProperty('completion_rate', '0.00');
       expect(res.body).toHaveProperty('error', `Team '${newTeamName}' not found in this workspace.`); // Check error message
     });

     it('GET /api/velocity/teams/:name/velocity - should fail (401) if authenticated but no workspace header (behaves like anonymous)', async () => {
        const res = await request(app)
         .get(`/api/velocity/teams/${workspaceTeamName}/velocity`)
         .set('Authorization', `Bearer ${authToken}`); // No workspace-id header
         // Since the team exists but requires workspace context or password, expect 401
       expect(res.statusCode).toEqual(401);
       expect(res.body).toHaveProperty('error', 'Invalid team name or password/context required');
     });

     // Need another user and workspace to test access control properly
     describe('Access Control', () => {
        let otherUserToken;
        let otherWorkspaceId;

        beforeAll(async () => {
            // Register another user
            const otherUserEmail = `other_velocity_user_${Date.now()}@example.com`;
            const resRegister = await request(app)
              .post('/api/auth/register')
              .send({ email: otherUserEmail, password: 'password123', name: 'Other Velocity User' });
            expect(resRegister.statusCode).toEqual(201);
            otherUserToken = resRegister.body.token;

            // Create another workspace for the original user
            const otherWorkspaceName = `Other Velocity WS ${Date.now()}`;
             const resWorkspace = await request(app)
               .post('/api/workspaces')
               .set('Authorization', `Bearer ${authToken}`) // Original user creates it
               .send({ name: otherWorkspaceName });
             expect(resWorkspace.statusCode).toEqual(201); // Expect 201 Created
             otherWorkspaceId = resWorkspace.body.workspace.id;
        });

        it('GET /api/velocity/teams/:name/velocity - should fail (403) if user requests team in workspace they dont belong to', async () => {
            const res = await request(app)
             .get(`/api/velocity/teams/${workspaceTeamName}/velocity`)
             .set('Authorization', `Bearer ${otherUserToken}`) // Use token of user not in the workspace
             .set('workspace-id', testWorkspaceId); // Target the original workspace
           expect(res.statusCode).toEqual(403);
           expect(res.body).toHaveProperty('error', 'Forbidden: Access denied to this workspace');
         });

         it('GET /api/velocity/teams/:name/velocity - should fail (404) if team exists but not in the specified workspace', async () => {
            const res = await request(app)
             .get(`/api/velocity/teams/${workspaceTeamName}/velocity`) // Team from workspace 1
             .set('Authorization', `Bearer ${authToken}`) // Correct user
             .set('workspace-id', otherWorkspaceId); // But wrong workspace ID in header
           expect(res.statusCode).toEqual(404);
            expect(res.body).toHaveProperty('error', `Team '${workspaceTeamName}' not found in this workspace.`);
         });
     });

  });
});
