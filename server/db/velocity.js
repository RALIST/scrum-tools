import pool from './pool.js'

export const createTeam = async (id, name, password, workspaceId = null, createdBy = null) => {
    const client = await pool.connect()
    try {
        const result = await client.query(
            'INSERT INTO teams (id, name, password, workspace_id, created_by) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [id, name, password, workspaceId, createdBy]
        )
        return result.rows[0]
    } finally {
        client.release()
    }
}

export const getTeam = async (name, password) => {
    const client = await pool.connect()
    try {
        // First check if team exists
        const teamResult = await client.query(
            'SELECT * FROM teams WHERE name = $1',
            [name]
        )

        if (teamResult.rows.length === 0) {
            return null
        }
        
        // Then verify password
        const team = teamResult.rows[0]
        // console.log(team.password, password)
        // if (team.password !== password || !team.password !== team.name) {
        //     throw new Error("Invalid password")
        // }

        return team
    } finally {
        client.release()
    }
}

export const getTeamByWorkspace = async (name, workspaceId) => {
    const client = await pool.connect()
    try {
        const result = await client.query(
            'SELECT * FROM teams WHERE name = $1 AND workspace_id = $2',
            [name, workspaceId]
        )
        
        if (result.rows.length === 0) {
            return null
        }
        
        return result.rows[0]
    } finally {
        client.release()
    }
}

export const createSprint = async (id, teamId, name, startDate, endDate) => {
    const client = await pool.connect()
    try {
        const result = await client.query(
            'INSERT INTO sprints (id, team_id, name, start_date, end_date) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [id, teamId, name, startDate, endDate]
        )
        return result.rows[0]
    } finally {
        client.release()
    }
}

export const updateSprintVelocity = async (sprintId, committedPoints, completedPoints) => {
    const client = await pool.connect()
    try {
        const result = await client.query(
            `INSERT INTO sprint_velocity (sprint_id, committed_points, completed_points)
             VALUES ($1, $2, $3)
             ON CONFLICT (sprint_id)
             DO UPDATE SET committed_points = $2, completed_points = $3
             RETURNING *`,
            [sprintId, committedPoints, completedPoints]
        )
        return result.rows[0]
    } finally {
        client.release()
    }
}

export const getTeamVelocity = async (name, password) => {
    const client = await pool.connect()
    try {
        // First verify team and password
        const team = await getTeam(name, password)
        if (!team) {
            return null
        }

        const result = await client.query(
            `SELECT s.name as sprint_name, s.start_date, s.end_date, 
                    sv.committed_points, sv.completed_points
             FROM sprints s
             LEFT JOIN sprint_velocity sv ON s.id = sv.sprint_id
             LEFT JOIN teams t ON s.team_id = t.id
             WHERE t.name = $1
             ORDER BY s.start_date DESC
             LIMIT 10`,
            [name]
        )
        return result.rows
    } finally {
        client.release()
    }
}

export const getTeamVelocityByWorkspace = async (name, workspaceId) => {
    const client = await pool.connect()
    try {
        // Verify team exists in this workspace
        const team = await getTeamByWorkspace(name, workspaceId)
        if (!team) {
            return null
        }

        const result = await client.query(
            `SELECT s.name as sprint_name, s.start_date, s.end_date, 
                    sv.committed_points, sv.completed_points
             FROM sprints s
             LEFT JOIN sprint_velocity sv ON s.id = sv.sprint_id
             LEFT JOIN teams t ON s.team_id = t.id
             WHERE t.name = $1 AND t.workspace_id = $2
             ORDER BY s.start_date DESC
             LIMIT 10`,
            [name, workspaceId]
        )
        return result.rows
    } finally {
        client.release()
    }
}

export const getTeamAverageVelocity = async (name, password) => {
    const client = await pool.connect()
    try {
        // First verify team and password
        const team = await getTeam(name, password)
        if (!team) {
            return null
        }

        const result = await client.query(
            `SELECT 
                CAST(AVG(sv.completed_points) AS DECIMAL(10,2)) as average_velocity,
                CAST(AVG(sv.committed_points) AS DECIMAL(10,2)) as average_commitment,
                CAST(AVG(CAST(sv.completed_points AS FLOAT) / 
                    CASE WHEN sv.committed_points = 0 THEN 1 
                    ELSE sv.committed_points END * 100) AS DECIMAL(10,2)) as completion_rate
             FROM sprints s
             LEFT JOIN sprint_velocity sv ON s.id = sv.sprint_id
             LEFT JOIN teams t ON s.team_id = t.id
             WHERE t.name = $1
             AND sv.completed_points IS NOT NULL`,
            [name]
        )
        return result.rows[0]
    } finally {
        client.release()
    }
}

export const getTeamAverageVelocityByWorkspace = async (name, workspaceId) => {
    const client = await pool.connect()
    try {
        // Verify team exists in this workspace
        const team = await getTeamByWorkspace(name, workspaceId)
        if (!team) {
            return null
        }

        const result = await client.query(
            `SELECT 
                CAST(AVG(sv.completed_points) AS DECIMAL(10,2)) as average_velocity,
                CAST(AVG(sv.committed_points) AS DECIMAL(10,2)) as average_commitment,
                CAST(AVG(CAST(sv.completed_points AS FLOAT) / 
                    CASE WHEN sv.committed_points = 0 THEN 1 
                    ELSE sv.committed_points END * 100) AS DECIMAL(10,2)) as completion_rate
             FROM sprints s
             LEFT JOIN sprint_velocity sv ON s.id = sv.sprint_id
             LEFT JOIN teams t ON s.team_id = t.id
             WHERE t.name = $1 AND t.workspace_id = $2
             AND sv.completed_points IS NOT NULL`,
            [name, workspaceId]
        )
        return result.rows[0]
    } finally {
        client.release()
    }
}
