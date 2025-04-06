// server/types/sockets.ts
import { PokerParticipant, RetroBoardDetails, RetroBoardSettings } from './db.js'; // Import related DB types (needs .js extension)

// Define structure for error messages sent to client
export interface SocketErrorPayload {
  message: string;
}

// --- Poker Namespace Event Payloads ---

// Client -> Server Events
export interface PokerJoinRoomPayload {
  roomId: string;
  userName: string;
  password?: string | null;
}

export interface PokerUpdateSettingsPayload {
  roomId: string;
  settings: {
    sequence?: string; // Changed back to string (key)
    password?: string | null; // Plain text password or null/empty to remove
  };
}

export interface PokerChangeNamePayload {
  roomId: string;
  newName: string;
}

export interface PokerVotePayload {
  roomId: string;
  vote: string | null;
}

export interface PokerRevealVotesPayload {
  roomId: string;
}

export interface PokerResetVotesPayload {
  roomId: string;
}

// Server -> Client Events
export type PokerParticipantInfo = Pick<PokerParticipant, 'id' | 'name' | 'vote'>;

export interface PokerRoomSettingsInfo {
  sequence: string; // Changed back to string (key). Assume non-null from DB.
  hasPassword: boolean;
}

export interface PokerRoomJoinedPayload {
  participants: PokerParticipantInfo[];
  settings: PokerRoomSettingsInfo;
}

export interface PokerSettingsUpdatedPayload {
  settings: PokerRoomSettingsInfo;
}

export interface PokerParticipantUpdatePayload {
  participants: PokerParticipantInfo[];
}

// --- Retro Namespace Event Payloads (Add later) ---

// --- Retro Namespace Event Payloads ---

// Client -> Server Events
export interface RetroJoinBoardPayload {
  boardId: string;
  name: string;
  password?: string | null;
}

export interface RetroToggleCardsVisibilityPayload {
  boardId: string;
  hideCards: boolean;
}

export interface RetroAddCardPayload {
  boardId: string;
  cardId: string; // UUID generated client-side
  columnId: string;
  text: string;
  // authorName is determined server-side
}

export interface RetroEditCardPayload {
  boardId: string;
  cardId: string;
  text: string;
}

export interface RetroDeleteCardPayload {
  boardId: string;
  cardId: string;
}

export interface RetroToggleVotePayload {
  boardId: string;
  cardId: string;
}

export interface RetroUpdateSettingsPayload {
  boardId: string;
  settings: RetroBoardSettings;
}

export interface RetroChangeNamePayload {
  boardId: string;
  newName: string;
}

export interface RetroStartTimerPayload {
  boardId: string;
}

export interface RetroStopTimerPayload {
  boardId: string;
}

// Server -> Client Events
export interface RetroCardsVisibilityChangedPayload {
  hideCards: boolean;
}

export interface RetroTimerStartedPayload {
  timeLeft: number;
}

export interface RetroTimerUpdatePayload {
  timeLeft: number;
}

// Note: 'retroBoardJoined' and 'retroBoardUpdated' use RetroBoardDetails from db.ts


// --- Define Server and Client Event Maps ---

// Structure for Server -> Client events
export interface PokerServerToClientEvents {
  error: (payload: SocketErrorPayload) => void;
  roomJoined: (payload: PokerRoomJoinedPayload) => void;
  settingsUpdated: (payload: PokerSettingsUpdatedPayload) => void;
  participantUpdate: (payload: PokerParticipantUpdatePayload) => void;
  votesRevealed: () => void;
  votesReset: () => void;
}

// Structure for Client -> Server events
export interface PokerClientToServerEvents {
  joinRoom: (payload: PokerJoinRoomPayload) => void;
  updateSettings: (payload: PokerUpdateSettingsPayload) => void;
  changeName: (payload: PokerChangeNamePayload) => void;
  vote: (payload: PokerVotePayload) => void;
  revealVotes: (payload: PokerRevealVotesPayload) => void;
  resetVotes: (payload: PokerResetVotesPayload) => void;
}

// Structure for Inter-Server events (if needed)
export interface PokerInterServerEvents {
  // Example: ping: () => void;
}

// Structure for Socket Data
export interface PokerSocketData {
  roomId?: string; // Store the room ID the socket is associated with
  // Add other custom data you might store on the socket
}

// Add Retro event maps later...

// --- Retro Event Maps ---

export interface RetroServerToClientEvents {
  error: (payload: SocketErrorPayload) => void;
  cardsVisibilityChanged: (payload: RetroCardsVisibilityChangedPayload) => void;
  timerStarted: (payload: RetroTimerStartedPayload) => void;
  timerUpdate: (payload: RetroTimerUpdatePayload) => void;
  timerStopped: () => void;
  retroBoardJoined: (payload: RetroBoardDetails) => void;
  retroBoardUpdated: (payload: RetroBoardDetails) => void;
}

export interface RetroClientToServerEvents {
  joinRetroBoard: (payload: RetroJoinBoardPayload) => void;
  toggleCardsVisibility: (payload: RetroToggleCardsVisibilityPayload) => void;
  addRetroCard: (payload: RetroAddCardPayload) => void;
  editRetroCard: (payload: RetroEditCardPayload) => void;
  deleteRetroCard: (payload: RetroDeleteCardPayload) => void;
  toggleVote: (payload: RetroToggleVotePayload) => void;
  updateSettings: (payload: RetroUpdateSettingsPayload) => void;
  changeRetroName: (payload: RetroChangeNamePayload) => void;
  startTimer: (payload: RetroStartTimerPayload) => void;
  stopTimer: (payload: RetroStopTimerPayload) => void;
}

export interface RetroInterServerEvents {
  // Define if needed
}

export interface RetroSocketData {
  boardId?: string;
  // Add other custom data
}
