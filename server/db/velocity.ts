import { QueryResult, PoolClient } from 'pg'; // Import pg types
import { executeQuery } from './dbUtils.js'; // Import executeQuery directly (needs .js extension)
import bcrypt from 'bcryptjs';
import {
    VelocityTeam, VelocitySprint, SprintVelocity, TeamVelocityData,
    TeamAverageVelocity, WorkspaceVelocityTeam
} from '../types/db.js'; // Import types (needs .js extension)

// Add client as the last optional parameter
export const createTeam = async (
    id: string,
    name: string,
    password?: string | null,
    workspaceId: string | null = null,
    createdBy: string | null = null,
    client: PoolClient | null = null
): Promise<VelocityTeam | null> => {
    const passwordHash: string | null = password ? await bcrypt.hash(password, 10) : null;

    // Use the correct column name 'password' from the schema
    const queryText = `
        INSERT INTO teams (id, name, password, workspace_id, created_by) 
        VALUES ($1, $2, $3, $4, $5) 
        RETURNING id, name, workspace_id, created_by, created_at
    `;
    const params = [id, name, passwordHash, workspaceId, createdBy];

    // Pass the client (which might be null) to executeQuery
    const result: QueryResult<VelocityTeam> = await executeQuery(queryText, params, client); // Use imported executeQuery

    // Add check and logging
    if (!result || !result.rows || result.rows.length === 0) {
        return null; // Return null
    }
    return result.rows[0];
};

// Return type excludes password hash
export const getTeam = async (name: string, password?: string | null): Promise<Omit<VelocityTeam, 'password'> | null> => {
    // Use executeQuery
    const queryText = 'SELECT * FROM teams WHERE name = $1'; // Select hash to verify
    const params = [name];
    const teamResult: QueryResult<VelocityTeam> = await executeQuery(queryText, params); // Use imported executeQuery

    if (teamResult.rows.length === 0) {
        return null; // Team not found
    }

  const team: VelocityTeam = teamResult.rows[0];

  // If team is associated with a workspace
  if (team.workspace_id) {
      // Accessing workspace teams should primarily happen via workspace context (e.g., getTeamByWorkspace)
      // If getTeam is called directly for a workspace team, it implies anonymous-like access attempt.
      // Since workspace teams don't have passwords, any attempt without workspace context should fail.
      // We previously disallowed providing a password. Now, also disallow *not* providing one here.
       if (!password) { // Check if password was provided *to this function call*
            // This function was called without password for a team that needs workspace context.
             throw new Error("Password or workspace context required for this team.");
       } else {
            // Password was provided for a workspace team - this is disallowed.
             throw new Error("Cannot access workspace team using a password.");
       }
  }
  // If team is NOT associated with a workspace (truly anonymous team), check password if it exists
  else if (team.password) { // Check if a password hash exists for this non-workspace team
    if (!password) {
             // Password required for this anonymous team but not provided
            throw new Error("Password required for this anonymous team");
        }
        // Compare provided password with the stored hash
        // team.password could be null here, bcrypt.compare handles it gracefully
        const isValid: boolean = await bcrypt.compare(password, team.password!); // Use non-null assertion as logic checks existence
        if (!isValid) {
            // Throw specific error for invalid password
            throw new Error("Invalid password for anonymous team");
        }
    } else if (password) {
         // Anonymous team has no password hash, but a password was provided.
         throw new Error("Invalid password (anonymous team does not require one)");
    }
    // If team is anonymous and has no password hash, and no password was provided, access is granted.

    // Return team data without the password hash/field
    const { password: _removedPassword, ...teamData } = team; // Destructure and exclude password
    return teamData;
};

// Return type excludes password hash
export const getTeamByWorkspace = async (name: string, workspaceId: string): Promise<Omit<VelocityTeam, 'password'> | null> => {
    // Use executeQuery
    const queryText = `
        SELECT id, name, workspace_id, created_by, created_at
        FROM teams
        WHERE name = $1 AND workspace_id = $2
    `; // Exclude password_hash
    const params = [name, workspaceId];
    const result: QueryResult<Omit<VelocityTeam, 'password'>> = await executeQuery(queryText, params); // Use imported executeQuery

    // Return the found team or null
    return result.rows[0] || null; 
};

export const getTeamById = async (teamId: string): Promise<VelocityTeam | null> => {
    const queryText = 'SELECT * FROM teams WHERE id = $1'; // Fetch all columns including password hash
    const params = [teamId];
    const result: QueryResult<VelocityTeam> = await executeQuery(queryText, params); // Use imported executeQuery
    return result.rows[0] || null;
};


export const getSprintById = async (sprintId: string): Promise<VelocitySprint | null> => {
    const queryText = 'SELECT * FROM sprints WHERE id = $1';
    const params = [sprintId];
    const result: QueryResult<VelocitySprint> = await executeQuery(queryText, params); // Use imported executeQuery
    return result.rows[0] || null;
};


export const createSprint = async (
    id: string,
    teamId: string,
    name: string,
    startDate: Date | string,
    endDate: Date | string
): Promise<VelocitySprint> => {
    // Use executeQuery
    const queryText = `
        INSERT INTO sprints (id, team_id, name, start_date, end_date)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
    `;
    const params = [id, teamId, name, startDate, endDate];
    const result: QueryResult<VelocitySprint> = await executeQuery(queryText, params); // Use imported executeQuery
    return result.rows[0];
};

export const updateSprintVelocity = async (
    sprintId: string,
    committedPoints: number | null,
    completedPoints: number | null
): Promise<SprintVelocity> => {
    // Use executeQuery
    const queryText = `
        INSERT INTO sprint_velocity (sprint_id, committed_points, completed_points)
        VALUES ($1, $2, $3)
        ON CONFLICT (sprint_id)
        DO UPDATE SET committed_points = $2, completed_points = $3
        RETURNING sprint_id, committed_points, completed_points, created_at 
    `; // Return specific fields including sprint_id
    const params = [sprintId, committedPoints, completedPoints];
    const result: QueryResult<SprintVelocity> = await executeQuery(queryText, params); // Use imported executeQuery
    return result.rows[0];
};

// Define type for the injected getTeam function
type GetTeamFunc = (name: string, password?: string | null) => Promise<Omit<VelocityTeam, 'password'> | null>;

export const getTeamVelocity = async (
    name: string,
    password?: string | null,
    _getTeam: GetTeamFunc = getTeam // Inject getTeam with type
): Promise<TeamVelocityData[]> => {
    // Use executeQuery
    // First verify team and password using the updated getTeam function
    // Use the injected _getTeam function and pass the dbExecutor along
    const team = await _getTeam(name, password);
    if (!team) { // Add null check after injection pattern
        throw new Error("Team not found or invalid credentials");
    }
    // No need to check if team is null here, getTeam handles it by throwing

    const queryText = `
        SELECT s.id as sprint_id, s.name as sprint_name, s.start_date, s.end_date,
               sv.committed_points, sv.completed_points, t.id as team_id
        FROM sprints s
        LEFT JOIN sprint_velocity sv ON s.id = sv.sprint_id
        JOIN teams t ON s.team_id = t.id
        WHERE t.id = $1 -- Use team ID for accuracy
        ORDER BY s.start_date DESC
        LIMIT 10
    `;
    const params = [team.id]; // Use the verified team's ID
    const result: QueryResult<TeamVelocityData> = await executeQuery(queryText, params); // Use imported executeQuery
    return result.rows;
};

// Define type for the injected getTeamByWorkspace function
type GetTeamByWorkspaceFunc = (name: string, workspaceId: string) => Promise<Omit<VelocityTeam, 'password'> | null>;

export const getTeamVelocityByWorkspace = async (
    name: string,
    workspaceId: string,
    _getTeamByWorkspace: GetTeamByWorkspaceFunc = getTeamByWorkspace // Inject getTeamByWorkspace with type
): Promise<TeamVelocityData[] | null> => {
    const team = await _getTeamByWorkspace(name, workspaceId);
    if (!team) {
        return null; // Or throw an error if preferred
    }

    const queryText = `
        SELECT s.id as sprint_id, s.name as sprint_name, s.start_date, s.end_date,
               sv.committed_points, sv.completed_points, t.id as team_id
        FROM sprints s
        LEFT JOIN sprint_velocity sv ON s.id = sv.sprint_id
        JOIN teams t ON s.team_id = t.id
        WHERE t.id = $1 -- Use team ID
        ORDER BY s.start_date DESC
        LIMIT 10
    `;
    const params = [team.id]; // Use the verified team's ID
    const result: QueryResult<TeamVelocityData> = await executeQuery(queryText, params); // Use imported executeQuery
    return result.rows;
};

export const getTeamAverageVelocity = async (
    name: string,
    password?: string | null,
    _getTeam: GetTeamFunc = getTeam // Inject getTeam with type
): Promise<TeamAverageVelocity> => {
    // Use executeQuery
    // First verify team and password using the updated getTeam function
    // Use the injected _getTeam function and pass the dbExecutor along
    const team = await _getTeam(name, password);
    if (!team) { // Add null check
        throw new Error("Team not found or invalid credentials");
    }
     // No need to check if team is null here

    const queryText = `
        SELECT
            CAST(COALESCE(AVG(sv.completed_points), 0.00) AS DECIMAL(10,2)) as average_velocity,
            CAST(COALESCE(AVG(sv.committed_points), 0.00) AS DECIMAL(10,2)) as average_commitment,
            CAST(COALESCE(AVG(CASE
                               WHEN sv.committed_points IS NULL OR sv.committed_points = 0 THEN 0 -- Handle division by zero or null
                               ELSE CAST(sv.completed_points AS FLOAT) / sv.committed_points * 100
                             END), 0.00) AS DECIMAL(10,2)) as completion_rate
        FROM sprints s
        LEFT JOIN sprint_velocity sv ON s.id = sv.sprint_id
        JOIN teams t ON s.team_id = t.id
        WHERE t.id = $1 -- Use team ID
        AND sv.completed_points IS NOT NULL -- Only average completed sprints
    `;
    const params = [team.id]; // Use the verified team's ID
    const result: QueryResult<TeamAverageVelocity> = await executeQuery(queryText, params); // Use imported executeQuery
    // Return the averages, providing defaults if no data exists
    return result.rows[0] || { average_velocity: '0.00', average_commitment: '0.00', completion_rate: '0.00' };
};

export const getTeamAverageVelocityByWorkspace = async (
    name: string,
    workspaceId: string,
    _getTeamByWorkspace: GetTeamByWorkspaceFunc = getTeamByWorkspace // Inject getTeamByWorkspace with type
): Promise<TeamAverageVelocity | null> => {
    // Use executeQuery
    // Verify team exists in this workspace
    // Use the injected _getTeamByWorkspace function and pass the dbExecutor along
    const team = await _getTeamByWorkspace(name, workspaceId);
    if (!team) {
        return null; // Or throw an error
    }

    const queryText = `
        SELECT
            CAST(COALESCE(AVG(sv.completed_points), 0.00) AS DECIMAL(10,2)) as average_velocity,
            CAST(COALESCE(AVG(sv.committed_points), 0.00) AS DECIMAL(10,2)) as average_commitment,
            CAST(COALESCE(AVG(CASE
                               WHEN sv.committed_points IS NULL OR sv.committed_points = 0 THEN 0
                               ELSE CAST(sv.completed_points AS FLOAT) / sv.committed_points * 100
                             END), 0.00) AS DECIMAL(10,2)) as completion_rate
        FROM sprints s
        LEFT JOIN sprint_velocity sv ON s.id = sv.sprint_id
        JOIN teams t ON s.team_id = t.id
        WHERE t.id = $1 -- Use team ID
        AND sv.completed_points IS NOT NULL
    `;
    const params = [team.id]; // Use the verified team's ID
    const result: QueryResult<TeamAverageVelocity> = await executeQuery(queryText, params); // Use imported executeQuery
     // Return the averages, providing defaults if no data exists
    return result.rows[0] || { average_velocity: '0.00', average_commitment: '0.00', completion_rate: '0.00' };
};

// Get all velocity teams associated with a workspace
export const getWorkspaceVelocityTeams = async (workspaceId: string): Promise<WorkspaceVelocityTeam[]> => {
    const queryText = `
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
    const params = [workspaceId];
    const result: QueryResult<WorkspaceVelocityTeam> = await executeQuery(queryText, params); // Use imported executeQuery
    return result.rows;
};

// Removed object export
