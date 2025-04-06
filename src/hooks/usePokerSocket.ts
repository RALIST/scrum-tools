import { useState, useEffect, useRef, useCallback } from 'react';
import type { Socket as ClientSocket } from 'socket.io-client'; // Keep type import
import { useToast } from '@chakra-ui/react';
// Removed: import { SequenceType } from '../constants/poker';
import { useSocketManager } from './useSocketManager'; // Import the new hook

// --- Interfaces ---
interface Participant {
    id: string;
    name: string;
    vote: string | null;
}

interface RoomSettings {
    sequence: string[] | null; // Changed from SequenceType
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
        sequence?: string[]; // Changed from SequenceType
        password?: string;
    }) => void;
    isConnected: boolean;
    isConnecting: boolean;
    isJoining: boolean;
    isConnectingOrJoining: boolean; // Combined loading state for UI
}

const debugLog = (message: string, data?: any) => {
    console.log(`[usePokerSocket] ${message}`, data || '');
};

export const usePokerSocket = ({ roomId, initialUserName, onRoomJoined, onJoinError }: UsePokerSocketProps): UsePokerSocketResult => {
    const [participants, setParticipants] = useState<Participant[]>([]);
    // Changed initial sequence to null
    const [settings, setSettings] = useState<RoomSettings>({ sequence: null, hasPassword: false });
    const [isRevealed, setIsRevealed] = useState(false);
    const [isJoined, setIsJoined] = useState(false);
    const [isJoining, setIsJoining] = useState(false);
    const pendingJoinRef = useRef<{ userName: string; password?: string; type: 'manual' | 'auto' } | null>(null);
    const toast = useToast();

    // --- Internal Emit Function ---
    // Takes socketInstance as argument to avoid dependency cycle
    const emitJoinRoom = useCallback((socketInstance: ClientSocket | null, userName: string, password?: string) => {
        if (!socketInstance) {
            debugLog('emitJoinRoom called but socketInstance is null.');
            setIsJoining(false);
            return;
        }
        if (!roomId) {
             debugLog('emitJoinRoom called but no roomId is set.');
             setIsJoining(false);
             return;
        }
        debugLog('Emitting joinRoom event:', { roomId, userName, hasPassword: !!password });
        setIsJoining(true);

        const joinData = { roomId, userName, password };
        // Correct usage: emit('event', data, callback)
        socketInstance.emit('joinRoom', joinData, (ack: { error?: string }) => { // Pass callback as 3rd arg
            if (ack?.error) {
                debugLog(`Server acknowledged joinRoom with immediate error: ${ack.error}`);
                setIsJoining(false);
                if (onJoinError) onJoinError(ack.error);
                else toast({ title: 'Join Failed', description: ack.error, status: 'error' });
            } else {
                debugLog('Server acknowledged joinRoom emission (waiting for roomJoined or error event).');
            }
        });
    // Dependencies don't include socket state directly
    }, [roomId, onJoinError, toast]);

    // --- Callbacks passed to useSocketManager ---
    // Define handleManagerConnect with socket dependency, but call it inside useEffect or another callback
    const handleManagerConnectInternal = useCallback((currentSocket: ClientSocket | null) => {
        debugLog('Socket connected via useSocketManager');
        if (pendingJoinRef.current && !isJoined) {
            debugLog('Processing pending join after connect');
            const { userName, password } = pendingJoinRef.current;
            pendingJoinRef.current = null;
            emitJoinRoom(currentSocket, userName, password);
        } else if (initialUserName && !isJoined && !pendingJoinRef.current) {
            debugLog('Attempting auto-join after connect');
            emitJoinRoom(currentSocket, initialUserName, undefined);
        }
    }, [isJoined, initialUserName, emitJoinRoom]);

    const handleManagerDisconnect = useCallback((reason: ClientSocket.DisconnectReason) => {
        debugLog('Socket disconnected via useSocketManager', { reason });
        setIsJoined(false);
        setIsJoining(false);
        pendingJoinRef.current = null;
        if (reason !== 'io client disconnect') {
            toast({ title: 'Disconnected', description: 'Connection lost. Attempting to reconnect...', status: 'warning', duration: 3000 });
        }
    }, []);

    const handleManagerError = useCallback((err: Error) => {
        debugLog('Socket connection error via useSocketManager', err);
        setIsJoining(false);
        pendingJoinRef.current = null;
        toast({ title: 'Connection Error', description: err.message, status: 'error', duration: 5000, isClosable: true });
    }, []);

    // --- Use the Socket Manager Hook ---
    const { socket, isConnected, isConnecting } = useSocketManager({
        namespace: '/poker',
        autoConnect: !!roomId,
        // Pass wrapped callbacks that access the latest socket state
        onConnect: () => handleManagerConnectInternal(socket),
        onDisconnect: handleManagerDisconnect,
        onError: handleManagerError
    });

     // Update the dependency array for handleManagerConnectInternal
     useEffect(() => {
        // This effect ensures handleManagerConnectInternal uses the latest socket state
        // It doesn't do anything itself, but makes handleManagerConnectInternal depend on socket
     }, [socket, handleManagerConnectInternal]);


    // --- Poker-Specific Event Handlers ---
    // Type for incoming data should match backend structure (sequence is string[] | null)
    const handleRoomJoined = useCallback((data: { participants: Participant[], settings: { sequence: string[] | null, hasPassword: boolean } }) => {
        debugLog('Received roomJoined:', data);
        setParticipants(data.participants);
        setSettings(data.settings); // This should now work correctly
        setIsJoined(true);
        setIsJoining(false);
        pendingJoinRef.current = null;
        onRoomJoined();
    }, [onRoomJoined]);

    const handleParticipantUpdate = useCallback((data: { participants: Participant[] }) => {
        debugLog('Received participantUpdate:', data);
        setParticipants(data.participants);
    }, []);

    // Type for incoming data should match backend structure (sequence is string[] | null)
    const handleSettingsUpdated = useCallback((data: { settings: { sequence: string[] | null, hasPassword: boolean } }) => {
        debugLog('Received settingsUpdated:', data);
        setSettings(data.settings); // This should now work correctly
    }, []);

    const handleVotesRevealed = useCallback(() => {
        debugLog('Received votesRevealed');
        setIsRevealed(true);
    }, []);

    const handleVotesReset = useCallback(() => {
        debugLog('Received votesReset');
        setIsRevealed(false);
    }, []);

    const handlePokerError = useCallback((errorData: any) => {
        const errorMessage = typeof errorData === 'object' && errorData?.message || 'An unknown poker error occurred';
        debugLog('Poker Namespace Error:', errorMessage);
        if (errorMessage.toLowerCase().includes('password') || errorMessage.toLowerCase().includes('join')) {
            setIsJoining(false);
            pendingJoinRef.current = null;
            if (onJoinError) onJoinError(errorMessage);
            else toast({ title: 'Join Error', description: errorMessage, status: 'error', duration: 3000 });
        } else {
             toast({ title: 'Poker Room Error', description: errorMessage, status: 'error', duration: 3000 });
        }
    }, [onJoinError, toast]);

    // --- Effect for Poker-Specific Event Listeners ---
    useEffect(() => {
        if (!socket) {
            setIsJoined(false);
            setIsJoining(false);
            setParticipants([]);
            setIsRevealed(false);
            return;
        }
        debugLog('Attaching poker event listeners');
        socket.on('roomJoined', handleRoomJoined);
        socket.on('participantUpdate', handleParticipantUpdate);
        socket.on('settingsUpdated', handleSettingsUpdated);
        socket.on('votesRevealed', handleVotesRevealed);
        socket.on('votesReset', handleVotesReset);
        socket.on('error', handlePokerError);
        return () => {
            debugLog('Detaching poker event listeners');
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
        handlePokerError
    ]);

    // --- Public Actions ---
    const joinRoom = useCallback((userName: string, password?: string) => {
        if (!roomId) {
             debugLog('joinRoom called but no roomId is set.');
             toast({ title: 'Error', description: 'Cannot join room: Room ID is missing.', status: 'error' });
             return;
        }
         if (isJoined || isJoining) {
             debugLog('joinRoom called but already joined or joining.');
             return;
         }
        debugLog('Manual joinRoom requested:', { userName });
        if (socket && isConnected) {
            emitJoinRoom(socket, userName, password); // Pass socket instance
        } else {
            debugLog('Socket not connected yet. Storing manual join details.');
            pendingJoinRef.current = { userName, password, type: 'manual' };
            setIsJoining(true);
            if (socket && !socket.active) {
                 debugLog('Socket inactive, calling connect()');
                 socket.connect();
            } else if (!socket) {
                debugLog('No socket instance found, connection should be in progress via useSocketManager.');
            }
        }
    }, [roomId, socket, isConnected, isJoined, isJoining, toast, emitJoinRoom]);

    const changeName = useCallback((newName: string) => {
        if (!socket || !roomId || !isJoined) return;
        debugLog('Changing name:', newName);
        socket.emit('changeName', { roomId, newName });
     }, [socket, roomId, isJoined]);

    const vote = useCallback((value: string) => {
        if (!socket || !roomId || !isJoined) return;
        debugLog('Voting:', value);
        socket.emit('vote', { roomId, vote: value });
     }, [socket, roomId, isJoined]);

    const revealVotes = useCallback(() => {
        if (!socket || !roomId || !isJoined) return;
        debugLog('Revealing votes');
        socket.emit('revealVotes', { roomId });
     }, [socket, roomId, isJoined]);

    const resetVotes = useCallback(() => {
        if (!socket || !roomId || !isJoined) return;
        debugLog('Resetting votes');
        socket.emit('resetVotes', { roomId });
     }, [socket, roomId, isJoined]);

    // Changed sequence type here to string[]
    const updateSettings = useCallback((newSettings: { sequence?: string[]; password?: string; }) => {
        if (!socket || !roomId || !isJoined) return;
        debugLog('Updating settings:', newSettings);
        // Ensure backend expects sequence as array here if we send it
        socket.emit('updateSettings', { roomId, settings: newSettings });
     }, [socket, roomId, isJoined]);

    const combinedLoadingState = isConnecting || isJoining;

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
