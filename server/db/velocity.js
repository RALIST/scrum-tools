import { executeQuery } from './dbUtils.js'; // Use executeQuery
import bcrypt from 'bcryptjs'; // Import bcrypt

export const createTeam = async (id, name, password, workspaceId = null, createdBy = null) => {
    // Hash password if provided
    const passwordHash = password ? await bcrypt.hash(password, 10) : null;

    // Use the correct column name 'password' from the schema
    const queryText = `
        INSERT INTO teams (id, name, password, workspace_id, created_by) 
        VALUES ($1, $2, $3, $4, $5) 
        RETURNING id, name, workspace_id, created_by, created_at
    `; // Don't return password hash
    const params = [id, name, passwordHash, workspaceId, createdBy];

    const result = await executeQuery(queryText, params);
    // Return the created team data (without the hash)
    return result.rows[0];
};

export const getTeam = async (name, password) => {
    // Use executeQuery
    const queryText = 'SELECT * FROM teams WHERE name = $1'; // Select hash to verify
    const params = [name];
    const teamResult = await executeQuery(queryText, params);

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

export const getTeamByWorkspace = async (name, workspaceId) => {
    // Use executeQuery
    const queryText = `
        SELECT id, name, workspace_id, created_by, created_at
        FROM teams
        WHERE name = $1 AND workspace_id = $2
    `; // Exclude password_hash
    const params = [name, workspaceId];
    const result = await executeQuery(queryText, params);

    // Return the found team or null
    return result.rows[0] || null; 
};

export const createSprint = async (id, teamId, name, startDate, endDate) => {
    // Use executeQuery
    const queryText = `
        INSERT INTO sprints (id, team_id, name, start_date, end_date)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
    `;
    const params = [id, teamId, name, startDate, endDate];
    const result = await executeQuery(queryText, params);
    return result.rows[0];
};

export const updateSprintVelocity = async (sprintId, committedPoints, completedPoints) => {
    // Use executeQuery
    const queryText = `
        INSERT INTO sprint_velocity (sprint_id, committed_points, completed_points)
        VALUES ($1, $2, $3)
        ON CONFLICT (sprint_id)
        DO UPDATE SET committed_points = $2, completed_points = $3
        RETURNING sprint_id, committed_points, completed_points, created_at 
    `; // Return specific fields including sprint_id
    const params = [sprintId, committedPoints, completedPoints];
    const result = await executeQuery(queryText, params);
    return result.rows[0];
};

export const getTeamVelocity = async (name, password) => {
    // Use executeQuery
    // First verify team and password using the updated getTeam function
    const team = await getTeam(name, password); // This will throw if password invalid or team not found
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
    const result = await executeQuery(queryText, params);
    return result.rows;
};

export const getTeamVelocityByWorkspace = async (name, workspaceId) => {
    // Use executeQuery
    // Verify team exists in this workspace
    const team = await getTeamByWorkspace(name, workspaceId);
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
    const result = await executeQuery(queryText, params);
    return result.rows;
};

export const getTeamAverageVelocity = async (name, password) => {
    // Use executeQuery
    // First verify team and password using the updated getTeam function
    const team = await getTeam(name, password); // This will throw if password invalid or team not found
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
    const result = await executeQuery(queryText, params);
    // Return the averages, providing defaults if no data exists
    return result.rows[0] || { average_velocity: '0.00', average_commitment: '0.00', completion_rate: '0.00' };
};

export const getTeamAverageVelocityByWorkspace = async (name, workspaceId) => {
    // Use executeQuery
    // Verify team exists in this workspace
    const team = await getTeamByWorkspace(name, workspaceId);
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
    const result = await executeQuery(queryText, params);
     // Return the averages, providing defaults if no data exists
    return result.rows[0] || { average_velocity: '0.00', average_commitment: '0.00', completion_rate: '0.00' };
};

// Get all velocity teams associated with a workspace
export const getWorkspaceVelocityTeams = async (workspaceId) => {
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
    const result = await executeQuery(queryText, params);
    return result.rows;
};
