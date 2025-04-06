import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import * as workspacesDb from '../db/workspaces.js';
import { pool, initializePool } from '../db/pool.js'; // Import actual pool and initializer
import { velocityUtils } from '../db/velocity.js'; // Import the actual velocityUtils object
import crypto from 'crypto'; // Import actual crypto module
// Removed duplicate crypto import

// Initialize pool before tests
initializePool();
describe('Workspace DB Functions (server/db/workspaces.js) with DI', () => {
    let mockQuery;
    let mockClient;
    let connectSpy; // Spy for pool.connect
    let randomBytesSpy; // Spy for crypto.randomBytes
    let createTeamSpy; // Spy for velocityUtils.createTeam

// Removed jest.mock blocks

    beforeEach(() => {
        // Reset mocks and set up spies before each test
        mockQuery = jest.fn();
        mockClient = {
            query: mockQuery,
            release: jest.fn(),
        };
        connectSpy = jest.spyOn(pool, 'connect').mockResolvedValue(mockClient);
        randomBytesSpy = jest.spyOn(crypto, 'randomBytes').mockReturnValue(Buffer.from('mockrandombytes1'));
        // Spy on the method within the imported object
        createTeamSpy = jest.spyOn(velocityUtils, 'createTeam').mockResolvedValue(undefined);
    });

    afterEach(() => {
        // Restore the spy
        // Restore all spies
        jest.restoreAllMocks();
    });
    describe('createWorkspace', () => {
        const name = 'Test Workspace';
        const description = 'Test Description';
        const ownerId = 'user-owner-id';
        const mockWorkspace = { id: expect.any(String), name, description, owner_id: ownerId };

        it('should begin transaction, insert workspace, add owner, create default team, commit, and return workspace', async () => {
            mockQuery
                .mockResolvedValueOnce(undefined) // BEGIN
                .mockResolvedValueOnce({ rows: [mockWorkspace] }) // INSERT workspace
                .mockResolvedValueOnce(undefined) // INSERT member
                .mockResolvedValueOnce(undefined); // COMMIT (createTeam mock handles its own query)
            // createTeam is mocked via spy in beforeEach

            const result = await workspacesDb.createWorkspace(name, description, ownerId); // Removed mockPool, mockCreateTeam args

            expect(pool.connect).toHaveBeenCalledTimes(1); // Check spy
            expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
            expect(mockClient.query).toHaveBeenCalledWith(
                'INSERT INTO workspaces (id, name, description, owner_id) VALUES ($1, $2, $3, $4) RETURNING *',
                [expect.any(String), name, description, ownerId]
            );
            expect(mockClient.query).toHaveBeenCalledWith(
                'INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, $3)',
                [expect.any(String), ownerId, 'admin']
            );
            // Check that the mocked createTeam (from velocity.js) was called correctly
            // Note: It no longer receives client or dbExecutor
            // Check that the spied createTeam was called correctly
            // Check that the spied createTeam (from velocityUtils) was called correctly
            expect(velocityUtils.createTeam).toHaveBeenCalledWith(
                expect.any(String), // defaultTeamId
                name,             // teamName (same as workspace name)
                null,             // password
                expect.any(String), // workspaceId
                null,             // createdBy
                mockClient,       // client
                expect.any(Function) // dbExecutor
            );
            expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
            expect(mockClient.release).toHaveBeenCalledTimes(1);
            expect(result).toEqual(mockWorkspace);
        });

        it('should rollback transaction on workspace insert error', async () => {
            const insertError = new Error('Workspace insert failed');
            mockQuery
                .mockResolvedValueOnce(undefined) // BEGIN
                .mockRejectedValueOnce(insertError); // Fail INSERT workspace

            await expect(workspacesDb.createWorkspace(name, description, ownerId)) // Removed mockPool, mockCreateTeam args
                .rejects.toThrow(insertError);

            expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
            // Match the exact call including parameters
            expect(mockClient.query).toHaveBeenCalledWith(
                'INSERT INTO workspaces (id, name, description, owner_id) VALUES ($1, $2, $3, $4) RETURNING *',
                [expect.any(String), name, description, ownerId]
            );
            expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
            expect(velocityUtils.createTeam).not.toHaveBeenCalled(); // Check spy
            expect(mockClient.query).not.toHaveBeenCalledWith('COMMIT');
            expect(mockClient.release).toHaveBeenCalledTimes(1);
        });

         it('should rollback transaction on add member error', async () => {
             const memberError = new Error('Add member failed');
             mockQuery
                 .mockResolvedValueOnce(undefined) // BEGIN
                 .mockResolvedValueOnce({ rows: [mockWorkspace] }) // INSERT workspace OK
                 .mockRejectedValueOnce(memberError); // Fail INSERT member

             await expect(workspacesDb.createWorkspace(name, description, ownerId)) // Removed mockPool, mockCreateTeam args
                 .rejects.toThrow(memberError);

             expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
             // Match the exact call including parameters
             expect(mockClient.query).toHaveBeenCalledWith(
                 'INSERT INTO workspaces (id, name, description, owner_id) VALUES ($1, $2, $3, $4) RETURNING *',
                 [expect.any(String), name, description, ownerId]
             );
             // Match the exact call including parameters
             expect(mockClient.query).toHaveBeenCalledWith(
                 'INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, $3)',
                 [expect.any(String), ownerId, 'admin']
             );
             expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
             expect(velocityUtils.createTeam).not.toHaveBeenCalled(); // Check spy
             expect(mockClient.query).not.toHaveBeenCalledWith('COMMIT');
             expect(mockClient.release).toHaveBeenCalledTimes(1);
         });

         it('should rollback transaction on createTeam error', async () => {
             const teamError = new Error('Create team failed');
             mockQuery
                 .mockResolvedValueOnce(undefined) // BEGIN
                 .mockResolvedValueOnce({ rows: [mockWorkspace] }) // INSERT workspace OK
                 .mockResolvedValueOnce(undefined); // INSERT member OK
             createTeamSpy.mockRejectedValue(teamError); // Fail createTeam call via spy

             await expect(workspacesDb.createWorkspace(name, description, ownerId)) // Removed mockPool, mockCreateTeam args
                 .rejects.toThrow(teamError);

             expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
             // Match the exact call including parameters
             expect(mockClient.query).toHaveBeenCalledWith(
                 'INSERT INTO workspaces (id, name, description, owner_id) VALUES ($1, $2, $3, $4) RETURNING *',
                 [expect.any(String), name, description, ownerId]
             );
             // Match the exact call including parameters
             expect(mockClient.query).toHaveBeenCalledWith(
                 'INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, $3)',
                 [expect.any(String), ownerId, 'admin']
             );
             expect(velocityUtils.createTeam).toHaveBeenCalled(); // Check spy
             expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
             expect(mockClient.query).not.toHaveBeenCalledWith('COMMIT');
             expect(mockClient.release).toHaveBeenCalledTimes(1);
         });
    });

    // --- getUserWorkspaces ---
    describe('getUserWorkspaces', () => {
        const userId = 'user-1';
        const mockWorkspaces = [{ id: 'ws-1', name: 'WS 1', role: 'admin' }];

        it('should return workspaces for a user', async () => {
            mockClient.query.mockResolvedValue({ rows: mockWorkspaces });

            const result = await workspacesDb.getUserWorkspaces(userId); // Removed mockPool arg

            expect(pool.connect).toHaveBeenCalledTimes(1); // Check spy
            expect(mockClient.query).toHaveBeenCalledWith(expect.stringContaining('SELECT w.*, wm.role'), [userId]);
            expect(mockClient.release).toHaveBeenCalledTimes(1);
            expect(result).toEqual(mockWorkspaces);
        });
    });

    // --- getWorkspaceById ---
    describe('getWorkspaceById', () => {
        const workspaceId = 'ws-target';
        const mockWorkspace = { id: workspaceId, name: 'Target WS' };

        it('should return workspace if found', async () => {
            mockClient.query.mockResolvedValue({ rows: [mockWorkspace] });

            const result = await workspacesDb.getWorkspaceById(workspaceId); // Removed mockPool arg

            expect(pool.connect).toHaveBeenCalledTimes(1); // Check spy
            expect(mockClient.query).toHaveBeenCalledWith('SELECT * FROM workspaces WHERE id = $1', [workspaceId]);
            expect(mockClient.release).toHaveBeenCalledTimes(1);
            expect(result).toEqual(mockWorkspace);
        });

        it('should return null if workspace not found', async () => {
            mockClient.query.mockResolvedValue({ rows: [] });

            const result = await workspacesDb.getWorkspaceById(workspaceId); // Removed mockPool arg

            expect(pool.connect).toHaveBeenCalledTimes(1); // Check spy
            expect(mockClient.query).toHaveBeenCalledWith('SELECT * FROM workspaces WHERE id = $1', [workspaceId]);
            expect(mockClient.release).toHaveBeenCalledTimes(1);
            expect(result).toBeNull();
        });
    });

    // --- addWorkspaceMember ---
    describe('addWorkspaceMember', () => {
        const workspaceId = 'ws-add';
        const userId = 'user-to-add';
        const role = 'editor';

        it('should insert a workspace member', async () => {
            mockClient.query.mockResolvedValue(undefined); // Simulate successful insert

            await workspacesDb.addWorkspaceMember(workspaceId, userId, role); // Removed mockPool arg

            expect(pool.connect).toHaveBeenCalledTimes(1); // Check spy
            expect(mockClient.query).toHaveBeenCalledWith(
                'INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, $3)',
                [workspaceId, userId, role]
            );
            expect(mockClient.release).toHaveBeenCalledTimes(1);
        });
    });

    // --- removeWorkspaceMember ---
    describe('removeWorkspaceMember', () => {
        const workspaceId = 'ws-remove';
        const userId = 'user-to-remove';

        it('should delete a workspace member', async () => {
            mockClient.query.mockResolvedValue(undefined); // Simulate successful delete

            await workspacesDb.removeWorkspaceMember(workspaceId, userId); // Removed mockPool arg

            expect(pool.connect).toHaveBeenCalledTimes(1); // Check spy
            expect(mockClient.query).toHaveBeenCalledWith(
                'DELETE FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
                [workspaceId, userId]
            );
            expect(mockClient.release).toHaveBeenCalledTimes(1);
        });
    });

    // --- getWorkspaceMembers ---
    describe('getWorkspaceMembers', () => {
        const workspaceId = 'ws-get-members';
        const mockMembers = [{ id: 'u1', name: 'Alice', role: 'admin' }];

        it('should return list of members', async () => {
            mockClient.query.mockResolvedValue({ rows: mockMembers });

            const result = await workspacesDb.getWorkspaceMembers(workspaceId); // Removed mockPool arg

            expect(pool.connect).toHaveBeenCalledTimes(1); // Check spy
            expect(mockClient.query).toHaveBeenCalledWith(expect.stringContaining('SELECT u.id, u.name'), [workspaceId]);
            expect(mockClient.release).toHaveBeenCalledTimes(1);
            expect(result).toEqual(mockMembers);
        });
    });

    // --- updateWorkspace ---
    describe('updateWorkspace', () => {
        const workspaceId = 'ws-update';
        const name = 'Updated Name';
        const description = 'Updated Desc';
        const mockUpdatedWorkspace = { id: workspaceId, name, description };

        it('should update workspace and return updated data', async () => {
            mockClient.query.mockResolvedValue({ rows: [mockUpdatedWorkspace] });

            const result = await workspacesDb.updateWorkspace(workspaceId, name, description); // Removed mockPool arg

            expect(pool.connect).toHaveBeenCalledTimes(1); // Check spy
            expect(mockClient.query).toHaveBeenCalledWith(
                'UPDATE workspaces SET name = $1, description = $2 WHERE id = $3 RETURNING *',
                [name, description, workspaceId]
            );
            expect(mockClient.release).toHaveBeenCalledTimes(1);
            expect(result).toEqual(mockUpdatedWorkspace);
        });
    });

    // --- isWorkspaceMember ---
    describe('isWorkspaceMember', () => {
        const workspaceId = 'ws-check';
        const userId = 'user-check';

        it('should return true if member exists', async () => {
            mockClient.query.mockResolvedValue({ rows: [{ user_id: userId }] });

            const result = await workspacesDb.isWorkspaceMember(workspaceId, userId); // Removed mockPool arg

            expect(pool.connect).toHaveBeenCalledTimes(1); // Check spy
            expect(mockClient.query).toHaveBeenCalledWith(
                'SELECT * FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
                [workspaceId, userId]
            );
            expect(mockClient.release).toHaveBeenCalledTimes(1);
            expect(result).toBe(true);
        });

        it('should return false if member does not exist', async () => {
            mockClient.query.mockResolvedValue({ rows: [] });

            const result = await workspacesDb.isWorkspaceMember(workspaceId, userId); // Removed mockPool arg

            expect(pool.connect).toHaveBeenCalledTimes(1); // Check spy
            expect(mockClient.query).toHaveBeenCalledWith(
                'SELECT * FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
                [workspaceId, userId]
            );
            expect(mockClient.release).toHaveBeenCalledTimes(1);
            expect(result).toBe(false);
        });
    });

    // --- getUserWorkspaceRole ---
    describe('getUserWorkspaceRole', () => {
        const workspaceId = 'ws-get-role';
        const userId = 'user-get-role';

        it('should return role if member exists', async () => {
            const role = 'admin';
            mockClient.query.mockResolvedValue({ rows: [{ role }] });

            const result = await workspacesDb.getUserWorkspaceRole(workspaceId, userId); // Removed mockPool arg

            expect(pool.connect).toHaveBeenCalledTimes(1); // Check spy
            expect(mockClient.query).toHaveBeenCalledWith(
                'SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
                [workspaceId, userId]
            );
            expect(mockClient.release).toHaveBeenCalledTimes(1);
            expect(result).toBe(role);
        });

        it('should return null if member does not exist', async () => {
            mockClient.query.mockResolvedValue({ rows: [] });

            const result = await workspacesDb.getUserWorkspaceRole(workspaceId, userId); // Removed mockPool arg

            expect(pool.connect).toHaveBeenCalledTimes(1); // Check spy
            expect(mockClient.query).toHaveBeenCalledWith(
                'SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
                [workspaceId, userId]
            );
            expect(mockClient.release).toHaveBeenCalledTimes(1);
            expect(result).toBeNull();
        });
    });

    // --- createInvitation ---
    describe('createInvitation', () => {
        const workspaceId = 'ws-invite';
        const createdBy = 'user-creator';
        const roleToAssign = 'viewer';
        const mockToken = 'mockrandombytes1mockrandombytes1'; // Expected hex string from mockRandomBytes

        it('should generate token, insert invitation, and return token', async () => {
            mockClient.query.mockResolvedValue({ rows: [{ token: mockToken }] });

            const result = await workspacesDb.createInvitation(workspaceId, createdBy, roleToAssign, 7); // Removed mockPool, mockRandomBytes args

            expect(pool.connect).toHaveBeenCalledTimes(1); // Check spy
            expect(crypto.randomBytes).toHaveBeenCalledWith(16); // Check the spy
            const expectedTokenHex = Buffer.from('mockrandombytes1').toString('hex'); // Calculate expected hex again just in case
            const expectedQuery = `
      INSERT INTO workspace_invitations (workspace_id, token, role_to_assign, expires_at, created_by)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING token
    `;
            expect(mockClient.query).toHaveBeenCalledWith(
                expectedQuery,
                [workspaceId, expectedTokenHex, roleToAssign, expect.any(Date), createdBy]
            );
            // The mock query returns the raw token from the DB result, which we mocked as mockToken
            expect(result).toBe(mockToken);
            expect(mockClient.release).toHaveBeenCalledTimes(1);
            // This line is removed as the check is combined above
        });
    });

    // --- findValidInvitationByToken ---
    describe('findValidInvitationByToken', () => {
        const token = 'valid-token';
        const mockInvite = { id: 'invite-1', workspace_id: 'ws-abc', role_to_assign: 'member' };

        it('should return invitation details if valid token found', async () => {
            mockClient.query.mockResolvedValue({ rows: [mockInvite] });

            const result = await workspacesDb.findValidInvitationByToken(token); // Removed mockPool arg

            expect(pool.connect).toHaveBeenCalledTimes(1); // Check spy
            expect(mockClient.query).toHaveBeenCalledWith(
                expect.stringContaining('SELECT id, workspace_id, role_to_assign'),
                [token]
            );
            expect(mockClient.release).toHaveBeenCalledTimes(1);
            expect(result).toEqual(mockInvite);
        });

        it('should return null if token not found or invalid', async () => {
            mockClient.query.mockResolvedValue({ rows: [] });

            const result = await workspacesDb.findValidInvitationByToken(token); // Removed mockPool arg

            expect(pool.connect).toHaveBeenCalledTimes(1); // Check spy
            expect(mockClient.query).toHaveBeenCalledWith(
                expect.stringContaining('SELECT id, workspace_id, role_to_assign'),
                [token]
            );
            expect(mockClient.release).toHaveBeenCalledTimes(1);
            expect(result).toBeNull();
        });
    });

    // --- markInvitationAsUsed ---
    describe('markInvitationAsUsed', () => {
        const invitationId = 'invite-to-mark';
        const usedByUserId = 'user-accepter';

        it('should return true if update is successful', async () => {
            mockClient.query.mockResolvedValue({ rowCount: 1 }); // Simulate 1 row updated

            const result = await workspacesDb.markInvitationAsUsed(invitationId, usedByUserId); // Removed mockPool arg

            expect(pool.connect).toHaveBeenCalledTimes(1); // Check spy
            expect(mockClient.query).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE workspace_invitations'),
                [invitationId, usedByUserId]
            );
            expect(mockClient.release).toHaveBeenCalledTimes(1);
            expect(result).toBe(true);
        });

        it('should return false if update affects 0 rows', async () => {
            mockClient.query.mockResolvedValue({ rowCount: 0 }); // Simulate no rows updated

            const result = await workspacesDb.markInvitationAsUsed(invitationId, usedByUserId); // Removed mockPool arg

            expect(pool.connect).toHaveBeenCalledTimes(1); // Check spy
            expect(mockClient.query).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE workspace_invitations'),
                [invitationId, usedByUserId]
            );
            expect(mockClient.release).toHaveBeenCalledTimes(1);
            expect(result).toBe(false);
        });
    });

});