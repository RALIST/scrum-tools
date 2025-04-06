import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import bcrypt from 'bcryptjs';
import * as velocityDb from '../db/velocity.js'; // Import all functions to test

describe('Velocity DB Functions (server/db/velocity.js) with DI', () => {
    let mockExecuteQuery; // Mock function for dbExecutor dependency
    let bcryptHashSpy;
    let bcryptCompareSpy;
    // Mocks for internal function dependencies
    let mockGetTeam;
    let mockGetTeamByWorkspace;

    beforeEach(() => {
        // Create mock function and spies before each test
        mockExecuteQuery = jest.fn();
        bcryptHashSpy = jest.spyOn(bcrypt, 'hash');
        bcryptCompareSpy = jest.spyOn(bcrypt, 'compare');
        // Create mocks for internal dependencies
        mockGetTeam = jest.fn();
        mockGetTeamByWorkspace = jest.fn();
    });

    afterEach(() => {
        // Restore all mocks after each test to prevent leakage
        jest.restoreAllMocks();
    });

    // --- createTeam ---
    describe('createTeam', () => {
        const teamId = 'test-team-id';
        const teamName = 'Test Velocity Team';
        const password = 'password123';
        const workspaceId = 'ws-123';
        const userId = 'user-abc';
        const mockHashedPassword = 'hashed_password';

        it('should create a team with a password hash when password is provided', async () => {
            const mockCreatedTeam = { id: teamId, name: teamName, workspace_id: null, created_by: null };
            bcryptHashSpy.mockResolvedValue(mockHashedPassword);
            mockExecuteQuery.mockResolvedValue({ rows: [mockCreatedTeam] });

            const result = await velocityDb.createTeam(teamId, teamName, password, null, null, null, mockExecuteQuery);

            expect(bcryptHashSpy).toHaveBeenCalledWith(password, 10);
            const expectedQuery = `
        INSERT INTO teams (id, name, password, workspace_id, created_by) 
        VALUES ($1, $2, $3, $4, $5) 
        RETURNING id, name, workspace_id, created_by, created_at
    `;
            expect(mockExecuteQuery).toHaveBeenCalledWith(
                expectedQuery,
                [teamId, teamName, mockHashedPassword, null, null],
                null
            );
            expect(result).toEqual(mockCreatedTeam);
        });

        it('should create a team without a password hash when password is null (workspace team)', async () => {
            const mockCreatedTeam = { id: teamId, name: teamName, workspace_id: workspaceId, created_by: userId };
            mockExecuteQuery.mockResolvedValue({ rows: [mockCreatedTeam] });

            const result = await velocityDb.createTeam(teamId, teamName, null, workspaceId, userId, null, mockExecuteQuery);

            expect(bcryptHashSpy).not.toHaveBeenCalled();
            const expectedQuery = `
        INSERT INTO teams (id, name, password, workspace_id, created_by) 
        VALUES ($1, $2, $3, $4, $5) 
        RETURNING id, name, workspace_id, created_by, created_at
    `;
            expect(mockExecuteQuery).toHaveBeenCalledWith(
                expectedQuery,
                [teamId, teamName, null, workspaceId, userId],
                null
            );
            expect(result).toEqual(mockCreatedTeam);
        });

        it('should return null if executeQuery fails to return rows', async () => {
            bcryptHashSpy.mockResolvedValue(mockHashedPassword);
            mockExecuteQuery.mockResolvedValue({ rows: [] });

            const result = await velocityDb.createTeam(teamId, teamName, password, null, null, null, mockExecuteQuery);

            expect(bcryptHashSpy).toHaveBeenCalledWith(password, 10);
            expect(mockExecuteQuery).toHaveBeenCalled();
            expect(result).toBeNull();
        });

         it('should return null if executeQuery result is null', async () => {
             bcryptHashSpy.mockResolvedValue(mockHashedPassword);
             mockExecuteQuery.mockResolvedValue(null);

             const result = await velocityDb.createTeam(teamId, teamName, password, null, null, null, mockExecuteQuery);

             expect(bcryptHashSpy).toHaveBeenCalledWith(password, 10);
             expect(mockExecuteQuery).toHaveBeenCalled();
             expect(result).toBeNull();
         });

        it('should propagate errors from executeQuery', async () => {
            const dbError = new Error('DB connection failed');
            bcryptHashSpy.mockResolvedValue(mockHashedPassword);
            mockExecuteQuery.mockRejectedValue(dbError);

            await expect(velocityDb.createTeam(teamId, teamName, password, null, null, null, mockExecuteQuery))
                .rejects.toThrow(dbError);

            expect(bcryptHashSpy).toHaveBeenCalledWith(password, 10);
            expect(mockExecuteQuery).toHaveBeenCalled();
        });

        it('should propagate errors from bcrypt.hash', async () => {
            const hashError = new Error('Hashing failed');
            bcryptHashSpy.mockRejectedValue(hashError);

            await expect(velocityDb.createTeam(teamId, teamName, password, null, null, null, mockExecuteQuery))
                .rejects.toThrow(hashError);

            expect(bcryptHashSpy).toHaveBeenCalledWith(password, 10);
            expect(mockExecuteQuery).not.toHaveBeenCalled();
        });
    });

    // --- getTeam ---
    describe('getTeam', () => {
        const teamName = 'Test Get Team';
        const password = 'password123';
        const workspaceId = 'ws-123';
        const mockHashedPassword = 'hashed_password';
        const mockTeamData = { id: 'get-team-id', name: teamName };

        it('should return null if executeQuery returns no rows (team not found)', async () => {
            mockExecuteQuery.mockResolvedValue({ rows: [] });

            const result = await velocityDb.getTeam(teamName, password, mockExecuteQuery);

            expect(mockExecuteQuery).toHaveBeenCalledWith('SELECT * FROM teams WHERE name = $1', [teamName]);
            expect(result).toBeNull();
        });

        it('should throw error for workspace team accessed without password', async () => {
            const workspaceTeam = { ...mockTeamData, workspace_id: workspaceId, password: null };
            mockExecuteQuery.mockResolvedValue({ rows: [workspaceTeam] });

            await expect(velocityDb.getTeam(teamName, undefined, mockExecuteQuery))
                .rejects.toThrow("Password or workspace context required for this team.");

            expect(mockExecuteQuery).toHaveBeenCalledWith('SELECT * FROM teams WHERE name = $1', [teamName]);
            expect(bcryptCompareSpy).not.toHaveBeenCalled();
        });

        it('should throw error for workspace team accessed with password', async () => {
            const workspaceTeam = { ...mockTeamData, workspace_id: workspaceId, password: null };
            mockExecuteQuery.mockResolvedValue({ rows: [workspaceTeam] });

            await expect(velocityDb.getTeam(teamName, password, mockExecuteQuery))
                .rejects.toThrow("Cannot access workspace team using a password.");

            expect(mockExecuteQuery).toHaveBeenCalledWith('SELECT * FROM teams WHERE name = $1', [teamName]);
            expect(bcryptCompareSpy).not.toHaveBeenCalled();
        });

        it('should throw error for anonymous team needing password but none provided', async () => {
            const anonTeamWithPass = { ...mockTeamData, workspace_id: null, password: mockHashedPassword };
            mockExecuteQuery.mockResolvedValue({ rows: [anonTeamWithPass] });

            await expect(velocityDb.getTeam(teamName, undefined, mockExecuteQuery))
                .rejects.toThrow("Password required for this anonymous team");

            expect(mockExecuteQuery).toHaveBeenCalledWith('SELECT * FROM teams WHERE name = $1', [teamName]);
            expect(bcryptCompareSpy).not.toHaveBeenCalled();
        });

        it('should throw error for anonymous team with wrong password', async () => {
            const anonTeamWithPass = { ...mockTeamData, workspace_id: null, password: mockHashedPassword };
            mockExecuteQuery.mockResolvedValue({ rows: [anonTeamWithPass] });
            bcryptCompareSpy.mockResolvedValue(false);

            await expect(velocityDb.getTeam(teamName, 'wrongPassword', mockExecuteQuery))
                .rejects.toThrow("Invalid password for anonymous team");

            expect(mockExecuteQuery).toHaveBeenCalledWith('SELECT * FROM teams WHERE name = $1', [teamName]);
            expect(bcryptCompareSpy).toHaveBeenCalledWith('wrongPassword', mockHashedPassword);
        });

        it('should return team data (without password) for anonymous team with correct password', async () => {
            const anonTeamWithPass = { ...mockTeamData, workspace_id: null, password: mockHashedPassword };
            const expectedTeamData = { id: mockTeamData.id, name: mockTeamData.name, workspace_id: null };
            mockExecuteQuery.mockResolvedValue({ rows: [anonTeamWithPass] });
            bcryptCompareSpy.mockResolvedValue(true);

            const result = await velocityDb.getTeam(teamName, password, mockExecuteQuery);

            expect(mockExecuteQuery).toHaveBeenCalledWith('SELECT * FROM teams WHERE name = $1', [teamName]);
            expect(bcryptCompareSpy).toHaveBeenCalledWith(password, mockHashedPassword);
            expect(result).toEqual(expectedTeamData);
            expect(result).not.toHaveProperty('password');
        });

        it('should throw error for anonymous team not needing password but password provided', async () => {
            const anonTeamNoPass = { ...mockTeamData, workspace_id: null, password: null };
            mockExecuteQuery.mockResolvedValue({ rows: [anonTeamNoPass] });

            await expect(velocityDb.getTeam(teamName, password, mockExecuteQuery))
                .rejects.toThrow("Invalid password (anonymous team does not require one)");

            expect(mockExecuteQuery).toHaveBeenCalledWith('SELECT * FROM teams WHERE name = $1', [teamName]);
            expect(bcryptCompareSpy).not.toHaveBeenCalled();
        });

        it('should return team data (without password) for anonymous team without password requirement and no password provided', async () => {
            const anonTeamNoPass = { ...mockTeamData, workspace_id: null, password: null };
            const expectedTeamData = { id: mockTeamData.id, name: mockTeamData.name, workspace_id: null };
            mockExecuteQuery.mockResolvedValue({ rows: [anonTeamNoPass] });

            const result = await velocityDb.getTeam(teamName, undefined, mockExecuteQuery);

            expect(mockExecuteQuery).toHaveBeenCalledWith('SELECT * FROM teams WHERE name = $1', [teamName]);
            expect(bcryptCompareSpy).not.toHaveBeenCalled();
            expect(result).toEqual(expectedTeamData);
            expect(result).not.toHaveProperty('password');
        });
    });

    // --- getTeamByWorkspace ---
    describe('getTeamByWorkspace', () => {
        const teamName = 'WS Team';
        const workspaceId = 'ws-xyz';
        const mockTeamData = { id: 'ws-team-id', name: teamName, workspace_id: workspaceId };

        it('should return team data if found in workspace', async () => {
            mockExecuteQuery.mockResolvedValue({ rows: [mockTeamData] });

            const result = await velocityDb.getTeamByWorkspace(teamName, workspaceId, mockExecuteQuery);
            const expectedQuery = `
        SELECT id, name, workspace_id, created_by, created_at
        FROM teams
        WHERE name = $1 AND workspace_id = $2
    `;
            expect(mockExecuteQuery).toHaveBeenCalledWith(
                expectedQuery,
                [teamName, workspaceId]
            );
            expect(result).toEqual(mockTeamData);
        });

        it('should return null if team not found in workspace', async () => {
            mockExecuteQuery.mockResolvedValue({ rows: [] });

            const result = await velocityDb.getTeamByWorkspace(teamName, workspaceId, mockExecuteQuery);
            const expectedQuery = `
        SELECT id, name, workspace_id, created_by, created_at
        FROM teams
        WHERE name = $1 AND workspace_id = $2
    `;
            expect(mockExecuteQuery).toHaveBeenCalledWith(
                expectedQuery,
                [teamName, workspaceId]
            );
            expect(result).toBeNull();
        });
    });

    // --- getTeamById ---
    describe('getTeamById', () => {
        const teamId = 'get-by-id-team';
        const mockTeamDataWithHash = { id: teamId, name: 'Get By ID Team', password: 'some_hash', workspace_id: 'ws-abc' };

        it('should return team data (including hash) if found by ID', async () => {
            mockExecuteQuery.mockResolvedValue({ rows: [mockTeamDataWithHash] });

            const result = await velocityDb.getTeamById(teamId, mockExecuteQuery);

            expect(mockExecuteQuery).toHaveBeenCalledWith(
                'SELECT * FROM teams WHERE id = $1',
                [teamId]
            );
            expect(result).toEqual(mockTeamDataWithHash);
        });

        it('should return null if team not found by ID', async () => {
            mockExecuteQuery.mockResolvedValue({ rows: [] });

            const result = await velocityDb.getTeamById(teamId, mockExecuteQuery);

            expect(mockExecuteQuery).toHaveBeenCalledWith(
                'SELECT * FROM teams WHERE id = $1',
                [teamId]
            );
            expect(result).toBeNull();
        });
    });

    // --- getSprintById ---
    describe('getSprintById', () => {
        const sprintId = 'get-sprint-id';
        const mockSprintData = { id: sprintId, name: 'Get Sprint Test', team_id: 'team-123' };

        it('should return sprint data if found by ID', async () => {
            mockExecuteQuery.mockResolvedValue({ rows: [mockSprintData] });

            const result = await velocityDb.getSprintById(sprintId, mockExecuteQuery);

            expect(mockExecuteQuery).toHaveBeenCalledWith(
                'SELECT * FROM sprints WHERE id = $1',
                [sprintId]
            );
            expect(result).toEqual(mockSprintData);
        });

        it('should return null if sprint not found by ID', async () => {
            mockExecuteQuery.mockResolvedValue({ rows: [] });

            const result = await velocityDb.getSprintById(sprintId, mockExecuteQuery);

            expect(mockExecuteQuery).toHaveBeenCalledWith(
                'SELECT * FROM sprints WHERE id = $1',
                [sprintId]
            );
            expect(result).toBeNull();
        });
    });


    // --- createSprint ---
    describe('createSprint', () => {
        const sprintId = 'sprint-1';
        const teamId = 'team-for-sprint';
        const sprintName = 'Sprint Alpha';
        const startDate = '2025-04-01';
        const endDate = '2025-04-14';
        const mockSprintData = { id: sprintId, team_id: teamId, name: sprintName, start_date: startDate, end_date: endDate };

        it('should execute insert query and return the created sprint data', async () => {
            mockExecuteQuery.mockResolvedValue({ rows: [mockSprintData] });

            const result = await velocityDb.createSprint(sprintId, teamId, sprintName, startDate, endDate, mockExecuteQuery);
            const expectedQuery = `
        INSERT INTO sprints (id, team_id, name, start_date, end_date)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
    `;
            expect(mockExecuteQuery).toHaveBeenCalledWith(
                expectedQuery,
                [sprintId, teamId, sprintName, startDate, endDate]
            );
            expect(result).toEqual(mockSprintData);
        });
    });

    // --- updateSprintVelocity ---
    describe('updateSprintVelocity', () => {
        const sprintId = 'sprint-to-update';
        const committedPoints = 30;
        const completedPoints = 25;
        const mockUpdatedVelocity = { sprint_id: sprintId, committed_points: committedPoints, completed_points: completedPoints, created_at: new Date().toISOString() };

        it('should execute insert/update query and return the velocity data', async () => {
            mockExecuteQuery.mockResolvedValue({ rows: [mockUpdatedVelocity] });

            const result = await velocityDb.updateSprintVelocity(sprintId, committedPoints, completedPoints, mockExecuteQuery);
            const expectedQuery = `
        INSERT INTO sprint_velocity (sprint_id, committed_points, completed_points)
        VALUES ($1, $2, $3)
        ON CONFLICT (sprint_id)
        DO UPDATE SET committed_points = $2, completed_points = $3
        RETURNING sprint_id, committed_points, completed_points, created_at 
    `;
            expect(mockExecuteQuery).toHaveBeenCalledWith(
                expectedQuery,
                [sprintId, committedPoints, completedPoints]
            );
            expect(result).toEqual(mockUpdatedVelocity);
        });
    });

    // --- getTeamVelocity ---
    describe('getTeamVelocity', () => {
        const teamName = 'Velocity Team';
        const password = 'velocityPassword';
        const teamId = 'vel-team-id';
        const mockTeam = { id: teamId, name: teamName };
        const mockVelocityData = [
            { sprint_id: 's1', sprint_name: 'Sprint 1', completed_points: 10 },
            { sprint_id: 's2', sprint_name: 'Sprint 2', completed_points: 15 },
        ];

        it('should return velocity data for a valid team/password', async () => {
            mockGetTeam.mockResolvedValue(mockTeam);
            mockExecuteQuery.mockResolvedValue({ rows: mockVelocityData });

            const result = await velocityDb.getTeamVelocity(teamName, password, mockExecuteQuery, mockGetTeam);

            expect(mockGetTeam).toHaveBeenCalledWith(teamName, password, mockExecuteQuery);
            const expectedQuery = `
        SELECT s.id as sprint_id, s.name as sprint_name, s.start_date, s.end_date,
               sv.committed_points, sv.completed_points, t.id as team_id
        FROM sprints s
        LEFT JOIN sprint_velocity sv ON s.id = sv.sprint_id
        JOIN teams t ON s.team_id = t.id
        WHERE t.id = $1 -- Use team ID for accuracy
        ORDER BY s.start_date DESC
        LIMIT 10
    `;
            expect(mockExecuteQuery).toHaveBeenCalledWith(
                expectedQuery,
                [teamId]
            );
            expect(result).toEqual(mockVelocityData);
        });

        it('should re-throw error if internal getTeam call fails', async () => {
            const getTeamError = new Error('Invalid password');
            mockGetTeam.mockRejectedValue(getTeamError);

            await expect(velocityDb.getTeamVelocity(teamName, password, mockExecuteQuery, mockGetTeam))
                .rejects.toThrow(getTeamError);

            expect(mockGetTeam).toHaveBeenCalledWith(teamName, password, mockExecuteQuery);
            expect(mockExecuteQuery).not.toHaveBeenCalled();
        });
    });

    // --- getTeamVelocityByWorkspace ---
    describe('getTeamVelocityByWorkspace', () => {
        const teamName = 'WS Velocity Team';
        const workspaceId = 'ws-for-velocity';
        const teamId = 'ws-vel-team-id';
        const mockTeam = { id: teamId, name: teamName, workspace_id: workspaceId };
        const mockVelocityData = [
            { sprint_id: 'ws-s1', sprint_name: 'WS Sprint 1', completed_points: 20 },
        ];

        it('should return velocity data for a valid team/workspace', async () => {
            mockGetTeamByWorkspace.mockResolvedValue(mockTeam);
            mockExecuteQuery.mockResolvedValue({ rows: mockVelocityData });

            const result = await velocityDb.getTeamVelocityByWorkspace(teamName, workspaceId, mockExecuteQuery, mockGetTeamByWorkspace);

            expect(mockGetTeamByWorkspace).toHaveBeenCalledWith(teamName, workspaceId, mockExecuteQuery);
            const expectedQuery = `
        SELECT s.id as sprint_id, s.name as sprint_name, s.start_date, s.end_date,
               sv.committed_points, sv.completed_points, t.id as team_id
        FROM sprints s
        LEFT JOIN sprint_velocity sv ON s.id = sv.sprint_id
        JOIN teams t ON s.team_id = t.id
        WHERE t.id = $1 -- Use team ID
        ORDER BY s.start_date DESC
        LIMIT 10
    `;
            expect(mockExecuteQuery).toHaveBeenCalledWith(
                expectedQuery,
                [teamId]
            );
            expect(result).toEqual(mockVelocityData);
        });

        it('should return null if internal getTeamByWorkspace call returns null', async () => {
            mockGetTeamByWorkspace.mockResolvedValue(null);

            const result = await velocityDb.getTeamVelocityByWorkspace(teamName, workspaceId, mockExecuteQuery, mockGetTeamByWorkspace);

            expect(mockGetTeamByWorkspace).toHaveBeenCalledWith(teamName, workspaceId, mockExecuteQuery);
            expect(mockExecuteQuery).not.toHaveBeenCalled();
            expect(result).toBeNull();
        });
    });

    // --- getTeamAverageVelocity ---
    describe('getTeamAverageVelocity', () => {
        const teamName = 'Avg Velocity Team';
        const password = 'avgPassword';
        const teamId = 'avg-vel-team-id';
        const mockTeam = { id: teamId, name: teamName };
        const mockAvgData = { average_velocity: '12.50', average_commitment: '15.00', completion_rate: '83.33' };
        const defaultAvgData = { average_velocity: '0.00', average_commitment: '0.00', completion_rate: '0.00' };

        it('should return average velocity data for a valid team/password', async () => {
            mockGetTeam.mockResolvedValue(mockTeam);
            mockExecuteQuery.mockResolvedValue({ rows: [mockAvgData] });

            const result = await velocityDb.getTeamAverageVelocity(teamName, password, mockExecuteQuery, mockGetTeam);

            expect(mockGetTeam).toHaveBeenCalledWith(teamName, password, mockExecuteQuery);
            const expectedQuery = `
        SELECT
            CAST(AVG(sv.completed_points) AS DECIMAL(10,2)) as average_velocity,
            CAST(AVG(sv.committed_points) AS DECIMAL(10,2)) as average_commitment,
            CAST(AVG(CASE 
                       WHEN sv.committed_points IS NULL OR sv.committed_points = 0 THEN 0 -- Handle division by zero or null
                       ELSE CAST(sv.completed_points AS FLOAT) / sv.committed_points * 100 
                     END) AS DECIMAL(10,2)) as completion_rate
        FROM sprints s
        LEFT JOIN sprint_velocity sv ON s.id = sv.sprint_id
        JOIN teams t ON s.team_id = t.id
        WHERE t.id = $1 -- Use team ID
        AND sv.completed_points IS NOT NULL -- Only average completed sprints
    `;
            expect(mockExecuteQuery).toHaveBeenCalledWith(expectedQuery, [teamId]);
            expect(result).toEqual(mockAvgData);
        });

        it('should return default averages if executeQuery returns no rows', async () => {
            mockGetTeam.mockResolvedValue(mockTeam);
            mockExecuteQuery.mockResolvedValue({ rows: [] });

            const result = await velocityDb.getTeamAverageVelocity(teamName, password, mockExecuteQuery, mockGetTeam);

            expect(mockGetTeam).toHaveBeenCalledWith(teamName, password, mockExecuteQuery);
            const expectedQuery = `
        SELECT
            CAST(AVG(sv.completed_points) AS DECIMAL(10,2)) as average_velocity,
            CAST(AVG(sv.committed_points) AS DECIMAL(10,2)) as average_commitment,
            CAST(AVG(CASE 
                       WHEN sv.committed_points IS NULL OR sv.committed_points = 0 THEN 0 -- Handle division by zero or null
                       ELSE CAST(sv.completed_points AS FLOAT) / sv.committed_points * 100 
                     END) AS DECIMAL(10,2)) as completion_rate
        FROM sprints s
        LEFT JOIN sprint_velocity sv ON s.id = sv.sprint_id
        JOIN teams t ON s.team_id = t.id
        WHERE t.id = $1 -- Use team ID
        AND sv.completed_points IS NOT NULL -- Only average completed sprints
    `;
            expect(mockExecuteQuery).toHaveBeenCalledWith(expectedQuery, [teamId]);
            expect(result).toEqual(defaultAvgData);
        });

        it('should re-throw error if internal getTeam call fails', async () => {
            const getTeamError = new Error('Team access denied');
            mockGetTeam.mockRejectedValue(getTeamError);

            await expect(velocityDb.getTeamAverageVelocity(teamName, password, mockExecuteQuery, mockGetTeam))
                .rejects.toThrow(getTeamError);

            expect(mockGetTeam).toHaveBeenCalledWith(teamName, password, mockExecuteQuery);
            expect(mockExecuteQuery).not.toHaveBeenCalled();
        });
    });

    // --- getTeamAverageVelocityByWorkspace ---
    describe('getTeamAverageVelocityByWorkspace', () => {
        const teamName = 'WS Avg Velocity Team';
        const workspaceId = 'ws-for-avg-velocity';
        const teamId = 'ws-avg-vel-team-id';
        const mockTeam = { id: teamId, name: teamName, workspace_id: workspaceId };
        const mockAvgData = { average_velocity: '20.00', average_commitment: '22.00', completion_rate: '90.91' };
        const defaultAvgData = { average_velocity: '0.00', average_commitment: '0.00', completion_rate: '0.00' };

        it('should return average velocity data for a valid team/workspace', async () => {
            mockGetTeamByWorkspace.mockResolvedValue(mockTeam);
            mockExecuteQuery.mockResolvedValue({ rows: [mockAvgData] });

            const result = await velocityDb.getTeamAverageVelocityByWorkspace(teamName, workspaceId, mockExecuteQuery, mockGetTeamByWorkspace);

            expect(mockGetTeamByWorkspace).toHaveBeenCalledWith(teamName, workspaceId, mockExecuteQuery);
            const expectedQuery = `
        SELECT
            CAST(AVG(sv.completed_points) AS DECIMAL(10,2)) as average_velocity,
            CAST(AVG(sv.committed_points) AS DECIMAL(10,2)) as average_commitment,
            CAST(AVG(CASE 
                       WHEN sv.committed_points IS NULL OR sv.committed_points = 0 THEN 0 
                       ELSE CAST(sv.completed_points AS FLOAT) / sv.committed_points * 100 
                     END) AS DECIMAL(10,2)) as completion_rate
        FROM sprints s
        LEFT JOIN sprint_velocity sv ON s.id = sv.sprint_id
        JOIN teams t ON s.team_id = t.id
        WHERE t.id = $1 -- Use team ID
        AND sv.completed_points IS NOT NULL
    `;
            expect(mockExecuteQuery).toHaveBeenCalledWith(expectedQuery, [teamId]);
            expect(result).toEqual(mockAvgData);
        });

        it('should return default averages if executeQuery returns no rows', async () => {
            mockGetTeamByWorkspace.mockResolvedValue(mockTeam);
            mockExecuteQuery.mockResolvedValue({ rows: [] });

            const result = await velocityDb.getTeamAverageVelocityByWorkspace(teamName, workspaceId, mockExecuteQuery, mockGetTeamByWorkspace);

            expect(mockGetTeamByWorkspace).toHaveBeenCalledWith(teamName, workspaceId, mockExecuteQuery);
            const expectedQuery = `
        SELECT
            CAST(AVG(sv.completed_points) AS DECIMAL(10,2)) as average_velocity,
            CAST(AVG(sv.committed_points) AS DECIMAL(10,2)) as average_commitment,
            CAST(AVG(CASE 
                       WHEN sv.committed_points IS NULL OR sv.committed_points = 0 THEN 0 
                       ELSE CAST(sv.completed_points AS FLOAT) / sv.committed_points * 100 
                     END) AS DECIMAL(10,2)) as completion_rate
        FROM sprints s
        LEFT JOIN sprint_velocity sv ON s.id = sv.sprint_id
        JOIN teams t ON s.team_id = t.id
        WHERE t.id = $1 -- Use team ID
        AND sv.completed_points IS NOT NULL
    `;
            expect(mockExecuteQuery).toHaveBeenCalledWith(expectedQuery, [teamId]);
            expect(result).toEqual(defaultAvgData);
        });

        it('should return null if internal getTeamByWorkspace call returns null', async () => {
            mockGetTeamByWorkspace.mockResolvedValue(null);

            const result = await velocityDb.getTeamAverageVelocityByWorkspace(teamName, workspaceId, mockExecuteQuery, mockGetTeamByWorkspace);

            expect(mockGetTeamByWorkspace).toHaveBeenCalledWith(teamName, workspaceId, mockExecuteQuery);
            expect(mockExecuteQuery).not.toHaveBeenCalled();
            expect(result).toBeNull();
        });
    });

    // --- getWorkspaceVelocityTeams ---
    describe('getWorkspaceVelocityTeams', () => {
        const workspaceId = 'ws-list-teams';
        const mockTeamList = [
            { id: 'team-a', name: 'Team Alpha', avg_velocity_preview: '10.0' },
            { id: 'team-b', name: 'Team Beta', avg_velocity_preview: '15.5' },
        ];

        it('should return a list of teams for the workspace', async () => {
            mockExecuteQuery.mockResolvedValue({ rows: mockTeamList });

            const result = await velocityDb.getWorkspaceVelocityTeams(workspaceId, mockExecuteQuery);
            const expectedQuery = `
        SELECT 
            t.id, 
            t.name, 
            t.created_at,
            -- Optionally, add some aggregated velocity data if needed directly in the list
            (SELECT CAST(AVG(sv.completed_points) AS DECIMAL(10,1)) 
             FROM sprints s 
             JOIN sprint_velocity sv ON s.id = sv.sprint_id 
             WHERE s.team_id = t.id AND sv.completed_points IS NOT NULL) as avg_velocity_preview
        FROM teams t
        WHERE t.workspace_id = $1
        ORDER BY t.name ASC
    `;
            expect(mockExecuteQuery).toHaveBeenCalledWith(expectedQuery, [workspaceId]);
            expect(result).toEqual(mockTeamList);
        });

        it('should return an empty array if no teams found', async () => {
            mockExecuteQuery.mockResolvedValue({ rows: [] });

            const result = await velocityDb.getWorkspaceVelocityTeams(workspaceId, mockExecuteQuery);
            const expectedQuery = `
        SELECT 
            t.id, 
            t.name, 
            t.created_at,
            -- Optionally, add some aggregated velocity data if needed directly in the list
            (SELECT CAST(AVG(sv.completed_points) AS DECIMAL(10,1)) 
             FROM sprints s 
             JOIN sprint_velocity sv ON s.id = sv.sprint_id 
             WHERE s.team_id = t.id AND sv.completed_points IS NOT NULL) as avg_velocity_preview
        FROM teams t
        WHERE t.workspace_id = $1
        ORDER BY t.name ASC
    `;
            expect(mockExecuteQuery).toHaveBeenCalledWith(expectedQuery, [workspaceId]);
            expect(result).toEqual([]);
        });
    });
});