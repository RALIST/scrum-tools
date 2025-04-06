// server/types/db.ts

/**
 * Represents a user record in the database.
 */
export interface User {
  id: string; // UUID
  email: string;
  name: string;
  password_hash?: string; // Optional as it's not always selected/returned
  created_at: Date | string; // Timestamps can be Date objects or strings depending on pg settings
  last_login?: Date | string | null; // Can be null if user never logged in
}

// Add other database model interfaces here as we migrate other db files...

/**
 * Represents a poker room record in the database.
 */
export interface PokerRoom {
  id: string; // Room ID (could be custom string)
  name: string;
  sequence: string; // Changed back to string (key)
  password?: string | null; // Optional password hash
  workspace_id?: string | null; // Optional workspace association
  created_at: Date | string;
  participant_count?: number; // Added by JOIN in getRooms/getWorkspaceRooms
  hasPassword?: boolean; // Added by getPokerRoomInfo
}

/**
 * Represents a participant in a poker room.
 */
export interface PokerParticipant {
  id: string; // Participant ID (likely socket ID or user ID)
  room_id: string;
  name: string;
  vote?: string | null; // Vote value (can be null)
  created_at: Date | string;
}

/**
 * Represents the detailed room data including participants, as returned by getRoom.
 */
export interface PokerRoomDetails {
  id: string;
  name: string;
  password?: string | null;
  workspace_id?: string | null;
  created_at: Date | string;
  sequence: string; // Changed back to string (key)
  participants: Map<string, Pick<PokerParticipant, 'id' | 'name' | 'vote'>>; // Added participants map
}


/**
 * Represents a retro board record in the database.
 */
export interface RetroBoard {
  id: string; // Board ID (likely UUID)
  name: string;
  timer_running: boolean;
  time_left: number; // Seconds
  default_timer: number; // Seconds
  hide_cards_by_default: boolean;
  hide_author_names: boolean;
  password?: string | null; // Hashed password
  workspace_id?: string | null;
  created_at: Date | string;
  card_count?: number; // Added by JOIN in getWorkspaceRetroBoards
  hasPassword?: boolean; // Calculated field, not directly in DB
}

/**
 * Represents a card on a retro board.
 */
export interface RetroCard {
  id: string; // Card ID (likely UUID)
  board_id: string;
  column_id: string; // e.g., 'went-well', 'to-improve', 'action-items'
  text: string;
  author_name: string;
  created_at: Date | string;
  votes?: string[]; // Array of user names who voted, added by JOIN
}

/**
 * Represents a vote on a retro card.
 * Note: The primary key is (card_id, user_name).
 */
export interface RetroCardVote {
  card_id: string;
  user_name: string;
  created_at: Date | string;
}

/**
 * Represents the detailed retro board data including cards, as returned by getRetroBoard.
 */
export interface RetroBoardDetails extends Omit<RetroBoard, 'card_count' | 'password'> {
  cards: RetroCard[]; // Includes cards with votes populated
}

/**
 * Represents the settings that can be updated for a retro board.
 */
export interface RetroBoardSettings {
  defaultTimer?: number;
  hideCardsByDefault?: boolean;
  hideAuthorNames?: boolean;
  password?: string | null; // Plain text password or null to remove
}


/**
 * Represents a velocity team record in the database.
 */
export interface VelocityTeam {
  id: string; // Team ID (likely UUID)
  name: string;
  password?: string | null; // Hashed password for non-workspace teams
  workspace_id?: string | null;
  created_by?: string | null; // User ID
  created_at: Date | string;
}

/**
 * Represents a sprint record in the database.
 */
export interface VelocitySprint {
  id: string; // Sprint ID (likely UUID)
  team_id: string;
  name: string;
  start_date: Date | string;
  end_date: Date | string;
  created_at: Date | string;
}

/**
 * Represents the velocity data for a specific sprint.
 */
export interface SprintVelocity {
  sprint_id: string;
  committed_points: number | null;
  completed_points: number | null;
  created_at: Date | string;
}

/**
 * Represents the combined data for team velocity chart.
 */
export interface TeamVelocityData {
  sprint_id: string;
  sprint_name: string;
  start_date: Date | string;
  end_date: Date | string;
  committed_points: number | null;
  completed_points: number | null;
  team_id: string;
}

/**
 * Represents the average velocity data for a team.
 */
export interface TeamAverageVelocity {
  average_velocity: string; // DECIMAL(10,2) represented as string
  average_commitment: string; // DECIMAL(10,2) represented as string
  completion_rate: string; // DECIMAL(10,2) represented as string
}

/**
 * Represents a velocity team listed within a workspace context.
 */
export interface WorkspaceVelocityTeam {
  id: string;
  name: string;
  created_at: Date | string;
  avg_velocity_preview?: string | null; // DECIMAL(10,1) represented as string or null
}


/**
 * Represents a workspace record in the database.
 */
export interface Workspace {
  id: string; // UUID
  name: string;
  description: string | null;
  owner_id: string; // User ID
  created_at: Date | string;
  role?: WorkspaceRole; // Added by JOIN in getUserWorkspaces
}

/**
 * Defines the possible roles for a workspace member.
 */
export type WorkspaceRole = 'admin' | 'member';

/**
 * Represents a member record in the workspace_members table.
 */
export interface WorkspaceMember {
  workspace_id: string;
  user_id: string;
  role: WorkspaceRole;
  joined_at: Date | string;
}

/**
 * Represents the detailed member data including user info, as returned by getWorkspaceMembers.
 */
export interface WorkspaceMemberDetails extends Pick<User, 'id' | 'name' | 'email'> {
  role: WorkspaceRole;
  joined_at: Date | string;
}

/**
 * Represents a workspace invitation record in the database.
 */
export interface WorkspaceInvitation {
  id: number; // Serial ID
  workspace_id: string;
  token: string;
  role_to_assign: WorkspaceRole;
  expires_at: Date | string;
  created_by: string; // User ID
  created_at: Date | string;
  used_at?: Date | string | null;
  used_by?: string | null; // User ID
}

/**
 * Represents the data returned when finding a valid invitation.
 */
export interface ValidWorkspaceInvitation {
  id: number;
  workspace_id: string;
  role_to_assign: WorkspaceRole;
}
