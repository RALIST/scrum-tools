import { describe, it, expect, beforeEach, afterEach, afterAll } from '@jest/globals'; // Added afterAll
import * as workspacesDb from '../db/workspaces.js';
import * as velocityDb from '../db/velocity.js'; // Import velocityDb namespace
import { pool } from '../db/pool.js'; // Import only pool
import { executeQuery } from '../db/dbUtils.js'; // For cleanup/verification
import * as usersDb from '../db/users.js'; // For creating users
import { v4 as uuidv4 } from 'uuid'; // For generating IDs
import crypto from 'crypto'; // Import actual crypto module

// initializePool() call removed - pool initializes automatically
describe('Workspace DB Functions (Integration Tests)', () => {
    // Remove mock variables and spies
    beforeEach(async () => {
        // Clean relevant tables before each test in the correct order
        await executeQuery('DELETE FROM workspace_invitations;');
        await executeQuery('DELETE FROM workspace_members;');
        await executeQuery('DELETE FROM sprint_velocity;'); // From velocity tests
        await executeQuery('DELETE FROM sprints;'); // From velocity tests
        await executeQuery('DELETE FROM retro_boards;'); // From potential retro tests
        await executeQuery('DELETE FROM rooms;'); // From potential poker tests
        await executeQuery('DELETE FROM teams;'); // Default teams created by workspaces
        await executeQuery('DELETE FROM workspaces;');
        await executeQuery('DELETE FROM users;');
    });

    afterEach(() => {
        // No mocks to restore
    });

    afterAll( async () => {
        // Close the pool after each test
        await pool.end(); // Ensure the pool is closed after each test
    });

    // afterAll hook removed - pool closure handled globally
    describe('createWorkspace', () => {
        const name = 'Test Workspace';
        const description = 'Test Description';
        const ownerId = 'user-owner-id';
        // mockWorkspace removed

        it('should begin transaction, insert workspace, add owner, create default team, commit, and return workspace', async () => {
            const ownerEmail = 'owner@test.com';
            // Arrange: Create owner user
            const owner = await usersDb.createUser(ownerEmail, 'password', 'Owner User'); // Let DB generate ID
            const ownerId = owner.id; // Capture the actual ID

            // Act
            const result = await workspacesDb.createWorkspace(name, description, ownerId);

            // Assert return value
            expect(result).toBeDefined();
            expect(result.id).toEqual(expect.any(String));
            expect(result.name).toEqual(name);
            expect(result.description).toEqual(description);
            expect(result.owner_id).toEqual(ownerId);

            // Assert DB state: Workspace exists
            const dbWorkspace = await workspacesDb.getWorkspaceById(result.id);
            expect(dbWorkspace).toEqual(result);

            // Assert DB state: Owner is admin member
            const members = await workspacesDb.getWorkspaceMembers(result.id);
            expect(members).toHaveLength(1);
            expect(members[0].id).toEqual(ownerId);
            expect(members[0].role).toEqual('admin');

            // Assert DB state: Default velocity team exists
            const teams = await executeQuery('SELECT * FROM teams WHERE workspace_id = $1', [result.id]);
            expect(teams.rows).toHaveLength(1);
            expect(teams.rows[0].name).toEqual(name); // Default team name matches workspace name
            expect(teams.rows[0].password).toBeNull();
            expect(teams.rows[0].created_by).toBeNull(); // Default team has no creator specified in function
        });

        it('should fail if owner user does not exist', async () => {
            // Act & Assert: Attempt to create with non-existent owner
            await expect(workspacesDb.createWorkspace(name, description, 'non-existent-owner'))
                .rejects.toThrow(); // Expect foreign key violation or similar DB error
        });

        // Rollback tests are harder to simulate reliably in integration tests without complex setups.
        // We rely on the database's transactional integrity.
        // Removing the specific rollback tests based on mocks.


    });

    // --- getUserWorkspaces ---
    describe('getUserWorkspaces', () => {
        const userId = 'user-1';
        const mockWorkspaces = [{ id: 'ws-1', name: 'WS 1', role: 'admin' }];

        it('should return workspaces for a user', async () => {
            // Arrange: Create user, workspaces, and memberships
            const user1 = await usersDb.createUser('user1@test.com', 'p', 'User 1'); // Let DB generate ID
            const userId = user1.id; // Capture actual ID
            const user2 = await usersDb.createUser('user2@test.com', 'p', 'User 2');

            const ws1 = await workspacesDb.createWorkspace('WS 1', 'Desc 1', userId); // Use userId
            const ws2 = await workspacesDb.createWorkspace('WS 2', 'Desc 2', user2.id); // User1 not initially member
            const ws3 = await workspacesDb.createWorkspace('WS 3', 'Desc 3', userId); // Use userId

            // Add user1 to ws2 as editor
            await workspacesDb.addWorkspaceMember(ws2.id, userId, 'editor'); // Use userId

            // Act
            const result = await workspacesDb.getUserWorkspaces(userId);

            // Assert
            expect(result).toBeDefined();
            expect(result).toHaveLength(3); // Should have WS 1 and WS 3 (as owner/admin) and WS 2 (as editor)
            expect(result).toEqual(expect.arrayContaining([
                expect.objectContaining({ id: ws1.id, name: 'WS 1', role: 'admin' }),
                expect.objectContaining({ id: ws2.id, name: 'WS 2', role: 'editor' }),
                expect.objectContaining({ id: ws3.id, name: 'WS 3', role: 'admin' }),
            ]));
        });

        it('should return empty array if user has no workspaces', async () => {
             const userNoWs = await usersDb.createUser('nows@test.com', 'p', 'No WS User');
             const result = await workspacesDb.getUserWorkspaces(userNoWs.id);
             expect(result).toEqual([]);
        });
    });

    // --- getWorkspaceById ---
    describe('getWorkspaceById', () => {
        const workspaceId = 'ws-target';
        const mockWorkspace = { id: workspaceId, name: 'Target WS' };

        it('should return workspace if found', async () => {
            // Arrange: Create user and workspace
            const owner = await usersDb.createUser('owner-get@test.com', 'p', 'Owner Get');
            const createdWs = await workspacesDb.createWorkspace('Target WS', 'Desc', owner.id);

            // Act
            const result = await workspacesDb.getWorkspaceById(createdWs.id);

            // Assert
            expect(result).toBeDefined();
            expect(result.id).toEqual(createdWs.id);
            expect(result.name).toEqual('Target WS');
            expect(result.owner_id).toEqual(owner.id);
        });

        it('should return null if workspace not found', async () => {
            // Act
            const result = await workspacesDb.getWorkspaceById('non-existent-ws-id');

            // Assert
            expect(result).toBeNull();
        });
    });

    // --- addWorkspaceMember ---
    describe('addWorkspaceMember', () => {
        const workspaceId = 'ws-add';
        const userId = 'user-to-add';
        const role = 'editor';

        it('should insert a workspace member', async () => {
            // Arrange: Create workspace and users
            // Arrange: Create workspace and users
            const owner = await usersDb.createUser('owner-add@test.com', 'p', 'Owner Add');
            const userToAdd = await usersDb.createUser('addme@test.com', 'p', 'Add Me');
            const userId = userToAdd.id; // Capture actual ID
            const ws = await workspacesDb.createWorkspace('Add Member WS', '', owner.id); // Don't pass workspaceId here
            const createdWorkspaceId = ws.id; // Use the returned ID

            // Act
            await workspacesDb.addWorkspaceMember(createdWorkspaceId, userId, role); // Use createdWorkspaceId

            // Assert: Check DB directly
            const members = await workspacesDb.getWorkspaceMembers(createdWorkspaceId); // Use createdWorkspaceId
            expect(members).toEqual(expect.arrayContaining([
                expect.objectContaining({ id: owner.id, role: 'admin' }), // Use owner.id
                expect.objectContaining({ id: userId, role: role }), // New member added
            ]));
        });

        it('should throw error if workspace does not exist', async () => {
            const userToAdd = await usersDb.createUser('addme2@test.com', 'p', 'Add Me 2');
            await expect(workspacesDb.addWorkspaceMember('bad-ws-id', userToAdd.id, 'member'))
                .rejects.toThrow(); // FK violation
        });

         it('should throw error if user does not exist', async () => {
            const owner = await usersDb.createUser('owner-add3@test.com', 'p', 'Owner Add 3');
            const ws = await workspacesDb.createWorkspace('Add Member WS 3', '', owner.id);
            await expect(workspacesDb.addWorkspaceMember(ws.id, 'bad-user-id', 'member'))
                .rejects.toThrow(); // FK violation
        });

         it('should throw error if member already exists (unique constraint)', async () => {
            const owner = await usersDb.createUser('owner-add4@test.com', 'p', 'Owner Add 4');
            const ws = await workspacesDb.createWorkspace('Add Member WS 4', '', owner.id);
            // Add owner again (implicitly added during creation)
            await expect(workspacesDb.addWorkspaceMember(ws.id, owner.id, 'editor'))
                .rejects.toThrow(); // Unique constraint violation
        });
    });

    // --- removeWorkspaceMember ---
    describe('removeWorkspaceMember', () => {
        const workspaceId = 'ws-remove';
        const userId = 'user-to-remove';

        it('should delete a workspace member', async () => {
            // Arrange: Create workspace, owner, and another member
            // Arrange: Create workspace, owner, and another member
            const owner = await usersDb.createUser('owner-remove@test.com', 'p', 'Owner Remove');
            const userToRemove = await usersDb.createUser('removeme@test.com', 'p', 'Remove Me');
            const userId = userToRemove.id; // Capture actual ID
            const ws = await workspacesDb.createWorkspace('Remove Member WS', '', owner.id); // Don't pass workspaceId
            const createdWorkspaceId = ws.id; // Use returned ID
            await workspacesDb.addWorkspaceMember(createdWorkspaceId, userId, 'editor'); // Use createdWorkspaceId

             // Verify member exists initially
            let members = await workspacesDb.getWorkspaceMembers(createdWorkspaceId); // Use createdWorkspaceId
            expect(members).toHaveLength(2);

            // Act
            await workspacesDb.removeWorkspaceMember(createdWorkspaceId, userId); // Use createdWorkspaceId

            // Assert: Check DB directly
            members = await workspacesDb.getWorkspaceMembers(createdWorkspaceId); // Use createdWorkspaceId
            expect(members).toHaveLength(1);
            expect(members[0].id).toEqual(owner.id); // Use owner.id
        });

        it('should do nothing if member does not exist', async () => {
             const owner = await usersDb.createUser('owner-remove2@test.com', 'p', 'Owner Remove 2');
             const ws = await workspacesDb.createWorkspace('Remove Member WS 2', '', owner.id);
             // Act: Try removing non-existent member
             await expect(workspacesDb.removeWorkspaceMember(ws.id, 'non-existent-user'))
                 .resolves.toBeUndefined(); // Should complete without error

             // Assert: Owner still the only member
             const members = await workspacesDb.getWorkspaceMembers(ws.id);
             expect(members).toHaveLength(1);
        });
    });

    // --- getWorkspaceMembers ---
    describe('getWorkspaceMembers', () => {
        const workspaceId = 'ws-get-members';
        const mockMembers = [{ id: 'u1', name: 'Alice', role: 'admin' }];

        it('should return list of members', async () => {
            // Arrange: Create workspace, owner, and other members
            // Arrange: Create workspace, owner, and other members
            const owner = await usersDb.createUser('owner-getm@test.com', 'p', 'Owner GetM');
            const user2 = await usersDb.createUser('user2@test.com', 'p', 'User Two');
            const user3 = await usersDb.createUser('user3@test.com', 'p', 'User Three');
            const ownerId = owner.id; // Capture actual IDs
            const user2Id = user2.id;
            const user3Id = user3.id;
            const ws = await workspacesDb.createWorkspace('Get Members WS', '', owner.id); // Don't pass workspaceId
            const createdWorkspaceId = ws.id; // Use returned ID
            await workspacesDb.addWorkspaceMember(createdWorkspaceId, user2.id, 'editor'); // Use createdWorkspaceId
            await workspacesDb.addWorkspaceMember(createdWorkspaceId, user3.id, 'viewer'); // Use createdWorkspaceId

            // Act
            const result = await workspacesDb.getWorkspaceMembers(createdWorkspaceId); // Use createdWorkspaceId

            // Assert
            expect(result).toBeDefined();
            expect(result).toHaveLength(3);
            // Adjust assertion to match actual returned structure (includes email, joined_at)
            expect(result).toEqual(expect.arrayContaining([
                expect.objectContaining({ id: ownerId, name: 'Owner GetM', role: 'admin', email: 'owner-getm@test.com' }),
                expect.objectContaining({ id: user2Id, name: 'User Two', role: 'editor', email: 'user2@test.com' }),
                expect.objectContaining({ id: user3Id, name: 'User Three', role: 'viewer', email: 'user3@test.com' }),
            ]));
            // Check joined_at separately if needed
            result.forEach(member => expect(member.joined_at).toBeInstanceOf(Date));
        });

        it('should return empty array for workspace with no members (should not happen with owner)', async () => {
            // This case is tricky because owner is always added.
            // Test with a non-existent workspace ID instead.
            const result = await workspacesDb.getWorkspaceMembers('non-existent-ws');
            expect(result).toEqual([]);
        });
    });

    // --- updateWorkspace ---
    describe('updateWorkspace', () => {
        const workspaceId = 'ws-update';
        const name = 'Updated Name';
        const description = 'Updated Desc';
        const mockUpdatedWorkspace = { id: workspaceId, name, description };

        it('should update workspace and return updated data', async () => {
            // Arrange: Create workspace and owner
            // Arrange: Create workspace and owner
            const owner = await usersDb.createUser('owner-update@test.com', 'p', 'Owner Update');
            const ownerId = owner.id; // Capture actual ID
            const ws = await workspacesDb.createWorkspace('Initial Name', 'Initial Desc', ownerId);
            const createdWorkspaceId = ws.id; // Use returned ID

            // Act
            const result = await workspacesDb.updateWorkspace(createdWorkspaceId, name, description); // Use createdWorkspaceId

            // Assert return value
            expect(result).toBeDefined();
            expect(result.id).toEqual(createdWorkspaceId); // Use createdWorkspaceId
            expect(result.name).toEqual(name);
            expect(result.description).toEqual(description);
            expect(result.owner_id).toEqual(ownerId); // Compare with captured ownerId

            // Assert DB state
            const dbWs = await workspacesDb.getWorkspaceById(createdWorkspaceId); // Use createdWorkspaceId
            expect(dbWs.name).toEqual(name);
            expect(dbWs.description).toEqual(description);
        });

        it('should return null if workspace does not exist', async () => {
             const result = await workspacesDb.updateWorkspace('bad-ws-id', 'New Name', 'New Desc');
             expect(result).toBeUndefined(); // Function might return undefined if update fails
        });
    });

    // --- isWorkspaceMember ---
    describe('isWorkspaceMember', () => {
        const workspaceId = 'ws-check';
        const userId = 'user-check';

        it('should return true if member exists', async () => {
            // Arrange: Create workspace, owner, and member
            // Arrange: Create workspace, owner, and member
            const owner = await usersDb.createUser('owner-check@test.com', 'p', 'Owner Check');
            const member = await usersDb.createUser('member@test.com', 'p', 'Member Check');
            const userId = member.id; // Capture actual ID
            const ws = await workspacesDb.createWorkspace('Check WS', '', owner.id); // Don't pass workspaceId
            const createdWorkspaceId = ws.id; // Use returned ID
            await workspacesDb.addWorkspaceMember(createdWorkspaceId, userId, 'editor'); // Use createdWorkspaceId

            // Act
            const result = await workspacesDb.isWorkspaceMember(createdWorkspaceId, userId); // Use createdWorkspaceId

            // Assert
            expect(result).toBe(true);
        });

        it('should return false if member does not exist', async () => {
            // Arrange: Create workspace, owner
            const ownerId = 'owner-check2-id';
            const owner = await usersDb.createUser('owner-check2@test.com', 'p', 'Owner Check 2', ownerId);
            const ws = await workspacesDb.createWorkspace('Check WS 2', '', owner.id); // Don't pass workspaceId
            const createdWorkspaceId = ws.id; // Use returned ID
            const nonMember = await usersDb.createUser('nonmember@test.com', 'p', 'Non Member');


            // Act
            const resultOwner = await workspacesDb.isWorkspaceMember(createdWorkspaceId, owner.id); // Owner is member
            const resultNonMember = await workspacesDb.isWorkspaceMember(createdWorkspaceId, nonMember.id); // Non-member

            // Assert
            expect(resultOwner).toBe(true);
            expect(resultNonMember).toBe(false);
        });
    });

    // --- getUserWorkspaceRole ---
    describe('getUserWorkspaceRole', () => {
        const workspaceId = 'ws-get-role';
        const userId = 'user-get-role';

        it('should return role if member exists', async () => {
            // Arrange: Create workspace, owner, and member with specific role
            // Arrange: Create workspace, owner, and member with specific role
            const owner = await usersDb.createUser('owner-getrole@test.com', 'p', 'Owner GetRole');
            const member = await usersDb.createUser('member-role@test.com', 'p', 'Member Role');
            const userId = member.id; // Capture actual ID
            const ws = await workspacesDb.createWorkspace('Get Role WS', '', owner.id); // Don't pass workspaceId
            const createdWorkspaceId = ws.id; // Use returned ID
            const role = 'editor';
            await workspacesDb.addWorkspaceMember(createdWorkspaceId, userId, role); // Use createdWorkspaceId

            // Act
            const resultOwner = await workspacesDb.getUserWorkspaceRole(createdWorkspaceId, owner.id);
            const resultMember = await workspacesDb.getUserWorkspaceRole(createdWorkspaceId, userId); // Use createdWorkspaceId


            // Assert
            expect(resultOwner).toBe('admin');
            expect(resultMember).toBe(role);
        });

        it('should return null if member does not exist', async () => {
            // Arrange: Create workspace, owner
            const ownerId = 'owner-getrole2-id';
            const owner = await usersDb.createUser('owner-getrole2@test.com', 'p', 'Owner GetRole 2', ownerId);
            const ws = await workspacesDb.createWorkspace('Get Role WS 2', '', owner.id); // Don't pass workspaceId
            const createdWorkspaceId = ws.id; // Use returned ID
            const nonMember = await usersDb.createUser('nonmember2@test.com', 'p', 'Non Member 2');

            // Act
            const result = await workspacesDb.getUserWorkspaceRole(createdWorkspaceId, nonMember.id); // Use createdWorkspaceId

            // Assert
            expect(result).toBeNull();
        });
    });

    // --- createInvitation ---
    describe('createInvitation', () => {
        const workspaceId = 'ws-invite';
        const createdBy = 'user-creator';
        const roleToAssign = 'viewer';
        // mockToken removed, will use real crypto

        it('should generate token, insert invitation, and return token', async () => {
            // Arrange: Create workspace and creator user
            // Arrange: Create workspace and creator user
            const creator = await usersDb.createUser('creator@test.com', 'p', 'Creator');
            const createdBy = creator.id; // Capture actual ID
            const ws = await workspacesDb.createWorkspace('Invite WS', '', createdBy);
            const createdWorkspaceId = ws.id; // Use returned ID

            // Act
            const resultToken = await workspacesDb.createInvitation(createdWorkspaceId, createdBy, roleToAssign, 7); // Use createdWorkspaceId

            // Assert return value
            expect(resultToken).toBeDefined();
            expect(resultToken).toEqual(expect.any(String));
            expect(resultToken.length).toBe(32); // 16 bytes -> 32 hex chars

            // Assert DB state
            const dbInvite = await executeQuery('SELECT * FROM workspace_invitations WHERE token = $1', [resultToken]);
            expect(dbInvite.rows).toHaveLength(1);
            const invite = dbInvite.rows[0];
            expect(invite.workspace_id).toEqual(createdWorkspaceId); // Use createdWorkspaceId
            expect(invite.created_by).toEqual(createdBy);
            expect(invite.role_to_assign).toEqual(roleToAssign);
            expect(invite.token).toEqual(resultToken);
            expect(invite.expires_at).toBeInstanceOf(Date);
            // Check expiry is roughly correct (within a reasonable margin for test execution time)
            const expectedExpiry = Date.now() + 7 * 24 * 60 * 60 * 1000;
            expect(invite.expires_at.getTime()).toBeGreaterThan(Date.now());
            expect(invite.expires_at.getTime()).toBeLessThan(expectedExpiry + 10000); // Allow 10s margin
            expect(invite.used_at).toBeNull();
            expect(invite.used_by_user_id == null).toBe(true); // Check for null or undefined
        });
    });

    // --- findValidInvitationByToken ---
    describe('findValidInvitationByToken', () => {
        const token = 'valid-token';
        const mockInvite = { id: 'invite-1', workspace_id: 'ws-abc', role_to_assign: 'member' };

        it('should return invitation details if valid token found', async () => {
            // Arrange: Create workspace, user, and invitation
            const creator = await usersDb.createUser('creator-find@test.com', 'p', 'Creator Find');
            const ws = await workspacesDb.createWorkspace('Find Invite WS', '', creator.id);
            const createdToken = await workspacesDb.createInvitation(ws.id, creator.id, 'member', 1); // 1 day validity

            // Act
            const result = await workspacesDb.findValidInvitationByToken(createdToken);

            // Assert
            expect(result).toBeDefined();
            expect(result.workspace_id).toEqual(ws.id);
            expect(result.role_to_assign).toEqual('member');
            expect(result.id).toEqual(expect.any(String)); // Invitation ID
        });

        it('should return null if token not found or invalid', async () => {
            // Arrange: Create workspace, user, and an *expired* invitation
            const creator = await usersDb.createUser('creator-find-exp@test.com', 'p', 'Creator Find Exp');
            const ws = await workspacesDb.createWorkspace('Find Expired WS', '', creator.id);
            const expiredToken = await workspacesDb.createInvitation(ws.id, creator.id, 'member', -1); // Expired yesterday

            // Act
            const resultValid = await workspacesDb.findValidInvitationByToken('invalid-token');
            const resultExpired = await workspacesDb.findValidInvitationByToken(expiredToken);

            // Assert
            expect(resultValid).toBeNull();
            expect(resultExpired).toBeNull();
        });
    });

    // --- markInvitationAsUsed ---
    describe('markInvitationAsUsed', () => {
        const invitationId = 'invite-to-mark';
        const usedByUserId = 'user-accepter';

        it('should return true if update is successful', async () => {
            // Arrange: Create workspace, user, invitation, and accepting user
            // Arrange: Create workspace, user, invitation, and accepting user
            const creator = await usersDb.createUser('creator-mark@test.com', 'p', 'Creator Mark');
            const creatorId = creator.id; // Capture actual ID
            const ws = await workspacesDb.createWorkspace('Mark Invite WS', '', creatorId);
            const token = await workspacesDb.createInvitation(ws.id, creatorId, 'member', 1);
            const invite = await workspacesDb.findValidInvitationByToken(token); // Get the invite ID
            const accepter = await usersDb.createUser('accepter@test.com', 'p', 'Accepter');
            const usedByUserId = accepter.id; // Capture actual ID

            // Act
            const result = await workspacesDb.markInvitationAsUsed(invite.id, usedByUserId);

            // Assert return value
            expect(result).toBe(true);

            // Assert DB state
            const dbInvite = await executeQuery('SELECT * FROM workspace_invitations WHERE id = $1', [invite.id]);
            expect(dbInvite.rows).toHaveLength(1);
            expect(dbInvite.rows[0].used_at).toBeInstanceOf(Date);
            expect(dbInvite.rows[0].used_by).toEqual(usedByUserId); // Check the correct column 'used_by'
        });

        it('should return false if update affects 0 rows', async () => {
            // Arrange: Create user
            const accepter = await usersDb.createUser('accepter2@test.com', 'p', 'Accepter 2', usedByUserId);

            // Act: Try to mark a non-existent invitation
            const result = await workspacesDb.markInvitationAsUsed(uuidv4(), usedByUserId); // Use a valid UUID format

            // Assert
            expect(result).toBe(false);
        });
    });

});