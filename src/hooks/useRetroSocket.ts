import { useState, useEffect, useRef, useCallback } from 'react';
import type { Socket as ClientSocket } from 'socket.io-client'; // Keep type import
import { useToast } from '@chakra-ui/react';
// Removed apiRequest, AuthError imports
// Removed useAuth import
import { useSocketManager } from './useSocketManager'; // Import the new hook
import { createHookLogger } from '../utils/logger'; // Import the new logger

// Create logger instance for this hook
const logger = createHookLogger('useRetroSocket');

// --- Interfaces ---
interface RetroCard {
  id: string;
  text: string;
  column_id: string;
  author_name: string;
  created_at: string;
  votes: string[];
}

interface RetroBoard {
  id: string;
  name: string;
  created_at: string;
  cards: RetroCard[];
  timer_running: boolean;
  time_left: number;
  default_timer: number;
  hide_cards_by_default: boolean;
  hide_author_names: boolean;
  hasPassword: boolean;
}

interface UseRetroSocketProps {
  boardId: string | null;
  onBoardJoined: () => void; // Callback when successfully joined the board via socket event
  onJoinError?: (message: string) => void; // Callback on join error
}

interface UseRetroSocketResult {
  board: RetroBoard | null; // Board data now comes *only* from socket events
  isTimerRunning: boolean;
  timeLeft: number;
  hideCards: boolean;
  setHideCards: (hide: boolean) => void; // Function to request visibility change
  hasJoined: boolean;
  joinBoard: (name: string, password?: string) => void; // Function to initiate joining
  changeName: (newName: string) => void;
  addCard: (cardId: string, columnId: string, text: string, authorName: string) => void;
  editCard: (cardId: string, text: string) => void;
  deleteCard: (cardId: string) => void;
  toggleVote: (cardId: string) => void;
  toggleTimer: () => void;
  updateSettings: (settings: {
    defaultTimer?: number;
    hideCardsByDefault?: boolean;
    hideAuthorNames?: boolean;
    password?: string;
  }) => void;
  isConnected: boolean; // Socket connection status from manager
  isConnecting: boolean; // Socket connecting status from manager
  isJoining: boolean; // True while attempting to join the board via socket emit
  isConnectingOrJoining: boolean; // Combined loading state (connecting OR joining)
}

export const useRetroSocket = ({
  boardId,
  onBoardJoined,
  onJoinError,
}: UseRetroSocketProps): UseRetroSocketResult => {
  // --- State specific to Retro ---
  const [board, setBoard] = useState<RetroBoard | null>(null);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(300); // Initial default, updated by server
  const [hideCards, setHideCards] = useState(false);
  const [hasJoined, setHasJoined] = useState(false);
  const [isJoining, setIsJoining] = useState(false); // Tracks the socket join *attempt*

  // --- Refs ---
  const joinParamsRef = useRef<{ name: string; password?: string } | null>(null); // For manual join initiated before connect
  // Removed timerIntervalRef
  const toast = useToast();
  const socketRef = useRef<ClientSocket | null>(null);

  // --- Internal Emit Function ---
  const emitJoinBoard = useCallback(
    (socketInstance: ClientSocket | null, name: string, password?: string) => {
      logger.debug('Attempting to call emitJoinBoard');
      if (!socketInstance || !boardId) {
        logger.debug('emitJoinBoard condition not met', { hasSocket: !!socketInstance, boardId });
        setIsJoining(false);
        return;
      }
      logger.debug('Emitting joinRetroBoard event:', { boardId, name, hasPassword: !!password });
      setIsJoining(true);
      const joinData = { boardId, name, password };
      socketInstance.emit('joinRetroBoard', joinData, (ack: { error?: string }) => {
        if (ack?.error) {
          logger.debug(`Server acknowledged joinRetroBoard with immediate error: ${ack.error}`);
          setIsJoining(false);
          joinParamsRef.current = null;
          if (onJoinError) onJoinError(ack.error);
          else toast({ title: 'Join Failed', description: ack.error, status: 'error' });
        } else {
          logger.debug('Server acknowledged joinRetroBoard emission.');
        }
      });
    },
    [boardId, onJoinError, toast]
  );

  const emitJoinBoardRef = useRef(emitJoinBoard);
  useEffect(() => {
    emitJoinBoardRef.current = emitJoinBoard;
  }, [emitJoinBoard]);

  // --- Callbacks passed to useSocketManager ---
  // Now only handles pending MANUAL joins
  const handleManagerConnectInternal = useCallback(() => {
    const currentSocket = socketRef.current;
    logger.debug('Socket connected via useSocketManager');
    // Process ONLY pending *manual* join requests after connection
    if (joinParamsRef.current && !hasJoined) {
      logger.debug('Processing pending manual join after connect');
      const { name, password } = joinParamsRef.current;
      emitJoinBoardRef.current(currentSocket, name, password);
      // Don't clear ref here, wait for success/error in handleRetroBoardJoined/handleRetroError
    }
    // Auto-join logic is now handled by the component calling joinBoard
  }, [hasJoined]); // Only depends on hasJoined

  const handleManagerDisconnect = useCallback(
    (reason: ClientSocket.DisconnectReason) => {
      logger.debug('Socket disconnected via useSocketManager', { reason });
      setHasJoined(false);
      setIsJoining(false);
      joinParamsRef.current = null;
      setBoard(null); // Clear board data on disconnect
      if (reason !== 'io client disconnect') {
        toast({
          title: 'Disconnected',
          description: 'Connection lost. Attempting to reconnect...',
          status: 'warning',
          duration: 3000,
        });
      }
    },
    [toast]
  );

  const handleManagerError = useCallback(
    (err: Error) => {
      logger.debug('Socket connection error via useSocketManager', err);
      setIsJoining(false);
      joinParamsRef.current = null;
      toast({
        title: 'Connection Error',
        description: err.message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    },
    [toast]
  );

  // --- Use the Socket Manager Hook ---
  const { socket, isConnected, isConnecting } = useSocketManager({
    namespace: '/retro',
    autoConnect: !!boardId, // Connect automatically if boardId is present
    onConnect: handleManagerConnectInternal,
    onDisconnect: handleManagerDisconnect,
    onError: handleManagerError,
  });

  // Update socketRef whenever socket state changes from useSocketManager
  useEffect(() => {
    socketRef.current = socket;
  }, [socket]);

  // --- Retro-Specific Event Handlers ---
  const handleRetroBoardJoined = useCallback(
    (data: RetroBoard) => {
      logger.debug('Joined retro board', data);
      setBoard(data); // Set board data received upon joining
      setIsTimerRunning(data.timer_running);
      setTimeLeft(data.time_left);
      setHideCards(data.hide_cards_by_default);
      setHasJoined(true);
      setIsJoining(false);
      joinParamsRef.current = null; // Clear join params on successful join
      onBoardJoined();
    },
    [onBoardJoined]
  );

  const handleRetroBoardUpdated = useCallback((data: RetroBoard) => {
    logger.debug('Board updated', data);
    setBoard(data);
    setIsTimerRunning(data.timer_running);
    setTimeLeft(data.time_left);
  }, []);

  const handleCardsVisibilityChanged = useCallback(
    ({ hideCards: newHideCards }: { hideCards: boolean }) => {
      logger.debug('Cards visibility changed', { newHideCards });
      setHideCards(newHideCards);
    },
    []
  );

  const handleTimerStarted = useCallback(({ timeLeft: serverTimeLeft }: { timeLeft: number }) => {
    logger.debug('Timer started', { serverTimeLeft });
    setIsTimerRunning(true);
    setTimeLeft(serverTimeLeft);
  }, []);

  const handleTimerStopped = useCallback(() => {
    logger.debug('Timer stopped');
    setIsTimerRunning(false);
  }, []);

  const handleTimerUpdate = useCallback(({ timeLeft: serverTimeLeft }: { timeLeft: number }) => {
    logger.debug('Timer update', { serverTimeLeft });
    setTimeLeft(serverTimeLeft);
  }, []);

  const handleRetroError = useCallback(
    (errorData: any) => {
      const errorMessage =
        (typeof errorData === 'object' && errorData?.message) || 'An unknown retro error occurred';
      logger.debug('Retro Namespace Error:', errorMessage);
      if (
        errorMessage.toLowerCase().includes('password') ||
        errorMessage.toLowerCase().includes('join')
      ) {
        setIsJoining(false);
        joinParamsRef.current = null;
        setHasJoined(false); // Ensure not marked as joined on join error
        if (onJoinError) onJoinError(errorMessage);
        else
          toast({
            title: 'Join Error',
            description: errorMessage,
            status: 'error',
            duration: 3000,
          });
      } else {
        toast({
          title: 'Retro Board Error',
          description: errorMessage,
          status: 'error',
          duration: 3000,
        });
      }
    },
    [onJoinError, toast]
  );

  // --- Effect for Initial Board Data Fetch (REMOVED) ---

  // --- Effect for Retro-Specific Event Listeners ---
  useEffect(() => {
    const currentSocket = socketRef.current;
    if (!currentSocket) {
      // Reset state if socket becomes null
      setHasJoined(false);
      setIsJoining(false);
      setBoard(null);
      return;
    }

    logger.debug('Attaching retro event listeners');
    currentSocket.on('retroBoardJoined', handleRetroBoardJoined);
    currentSocket.on('retroBoardUpdated', handleRetroBoardUpdated);
    currentSocket.on('cardsVisibilityChanged', handleCardsVisibilityChanged);
    currentSocket.on('timerStarted', handleTimerStarted);
    currentSocket.on('timerStopped', handleTimerStopped);
    currentSocket.on('timerUpdate', handleTimerUpdate);
    currentSocket.on('error', handleRetroError);

    // Removed getInitialBoardState emit

    return () => {
      logger.debug('Detaching retro event listeners');
      if (currentSocket) {
        currentSocket.off('retroBoardJoined', handleRetroBoardJoined);
        currentSocket.off('retroBoardUpdated', handleRetroBoardUpdated);
        currentSocket.off('cardsVisibilityChanged', handleCardsVisibilityChanged);
        currentSocket.off('timerStarted', handleTimerStarted);
        currentSocket.off('timerStopped', handleTimerStopped);
        currentSocket.off('timerUpdate', handleTimerUpdate);
        currentSocket.off('error', handleRetroError);
      }
    };
    // Rerun when socket instance changes or handlers change
  }, [
    socket, // Re-attach if socket instance changes
    handleRetroBoardJoined,
    handleRetroBoardUpdated,
    handleCardsVisibilityChanged,
    handleTimerStarted,
    handleTimerStopped,
    handleTimerUpdate,
    handleRetroError,
  ]);

  // Effect to manage the client-side timer interval (REMOVED)

  // --- Public Actions ---
  const joinBoard = useCallback(
    (name: string, password?: string) => {
      if (!boardId || hasJoined || isJoining) {
        logger.debug('Join attempt ignored', { boardId, hasJoined, isJoining });
        return;
      }
      logger.debug('Manual joinBoard requested', { name });
      const currentSocket = socketRef.current;

      if (currentSocket && isConnected) {
        emitJoinBoardRef.current(currentSocket, name, password);
      } else if (currentSocket && !isConnected) {
        logger.debug(
          'Socket exists but not connected, storing manual join details and attempting connect...'
        );
        joinParamsRef.current = { name, password }; // Store params for onConnect handler
        setIsJoining(true);
        currentSocket.connect();
      } else {
        logger.debug('No socket instance yet, storing manual join details.');
        joinParamsRef.current = { name, password }; // Store params for onConnect handler
        setIsJoining(true);
        // useSocketManager should handle the connection attempt
      }
    },
    [boardId, hasJoined, isJoining, isConnected]
  );

  const changeName = useCallback(
    (newName: string) => {
      if (!socketRef.current || !boardId || !hasJoined) return;
      logger.debug('Changing name', { newName });
      socketRef.current.emit('changeRetroName', { boardId, newName });
    },
    [boardId, hasJoined]
  );

  const addCard = useCallback(
    (cardId: string, columnId: string, text: string, authorName: string) => {
      if (!socketRef.current || !boardId || !hasJoined) return;
      logger.debug('Adding card', { cardId, columnId, text, authorName });
      socketRef.current.emit('addRetroCard', { boardId, cardId, columnId, text, authorName });
    },
    [boardId, hasJoined]
  );

  const editCard = useCallback(
    (cardId: string, text: string) => {
      if (!socketRef.current || !boardId || !hasJoined) return;
      logger.debug('Editing card', { cardId, text });
      socketRef.current.emit('editRetroCard', { boardId, cardId, text });
    },
    [boardId, hasJoined]
  );

  const deleteCard = useCallback(
    (cardId: string) => {
      if (!socketRef.current || !boardId || !hasJoined) return;
      logger.debug('Deleting card', { cardId });
      socketRef.current.emit('deleteRetroCard', { boardId, cardId });
    },
    [boardId, hasJoined]
  );

  const toggleVote = useCallback(
    (cardId: string) => {
      if (!socketRef.current || !boardId || !hasJoined) return;
      logger.debug('Toggling vote', { cardId });
      socketRef.current.emit('toggleVote', { boardId, cardId });
    },
    [boardId, hasJoined]
  );

  const toggleTimer = useCallback(() => {
    if (!socketRef.current || !boardId || !hasJoined) return;
    logger.debug('Toggling timer', { isTimerRunning });
    if (isTimerRunning) {
      socketRef.current.emit('stopTimer', { boardId });
    } else {
      socketRef.current.emit('startTimer', { boardId });
    }
  }, [boardId, hasJoined, isTimerRunning]);

  const updateSettings = useCallback(
    (settings: {
      defaultTimer?: number;
      hideCardsByDefault?: boolean;
      hideAuthorNames?: boolean;
      password?: string;
    }) => {
      if (!socketRef.current || !boardId || !hasJoined) return;
      logger.debug('Updating settings', settings);
      socketRef.current.emit('updateSettings', { boardId, settings });
    },
    [boardId, hasJoined]
  );

  const setHideCardsRequest = useCallback(
    (hide: boolean) => {
      if (!socketRef.current || !boardId || !hasJoined) return;
      logger.debug('Requesting hide cards', { hide });
      socketRef.current.emit('toggleCardsVisibility', { boardId, hideCards: hide });
    },
    [boardId, hasJoined]
  );

  // Combined loading state includes connection and joining states
  const combinedLoadingState = isConnecting || isJoining;

  return {
    board,
    isTimerRunning,
    timeLeft,
    hideCards,
    setHideCards: setHideCardsRequest,
    hasJoined,
    joinBoard,
    changeName,
    addCard,
    editCard,
    deleteCard,
    toggleVote,
    toggleTimer,
    updateSettings,
    isConnected,
    isConnecting,
    isJoining,
    isConnectingOrJoining: combinedLoadingState,
  };
};

export type { RetroBoard, RetroCard };
