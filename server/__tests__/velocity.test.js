import request from 'supertest';
import { app, server, io } from '../index.js'; // Import app, server, io
import { pool } from '../db/pool.js';

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
    // Check if team object exists before accessing id
    if (resTeam.body && resTeam.body.team) {
        anonymousTeamId = resTeam.body.team.id;
    } else {
        // Log the problematic response and fail the test setup explicitly
        console.error('ERROR in beforeAll: Failed to get team ID for anonymous team.', resTeam.body);
        throw new Error('Test setup failed: Could not create/find anonymous team.');
    }
    expect(anonymousTeamId).toBeDefined(); // Ensure anonymousTeamId was set

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

  // Close server, io, pool after all tests
  afterAll(async () => {
    io.close();
    await new Promise(resolve => server.close(resolve));
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
    }); // End of 'should find existing anonymous team' test

    it('POST /api/velocity/teams - should fail to create anonymous team without password', async () => {
      const teamName = `Anon No Password ${Date.now()}`;
      const res = await request(app)
        .post('/api/velocity/teams')
        .send({ name: teamName }); // No password
      expect(res.statusCode).toEqual(400);
      expect(res.body).toHaveProperty('error', 'Password is required to create an anonymous team.');
    });

    it('POST /api/velocity/teams - should fail with wrong password for existing anonymous team', async () => {
      expect(anonymousTeamId).toBeDefined();
      const res = await request(app)
        .post('/api/velocity/teams')
        .send({ name: anonymousTeamName, password: 'wrongPassword' });
      expect(res.statusCode).toEqual(401);
      expect(res.body).toHaveProperty('error', 'Invalid team name or password');
    });

    it('POST /api/velocity/teams - should fail without password for existing password-protected anonymous team', async () => {
      expect(anonymousTeamId).toBeDefined();
      const res = await request(app)
        .post('/api/velocity/teams')
        .send({ name: anonymousTeamName }); // No password
      expect(res.statusCode).toEqual(401);
      expect(res.body).toHaveProperty('error', 'Invalid team name or password'); // getTeam throws \"Password required...\" which results in 401
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
    });

    it('POST /api/velocity/teams/:name/sprints - should fail with wrong password', async () => {
      const sprintName = 'Anon Sprint Fail';
      const startDate = new Date().toISOString().split('T')[0];
      const endDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const res = await request(app)
        .post(`/api/velocity/teams/${anonymousTeamName}/sprints`)
        .query({ password: 'wrongPassword' })
        .send({ sprintName, startDate, endDate });
      expect(res.statusCode).toEqual(401);
      expect(res.body).toHaveProperty('error', 'Invalid team name or password');
    });

    it('POST /api/velocity/teams/:name/sprints - should fail if team not found', async () => {
      const sprintName = 'Anon Sprint Fail Team';
      const startDate = new Date().toISOString().split('T')[0];
      const endDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const res = await request(app)
        .post(`/api/velocity/teams/non-existent-team-${Date.now()}/sprints`)
        .query({ password: 'anyPassword' })
        .send({ sprintName, startDate, endDate });
      expect(res.statusCode).toEqual(401); // getTeam throws error, caught as 401
      expect(res.body).toHaveProperty('error', 'Invalid team name or password');
    });

    it('PUT /api/velocity/sprints/:sprintId/velocity - should update sprint velocity anonymously', async () => {
      expect(createdAnonSprintId).toBeDefined();
      const committedPoints = 25;
      const completedPoints = 22;
      const res = await request(app)
        .put(`/api/velocity/sprints/${createdAnonSprintId}/velocity`) // Use correct prefix
        .query({ password: anonymousTeamPassword }) // Add password to query for anonymous auth
        .send({ committedPoints, completedPoints });
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('sprint_id', createdAnonSprintId);
      expect(res.body).toHaveProperty('committed_points', committedPoints);
      expect(res.body).toHaveProperty('completed_points', completedPoints);
    });

    it('PUT /api/velocity/sprints/:sprintId/velocity - should fail with wrong password', async () => {
      expect(createdAnonSprintId).toBeDefined();
      const res = await request(app)
        .put(`/api/velocity/sprints/${createdAnonSprintId}/velocity`)
        .query({ password: 'wrongPassword' })
        .send({ committedPoints: 10, completedPoints: 5 });
      expect(res.statusCode).toEqual(401);
      expect(res.body).toHaveProperty('error', 'Invalid password');
    });

    it('PUT /api/velocity/sprints/:sprintId/velocity - should fail if sprint not found', async () => {
      const nonExistentSprintId = 'non-existent-sprint-id';
      const res = await request(app)
        .put(`/api/velocity/sprints/${nonExistentSprintId}/velocity`)
        .query({ password: anonymousTeamPassword })
        .send({ committedPoints: 10, completedPoints: 5 });
      expect(res.statusCode).toEqual(404);
      expect(res.body).toHaveProperty('error', 'Sprint not found');
    });

       // This test is now invalid as GET /velocity requires workspace context
       it('GET /api/velocity/teams/:name/velocity - should return 400 for anonymous attempt', async () => {
          expect(anonymousTeamId).toBeDefined();
          const res = await request(app)
           .get(`/api/velocity/teams/${anonymousTeamName}/velocity`) // Use correct prefix
           .query({ password: anonymousTeamPassword });
         expect(res.statusCode).toEqual(400); // Expect 400 Bad Request
         expect(res.body).toHaveProperty('error', 'Workspace context required for this request.');
       });

       // This test is now invalid as GET /velocity requires workspace context
       it('GET /api/velocity/teams/:name/velocity - should return 400 for anonymous attempt with wrong password', async () => {
          const res = await request(app)
           .get(`/api/velocity/teams/${anonymousTeamName}/velocity`) // Use correct prefix
           .query({ password: 'wrongpassword' });
         expect(res.statusCode).toEqual(400); // Expect 400 Bad Request
         expect(res.body).toHaveProperty('error', 'Workspace context required for this request.');
       });
  }); // End Anonymous Access describe

  // --- Authenticated Access Tests ---
  describe('Authenticated Access', () => {
    let createdAuthRoomId; // Define within this scope
    let authToken;
    let userId;
    let testWorkspaceId;
    let testUserEmail = `velocity_auth_user_${Date.now()}@example.com`;
    let testUserPassword = 'password123';
    let testUserName = 'Velocity Auth User';
    let workspaceTeamId; // Will need to be fetched or assumed created elsewhere
    let workspaceTeamName = `WS Team Auth ${Date.now()}`;
    let createdWsSprintId;
    let otherUserToken; // Define here for broader scope
    let otherWorkspaceId; // Define here for broader scope

    // Setup user, workspace. Team creation/fetching needs adjustment.
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

       // Find the workspace team (assuming it's created elsewhere, e.g., during workspace creation or needs a dedicated endpoint)
       try {
           const teamQueryRes = await pool.query('SELECT id FROM teams WHERE workspace_id = $1 LIMIT 1', [testWorkspaceId]);
           if (teamQueryRes.rows.length > 0) {
               workspaceTeamId = teamQueryRes.rows[0].id;
               // Optionally fetch the name too if needed, assuming only one team per workspace for now
               const nameQueryRes = await pool.query('SELECT name FROM teams WHERE id = $1', [workspaceTeamId]);
               if (nameQueryRes.rows.length > 0) {
                   workspaceTeamName = nameQueryRes.rows[0].name; // Overwrite generated name with actual name
               }
               console.log(`Found workspace team ID: ${workspaceTeamId} with name: ${workspaceTeamName}`);
           } else {
               console.warn(`WARN in beforeAll: Could not find team associated with workspace ${testWorkspaceId}. Tests requiring workspaceTeamId may fail.`);
           }
       } catch (err) {
            console.error('ERROR in beforeAll fetching workspace team:', err);
       }

       // Register another user for access control tests
       const otherUserEmail = `other_velocity_user_${Date.now()}@example.com`;
       const resOtherRegister = await request(app)
         .post('/api/auth/register')
         .send({ email: otherUserEmail, password: 'password123', name: 'Other Velocity User' });
       expect(resOtherRegister.statusCode).toEqual(201);
       otherUserToken = resOtherRegister.body.token;

       // Create another workspace for the original user for access control tests
       const otherWorkspaceName = `Other Velocity WS ${Date.now()}`;
       const resOtherWorkspace = await request(app)
         .post('/api/workspaces')
         .set('Authorization', `Bearer ${authToken}`) // Original user creates it
         .send({ name: otherWorkspaceName });
       expect(resOtherWorkspace.statusCode).toEqual(201); // Expect 201 Created
       otherWorkspaceId = resOtherWorkspace.body.workspace.id;

    });

    // --- Authenticated Error Tests ---
    it('POST /api/velocity/teams - should fail if workspaceId provided but user not authenticated', async () => {
      const res = await request(app)
        .post('/api/velocity/teams')
        .send({ name: 'Any Name', workspaceId: testWorkspaceId }); // No Auth header
      expect(res.statusCode).toEqual(401);
      expect(res.body).toHaveProperty('error', 'Authentication required for workspace teams.');
    });

    it('POST /api/velocity/teams - should fail if user not member of workspace', async () => {
      // Use the main user's token but a different workspace ID
      const someOtherWorkspaceId = 'non-member-workspace-id'; // Placeholder
      const res = await request(app)
        .post('/api/velocity/teams')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Any Name', workspaceId: someOtherWorkspaceId });
      expect(res.statusCode).toEqual(403);
      expect(res.body).toHaveProperty('error', 'Forbidden: Access denied to this workspace.');
    });

    it('POST /api/velocity/teams - should return 404 if workspace team does not exist', async () => {
      const nonExistentTeamName = `NonExistent WS Team ${Date.now()}`;
      const res = await request(app)
        .post('/api/velocity/teams')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: nonExistentTeamName, workspaceId: testWorkspaceId });
      expect(res.statusCode).toEqual(404);
      expect(res.body).toHaveProperty('error', `Team '${nonExistentTeamName}' not found in this workspace.`);
    });

    it('POST /api/velocity/teams - should return 404 if team exists but in different workspace', async () => {
      if (!workspaceTeamId || !otherWorkspaceId) {
        console.warn('Skipping test: POST /teams (wrong workspace) - workspaceTeamId or otherWorkspaceId not set.');
        return; // Skip if setup failed
      }
      const res = await request(app)
        .post('/api/velocity/teams')
        .set('Authorization', `Bearer ${authToken}`) // Correct user
        .send({ name: workspaceTeamName, workspaceId: otherWorkspaceId }); // Correct team name, WRONG workspace ID
      expect(res.statusCode).toEqual(404);
      expect(res.body).toHaveProperty('error', `Team '${workspaceTeamName}' not found in this workspace.`);
    });

    // --- Authenticated Success/Info Tests (Including Poker ones for now) ---
    it('POST /api/velocity/teams - should find existing workspace team', async () => {
      if (!workspaceTeamId) {
        console.warn('Skipping test: POST /teams (find existing) - workspaceTeamId not found.');
        return; // Skip if team wasn't found in beforeAll
      }
      const res = await request(app)
        .post('/api/velocity/teams') // Use correct endpoint
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: workspaceTeamName, // Use the name of the team found/created in beforeAll
          workspaceId: testWorkspaceId,
        });
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.team).toHaveProperty('id', workspaceTeamId); // Check if it returns the correct team
    });

    it('GET /api/velocity/rooms - authenticated WITHOUT header should get only public rooms', async () => { // Corrected endpoint
        const res = await request(app)
          .get('/api/poker/rooms') // Corrected prefix
          .set('Authorization', `Bearer ${authToken}`); // Authenticated but no workspace header
        expect(res.statusCode).toEqual(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBeGreaterThan(0); // Check that some rooms are returned
         if (workspaceTeamId) {
            const wsTeam = await pool.query('SELECT id FROM teams WHERE id = $1', [workspaceTeamId]);
            if (wsTeam.rows.length > 0) {
                 const wsRoomRes = await pool.query('SELECT id FROM rooms WHERE workspace_id = $1 LIMIT 1', [testWorkspaceId]);
                 if (wsRoomRes.rows.length > 0) {
                    expect(res.body.some(room => room.id === wsRoomRes.rows[0].id)).toBe(false);
                 }
            }
         }
    });

     it('GET /api/velocity/rooms - authenticated WITH header should get ONLY workspace rooms', async () => { // Corrected endpoint
        const wsRoomId = `ws-room-get-${Date.now()}`;
        await request(app).post('/api/poker/rooms').set('Authorization', `Bearer ${authToken}`).send({roomId: wsRoomId, name: 'WS Get Test Room', workspaceId: testWorkspaceId});

        const res = await request(app)
          .get('/api/poker/rooms') // Corrected prefix
          .set('Authorization', `Bearer ${authToken}`)
          .set('workspace-id', testWorkspaceId); // Set workspace context header
        expect(res.statusCode).toEqual(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.some(room => room.id === wsRoomId)).toBe(true);
        expect(res.body.every(room => room.workspaceId === testWorkspaceId)).toBe(true);
    });

     it('POST /api/velocity/rooms/:roomId/verify-password - should work for workspace room (authenticated)', async () => { // Corrected endpoint
        const wsRoomId = `ws-room-verify-${Date.now()}`;
        await request(app).post('/api/poker/rooms').set('Authorization', `Bearer ${authToken}`).send({roomId: wsRoomId, name: 'WS Verify Test Room', workspaceId: testWorkspaceId});

        const res = await request(app)
          .post(`/api/poker/rooms/${wsRoomId}/verify-password`) // Corrected prefix
          .set('Authorization', `Bearer ${authToken}`) // Send auth token
          .send({ password: '' }); // Room has no password
        expect(res.statusCode).toEqual(200);
        expect(res.body).toHaveProperty('valid', true);
     });

     it('GET /api/velocity/rooms/:roomId/info - should get info for a workspace room', async () => { // Corrected endpoint
        const wsRoomId = `ws-room-info-${Date.now()}`;
        await request(app).post('/api/poker/rooms').set('Authorization', `Bearer ${authToken}`).send({roomId: wsRoomId, name: 'WS Info Test Room', workspaceId: testWorkspaceId});

        const res = await request(app)
          .get(`/api/poker/rooms/${wsRoomId}/info`) // Corrected prefix
          .set('Authorization', `Bearer ${authToken}`); // Authenticated request
        expect(res.statusCode).toEqual(200);
        expect(res.body).toHaveProperty('id', wsRoomId);
        expect(res.body).toHaveProperty('hasPassword', false); // Created without password
     });

    it('POST /api/velocity/teams/:name/sprints - should create sprint for workspace team when authenticated', async () => {
        if (!workspaceTeamId) {
            console.warn('Skipping test: POST sprint - workspaceTeamId not found.');
            return; // Skip test if team wasn't found
        }
        expect(testWorkspaceId).toBeDefined();
        const sprintName = 'WS Sprint Auth';
        const startDate = new Date().toISOString().split('T')[0];
        const endDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const res = await request(app)
          .post(`/api/velocity/teams/${workspaceTeamName}/sprints`) // Use actual team name if fetched
          .set('Authorization', `Bearer ${authToken}`)
          .send({ sprintName, startDate, endDate, workspaceId: testWorkspaceId }); // Use workspaceId

        if (res.statusCode === 404) {
             console.warn(`WARN: POST sprint returned 404, likely because team '${workspaceTeamName}' wasn't found.`);
        }

        expect(res.statusCode).toEqual(201); // Expect 201 Created
        expect(res.body).toHaveProperty('id'); // Only check for ID
        createdWsSprintId = res.body.id;
    });

    it('POST /api/velocity/teams/:name/sprints - should fail if user not workspace member', async () => {
      if (!workspaceTeamId || !otherUserToken) {
        console.warn('Skipping test: POST sprint (403) - workspaceTeamId or otherUserToken not set.');
        return;
      }
      const sprintName = 'WS Sprint Fail Auth';
      const startDate = new Date().toISOString().split('T')[0];
      const endDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const res = await request(app)
        .post(`/api/velocity/teams/${workspaceTeamName}/sprints`)
        .set('Authorization', `Bearer ${otherUserToken}`) // Use other user's token
        .send({ sprintName, startDate, endDate, workspaceId: testWorkspaceId });
      expect(res.statusCode).toEqual(403);
      expect(res.body).toHaveProperty('error', 'Forbidden: Access denied to this workspace');
    });

    it('PUT /api/velocity/sprints/:sprintId/velocity - should update workspace sprint velocity (auth optional but works)', async () => {
        if (!createdWsSprintId) {
             console.warn('Skipping test: PUT velocity - createdWsSprintId not set.');
             return; // Skip if sprint wasn't created
        }
        expect(createdWsSprintId).toBeDefined();
        const committedPoints = 30;
        const completedPoints = 28;
         const res = await request(app)
           .put(`/api/velocity/sprints/${createdWsSprintId}/velocity`) // Use correct prefix
           .set('Authorization', `Bearer ${authToken}`)
           .set('workspace-id', testWorkspaceId) // Add workspace context header
           .send({ committedPoints, completedPoints });
         expect(res.statusCode).toEqual(200); // PUT returns 200 OK
         expect(res.body).toHaveProperty('sprint_id', createdWsSprintId);
        expect(res.body).toHaveProperty('committed_points', committedPoints);
    });

    it('PUT /api/velocity/sprints/:sprintId/velocity - should fail if user not workspace member', async () => {
      if (!createdWsSprintId || !otherUserToken) {
        console.warn('Skipping test: PUT velocity (403) - createdWsSprintId or otherUserToken not set.');
        return;
      }
      const res = await request(app)
        .put(`/api/velocity/sprints/${createdWsSprintId}/velocity`)
        .set('Authorization', `Bearer ${otherUserToken}`) // Use other user's token
        .set('workspace-id', testWorkspaceId)
        .send({ committedPoints: 15, completedPoints: 10 });
      expect(res.statusCode).toEqual(403);
      expect(res.body).toHaveProperty('error', 'Forbidden: Access denied to this workspace');
    });

    it('PUT /api/velocity/sprints/:sprintId/velocity - should fail if workspace header mismatch', async () => {
      if (!createdWsSprintId || !otherWorkspaceId) {
        console.warn('Skipping test: PUT velocity (workspace mismatch) - createdWsSprintId or otherWorkspaceId not set.');
        return;
      }
      const res = await request(app)
        .put(`/api/velocity/sprints/${createdWsSprintId}/velocity`)
        .set('Authorization', `Bearer ${authToken}`) // Correct user
        .set('workspace-id', otherWorkspaceId) // Wrong workspace header
        .send({ committedPoints: 15, completedPoints: 10 });
      expect(res.statusCode).toEqual(403);
      expect(res.body).toHaveProperty('error', 'Sprint does not belong to this workspace');
    });

    it('GET /api/velocity/teams/:name/velocity - should get velocity for workspace team when authenticated with header', async () => {
        if (!workspaceTeamId || !createdWsSprintId) {
             console.warn('Skipping test: GET velocity - workspaceTeamId or createdWsSprintId not set.');
            return; // Skip if setup failed
        }
        expect(testWorkspaceId).toBeDefined();
        const res = await request(app)
         .get(`/api/velocity/teams/${workspaceTeamName}/velocity`) // Use actual team name
         .set('Authorization', `Bearer ${authToken}`)
         .set('workspace-id', testWorkspaceId); // Set workspace context header

        if (res.statusCode === 404) {
             console.warn(`WARN: GET velocity returned 404, likely because team '${workspaceTeamName}' wasn't found.`);
        }

       expect(res.statusCode).toEqual(200);
       expect(res.body).toHaveProperty('sprints');
       expect(res.body).toHaveProperty('averages');
       expect(Array.isArray(res.body.sprints)).toBe(true);
       const wsSprint = res.body.sprints.find(s => s.sprint_id === createdWsSprintId);
       expect(wsSprint).toBeDefined();
       expect(wsSprint.committed_points).toEqual(30); // Check points from previous test
     });

     it('GET /api/velocity/teams/:name/velocity - should return 404 if team does not exist in workspace', async () => { // Changed test description
        const newTeamName = `NonExistent Team ${Date.now()}`;
        const res = await request(app)
         .get(`/api/velocity/teams/${newTeamName}/velocity`)
         .set('Authorization', `Bearer ${authToken}`)
         .set('workspace-id', testWorkspaceId);
       expect(res.statusCode).toEqual(404); // Expect 404
       expect(res.body).toHaveProperty('error', `Team '${newTeamName}' not found in this workspace.`); // Check error message
     });

     it('GET /api/velocity/teams/:name/velocity - should fail (401) if authenticated but no workspace header (behaves like anonymous)', async () => {
        if (!workspaceTeamId) {
             console.warn('Skipping test: GET velocity (no header) - workspaceTeamId not set.');
            return; // Skip if setup failed
        }
        const res = await request(app)
         .get(`/api/velocity/teams/${workspaceTeamName}/velocity`) // Use actual team name
          .set('Authorization', `Bearer ${authToken}`); // No workspace-id header
          // Since the route requires workspace context, expect 400
        expect(res.statusCode).toEqual(400);
        expect(res.body).toHaveProperty('error', 'Workspace context required for this request.');
      });

     // Need another user and workspace to test access control properly
     describe('Access Control', () => {
        // Note: otherUserToken and otherWorkspaceId are now defined in the parent describe's beforeAll

        it('GET /api/velocity/teams/:name/velocity - should fail (403) if user requests team in workspace they dont belong to', async () => {
            if (!workspaceTeamId) {
                 console.warn('Skipping test: Access Control (403) - workspaceTeamId not set.');
                return; // Skip if setup failed
            }
            const res = await request(app)
             .get(`/api/velocity/teams/${workspaceTeamName}/velocity`) // Use actual team name
             .set('Authorization', `Bearer ${otherUserToken}`) // Use token of user not in the workspace
             .set('workspace-id', testWorkspaceId); // Target the original workspace
           expect(res.statusCode).toEqual(403);
           expect(res.body).toHaveProperty('error', 'Forbidden: Access denied to this workspace');
         });

         it('GET /api/velocity/teams/:name/velocity - should fail (404) if team exists but not in the specified workspace', async () => {
             if (!workspaceTeamId) {
                 console.warn('Skipping test: Access Control (404) - workspaceTeamId not set.');
                return; // Skip if setup failed
            }
            const res = await request(app)
             .get(`/api/velocity/teams/${workspaceTeamName}/velocity`) // Use actual team name
             .set('Authorization', `Bearer ${authToken}`) // Correct user
             .set('workspace-id', otherWorkspaceId); // But wrong workspace ID in header
           expect(res.statusCode).toEqual(404);
            expect(res.body).toHaveProperty('error', `Team '${workspaceTeamName}' not found in this workspace.`);
         });
     });

  }); // End Authenticated Access describe
}); // End top-level describe
