import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { Socket as ClientSocket } from 'socket.io-client'; // Keep type import
import { useToast } from '@chakra-ui/react';
import { SequenceType } from '../constants/poker'; // Re-added import
import { useSocketManager } from './useSocketManager'; // Import the new hook
import { createHookLogger } from '../utils/logger'; // Import the new logger

// Create logger instance for this hook
const logger = createHookLogger('usePokerSocket');

// --- Interfaces ---
interface Participant {
  id: string;
  name: string;
  vote: string | null;
}

interface RoomSettings {
  sequence: SequenceType; // Changed back to SequenceType (key)
  hasPassword: boolean;
}

interface UsePokerSocketProps {
  roomId: string;
  initialUserName?: string | null;
  onRoomJoined: () => void;
  onJoinError?: (message: string) => void;
}

interface UsePokerSocketResult {
  socket: ClientSocket | null; // Expose socket instance
  participants: Participant[];
  settings: RoomSettings;
  isRevealed: boolean;
  isJoined: boolean;
  joinRoom: (userName: string, password?: string) => void;
  changeName: (newName: string) => void;
  vote: (value: string) => void;
  revealVotes: () => void;
  resetVotes: () => void;
  updateSettings: (settings: {
    sequence?: SequenceType; // Changed back to SequenceType (key)
    password?: string;
  }) => void;
  isConnected: boolean;
  isConnecting: boolean;
  isJoining: boolean;
  isConnectingOrJoining: boolean; // Combined loading state for UI
}

export const usePokerSocket = ({
  roomId,
  initialUserName,
  onRoomJoined,
  onJoinError,
}: UsePokerSocketProps): UsePokerSocketResult => {
  const [participants, setParticipants] = useState<Participant[]>([]);
  // Changed initial sequence back to 'fibonacci' key
  const [settings, setSettings] = useState<RoomSettings>({
    sequence: 'fibonacci',
    hasPassword: false,
  });
  const [isRevealed, setIsRevealed] = useState(false);
  const [isJoined, setIsJoined] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const pendingJoinRef = useRef<{
    userName: string;
    password?: string;
    type: 'manual' | 'auto';
  } | null>(null);
  const toast = useToast();

  // --- Internal Emit Function ---
  // Takes socketInstance as argument to avoid dependency cycle
  const emitJoinRoom = useCallback(
    (socketInstance: ClientSocket | null, userName: string, password?: string) => {
      if (!socketInstance) {
        logger.debug('emitJoinRoom called but socketInstance is null.');
        setIsJoining(false);
        return;
      }
      if (!roomId) {
        logger.debug('emitJoinRoom called but no roomId is set.');
        setIsJoining(false);
        return;
      }
      logger.debug('Emitting joinRoom event:', { roomId, userName, hasPassword: !!password });
      setIsJoining(true);

      const joinData = { roomId, userName, password };
      // Correct usage: emit('event', data, callback)
      socketInstance.emit('joinRoom', joinData, (ack: { error?: string }) => {
        // Pass callback as 3rd arg
        if (ack?.error) {
          logger.debug(`Server acknowledged joinRoom with immediate error: ${ack.error}`);
          setIsJoining(false);
          if (onJoinError) onJoinError(ack.error);
          else toast({ title: 'Join Failed', description: ack.error, status: 'error' });
        } else {
          logger.debug(
            'Server acknowledged joinRoom emission (waiting for roomJoined or error event).'
          );
        }
      });
      // Dependencies don't include socket state directly
    },
    [roomId, onJoinError, toast]
  );

  // --- Callbacks passed to useSocketManager ---
  // Define handleManagerConnect with socket dependency, but call it inside useEffect or another callback
  const handleManagerConnectInternal = useCallback(
    (currentSocket: ClientSocket | null) => {
      logger.debug('Socket connected via useSocketManager');
      if (pendingJoinRef.current && !isJoined) {
        logger.debug('Processing pending join after connect');
        const { userName, password } = pendingJoinRef.current;
        pendingJoinRef.current = null;
        emitJoinRoom(currentSocket, userName, password);
      } else if (initialUserName && !isJoined && !pendingJoinRef.current) {
        logger.debug('Attempting auto-join after connect');
        emitJoinRoom(currentSocket, initialUserName, undefined);
      }
    },
    [isJoined, initialUserName, emitJoinRoom]
  );

  const handleManagerDisconnect = useCallback(
    (reason: ClientSocket.DisconnectReason) => {
      logger.debug('Socket disconnected via useSocketManager', { reason });
      setIsJoined(false);
      setIsJoining(false);
      pendingJoinRef.current = null;
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
      pendingJoinRef.current = null;
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
    namespace: '/poker',
    autoConnect: !!roomId,
    // Pass wrapped callbacks that access the latest socket state
    onConnect: () => handleManagerConnectInternal(socket),
    onDisconnect: handleManagerDisconnect,
    onError: handleManagerError,
  });

  // Update the dependency array for handleManagerConnectInternal
  useEffect(() => {
    // This effect ensures handleManagerConnectInternal uses the latest socket state
    // It doesn't do anything itself, but makes handleManagerConnectInternal depend on socket
  }, [socket, handleManagerConnectInternal]);

  // --- Memoized Event Handlers for Better Performance ---
  const memoizedEventHandlers = useMemo(
    () => ({
      handleRoomJoined: (data: {
        participants: Participant[];
        settings: { sequence: string; hasPassword: boolean };
      }) => {
        logger.debug('Received roomJoined:', data);
        setParticipants(data.participants);
        // Ensure received sequence is a valid key before setting
        if (['fibonacci', 'tshirt', 'powers'].includes(data.settings.sequence)) {
          setSettings({
            sequence: data.settings.sequence as SequenceType,
            hasPassword: data.settings.hasPassword,
          });
        } else {
          console.warn(
            `Received invalid sequence key from backend: ${data.settings.sequence}. Defaulting to fibonacci.`
          );
          setSettings({ sequence: 'fibonacci', hasPassword: data.settings.hasPassword });
        }
        setIsJoined(true);
        setIsJoining(false);
        pendingJoinRef.current = null;
        onRoomJoined();
      },

      handleParticipantUpdate: (data: { participants: Participant[] }) => {
        logger.debug('Received participantUpdate:', data);
        setParticipants(data.participants);
      },

      handleSettingsUpdated: (data: { settings: { sequence: string; hasPassword: boolean } }) => {
        logger.debug('Received settingsUpdated:', data);
        // Ensure received sequence is a valid key before setting
        if (['fibonacci', 'tshirt', 'powers'].includes(data.settings.sequence)) {
          setSettings({
            sequence: data.settings.sequence as SequenceType,
            hasPassword: data.settings.hasPassword,
          });
        } else {
          console.warn(
            `Received invalid sequence key from backend during update: ${data.settings.sequence}. Keeping previous settings.`
          );
        }
      },

      handleVotesRevealed: () => {
        logger.debug('Received votesRevealed');
        setIsRevealed(true);
      },

      handleVotesReset: () => {
        logger.debug('Received votesReset');
        setIsRevealed(false);
      },

      handlePokerError: (errorData: unknown) => {
        const errorMessage =
          typeof errorData === 'object' &&
          errorData !== null &&
          'message' in errorData &&
          typeof (errorData as { message: unknown }).message === 'string'
            ? (errorData as { message: string }).message
            : 'An unknown poker error occurred';
        logger.debug('Poker Namespace Error:', errorMessage);
        if (
          errorMessage.toLowerCase().includes('password') ||
          errorMessage.toLowerCase().includes('join')
        ) {
          setIsJoining(false);
          pendingJoinRef.current = null;
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
            title: 'Poker Room Error',
            description: errorMessage,
            status: 'error',
            duration: 3000,
          });
        }
      },
    }),
    [onRoomJoined, onJoinError, toast]
  );

  // --- Extract handlers for easier reference ---
  const {
    handleRoomJoined,
    handleParticipantUpdate,
    handleSettingsUpdated,
    handleVotesRevealed,
    handleVotesReset,
    handlePokerError,
  } = memoizedEventHandlers;

  // --- Effect for Poker-Specific Event Listeners ---
  useEffect(() => {
    if (!socket) {
      setIsJoined(false);
      setIsJoining(false);
      setParticipants([]);
      setIsRevealed(false);
      return;
    }
    logger.debug('Attaching poker event listeners');
    socket.on('roomJoined', handleRoomJoined);
    socket.on('participantUpdate', handleParticipantUpdate);
    socket.on('settingsUpdated', handleSettingsUpdated);
    socket.on('votesRevealed', handleVotesRevealed);
    socket.on('votesReset', handleVotesReset);
    socket.on('error', handlePokerError);
    return () => {
      logger.debug('Detaching poker event listeners');
      socket.off('roomJoined', handleRoomJoined);
      socket.off('participantUpdate', handleParticipantUpdate);
      socket.off('settingsUpdated', handleSettingsUpdated);
      socket.off('votesRevealed', handleVotesRevealed);
      socket.off('votesReset', handleVotesReset);
      socket.off('error', handlePokerError);
    };
  }, [
    socket,
    handleRoomJoined,
    handleParticipantUpdate,
    handleSettingsUpdated,
    handleVotesRevealed,
    handleVotesReset,
    handlePokerError,
  ]);

  // --- Public Actions ---
  const joinRoom = useCallback(
    (userName: string, password?: string) => {
      if (!roomId) {
        logger.debug('joinRoom called but no roomId is set.');
        toast({
          title: 'Error',
          description: 'Cannot join room: Room ID is missing.',
          status: 'error',
        });
        return;
      }
      if (isJoined || isJoining) {
        logger.debug('joinRoom called but already joined or joining.');
        return;
      }
      logger.debug('Manual joinRoom requested:', { userName });
      if (socket && isConnected) {
        emitJoinRoom(socket, userName, password); // Pass socket instance
      } else {
        logger.debug('Socket not connected yet. Storing manual join details.');
        pendingJoinRef.current = { userName, password, type: 'manual' };
        setIsJoining(true);
        if (socket && !socket.active) {
          logger.debug('Socket inactive, calling connect()');
          socket.connect();
        } else if (!socket) {
          logger.debug(
            'No socket instance found, connection should be in progress via useSocketManager.'
          );
        }
      }
    },
    [roomId, socket, isConnected, isJoined, isJoining, toast, emitJoinRoom]
  );

  const changeName = useCallback(
    (newName: string) => {
      if (!socket || !roomId || !isJoined) return;
      logger.debug('Changing name:', newName);
      socket.emit('changeName', { roomId, newName });
    },
    [socket, roomId, isJoined]
  );

  const vote = useCallback(
    (value: string) => {
      if (!socket || !roomId || !isJoined) return;
      logger.debug('Voting:', value);
      socket.emit('vote', { roomId, vote: value });
    },
    [socket, roomId, isJoined]
  );

  const revealVotes = useCallback(() => {
    if (!socket || !roomId || !isJoined) return;
    logger.debug('Revealing votes');
    socket.emit('revealVotes', { roomId });
  }, [socket, roomId, isJoined]);

  const resetVotes = useCallback(() => {
    if (!socket || !roomId || !isJoined) return;
    logger.debug('Resetting votes');
    socket.emit('resetVotes', { roomId });
  }, [socket, roomId, isJoined]);

  // Changed sequence type back to SequenceType (key)
  const updateSettings = useCallback(
    (newSettings: { sequence?: SequenceType; password?: string }) => {
      if (!socket || !roomId || !isJoined) return;
      logger.debug('Updating settings:', newSettings);
      // Send sequence key (string)
      socket.emit('updateSettings', { roomId, settings: newSettings });
    },
    [socket, roomId, isJoined]
  );

  // --- Memoized Loading State ---
  const combinedLoadingState = useMemo(() => isConnecting || isJoining, [isConnecting, isJoining]);

  return {
    socket, // Expose socket instance
    participants,
    settings,
    isRevealed,
    isJoined,
    joinRoom,
    changeName,
    vote,
    revealVotes,
    resetVotes,
    updateSettings,
    isConnected,
    isConnecting: isConnecting,
    isJoining: isJoining,
    isConnectingOrJoining: combinedLoadingState,
  };
};

export type { Participant, RoomSettings };
