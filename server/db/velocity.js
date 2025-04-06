import { dbUtils } from './dbUtils.js'; // Import the dbUtils object
import { pool } from './pool.js'; // Import the pool
import bcrypt from 'bcryptjs';
import logger from '../logger.js';

// Add client as the last optional parameter
const _createTeam = async (id, name, password, workspaceId = null, createdBy = null, client = null) => { // Renamed internally
    const passwordHash = password ? await bcrypt.hash(password, 10) : null;

    // Use the correct column name 'password' from the schema
    const queryText = `
        INSERT INTO teams (id, name, password, workspace_id, created_by) 
        VALUES ($1, $2, $3, $4, $5) 
        RETURNING id, name, workspace_id, created_by, created_at
    `;
    const params = [id, name, passwordHash, workspaceId, createdBy];

    // Pass the client (which might be null) to executeQuery
    logger.info(`DEBUG: About to execute INSERT query for team '${name}' (id: ${id}).`); // DEBUG LOG
    const result = await dbUtils.executeQuery(queryText, params, client); // Use dbUtils.executeQuery

    // Add check and logging
    if (!result || !result.rows || result.rows.length === 0) {
        // Use the logger imported at the top
        logger.error(`Failed to create team '${name}' (id: ${id}). INSERT query did not return the created row. Result:`, result);
        return null; // Return null
    }
    // Use the logger imported at the top
    logger.info(`Successfully created team in DB: ${JSON.stringify(result.rows[0])}`);
    return result.rows[0];
};

const _getTeam = async (name, password) => { // Renamed internally
    // Use executeQuery
    const queryText = 'SELECT * FROM teams WHERE name = $1'; // Select hash to verify
    const params = [name];
    const teamResult = await dbUtils.executeQuery(queryText, params); // Use dbUtils.executeQuery

    if (teamResult.rows.length === 0) {
        return null; // Team not found
    }

  const team = teamResult.rows[0];

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
        const isValid = await bcrypt.compare(password, team.password);
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
    const { password: _, ...teamData } = team; // Destructure and exclude password
    return teamData;
};

const _getTeamByWorkspace = async (name, workspaceId) => { // Renamed internally
    // Use executeQuery
    const queryText = `
        SELECT id, name, workspace_id, created_by, created_at
        FROM teams
        WHERE name = $1 AND workspace_id = $2
    `; // Exclude password_hash
    const params = [name, workspaceId];
    const result = await dbUtils.executeQuery(queryText, params); // Use dbUtils.executeQuery

    // Return the found team or null
    return result.rows[0] || null; 
};

const _getTeamById = async (teamId) => { // Renamed internally
    const queryText = 'SELECT * FROM teams WHERE id = $1'; // Fetch all columns including password hash
    const params = [teamId];
    const result = await dbUtils.executeQuery(queryText, params); // Use dbUtils.executeQuery
    return result.rows[0] || null;
};


const _getSprintById = async (sprintId) => { // Renamed internally
    const queryText = 'SELECT * FROM sprints WHERE id = $1';
    const params = [sprintId];
    const result = await dbUtils.executeQuery(queryText, params); // Use dbUtils.executeQuery
    return result.rows[0] || null;
};


const _createSprint = async (id, teamId, name, startDate, endDate) => { // Renamed internally
    // Use executeQuery
    const queryText = `
        INSERT INTO sprints (id, team_id, name, start_date, end_date)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
    `;
    const params = [id, teamId, name, startDate, endDate];
    const result = await dbUtils.executeQuery(queryText, params); // Use dbUtils.executeQuery
    return result.rows[0];
};

const _updateSprintVelocity = async (sprintId, committedPoints, completedPoints) => { // Renamed internally
    // Use executeQuery
    const queryText = `
        INSERT INTO sprint_velocity (sprint_id, committed_points, completed_points)
        VALUES ($1, $2, $3)
        ON CONFLICT (sprint_id)
        DO UPDATE SET committed_points = $2, completed_points = $3
        RETURNING sprint_id, committed_points, completed_points, created_at 
    `; // Return specific fields including sprint_id
    const params = [sprintId, committedPoints, completedPoints];
    const result = await dbUtils.executeQuery(queryText, params); // Use dbUtils.executeQuery
    return result.rows[0];
};

const _getTeamVelocity = async (name, password, __getTeam = _getTeam) => { // Renamed internally and dependency
    // Use executeQuery
    // First verify team and password using the updated getTeam function
    // Use the injected _getTeam function and pass the dbExecutor along
    const team = await __getTeam(name, password); // Use renamed internal dependency
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
    const result = await dbUtils.executeQuery(queryText, params); // Use dbUtils.executeQuery
    return result.rows;
};

const _getTeamVelocityByWorkspace = async (name, workspaceId, __getTeamByWorkspace = _getTeamByWorkspace) => { // Renamed internally and dependency
    // Use executeQuery
    // Verify team exists in this workspace
    // Use the injected _getTeamByWorkspace function and pass the dbExecutor along
    const team = await __getTeamByWorkspace(name, workspaceId); // Use renamed internal dependency
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
    const result = await dbUtils.executeQuery(queryText, params); // Use dbUtils.executeQuery
    return result.rows;
};

const _getTeamAverageVelocity = async (name, password, __getTeam = _getTeam) => { // Renamed internally and dependency
    // Use executeQuery
    // First verify team and password using the updated getTeam function
    // Use the injected _getTeam function and pass the dbExecutor along
    const team = await __getTeam(name, password); // Use renamed internal dependency
     // No need to check if team is null here

    const queryText = `
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
    const params = [team.id]; // Use the verified team's ID
    const result = await dbUtils.executeQuery(queryText, params); // Use dbUtils.executeQuery
    // Return the averages, providing defaults if no data exists
    return result.rows[0] || { average_velocity: '0.00', average_commitment: '0.00', completion_rate: '0.00' };
};

const _getTeamAverageVelocityByWorkspace = async (name, workspaceId, __getTeamByWorkspace = _getTeamByWorkspace) => { // Renamed internally and dependency
    // Use executeQuery
    // Verify team exists in this workspace
    // Use the injected _getTeamByWorkspace function and pass the dbExecutor along
    const team = await __getTeamByWorkspace(name, workspaceId); // Use renamed internal dependency
    if (!team) {
        return null; // Or throw an error
    }

    const queryText = `
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
    const params = [team.id]; // Use the verified team's ID
    const result = await dbUtils.executeQuery(queryText, params); // Use dbUtils.executeQuery
     // Return the averages, providing defaults if no data exists
    return result.rows[0] || { average_velocity: '0.00', average_commitment: '0.00', completion_rate: '0.00' };
};

// Get all velocity teams associated with a workspace
const _getWorkspaceVelocityTeams = async (workspaceId) => { // Renamed internally
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
    const result = await dbUtils.executeQuery(queryText, params); // Use dbUtils.executeQuery
    return result.rows;
};

// Export an object containing all functions
export const velocityUtils = {
    createTeam: _createTeam,
    getTeam: _getTeam,
    getTeamByWorkspace: _getTeamByWorkspace,
    getTeamById: _getTeamById,
    getSprintById: _getSprintById,
    createSprint: _createSprint,
    updateSprintVelocity: _updateSprintVelocity,
    getTeamVelocity: _getTeamVelocity,
    getTeamVelocityByWorkspace: _getTeamVelocityByWorkspace,
    getTeamAverageVelocity: _getTeamAverageVelocity,
    getTeamAverageVelocityByWorkspace: _getTeamAverageVelocityByWorkspace,
    getWorkspaceVelocityTeams: _getWorkspaceVelocityTeams,
};
