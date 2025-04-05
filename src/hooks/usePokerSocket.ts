import { useState, useEffect, useRef, useCallback } from 'react';
import { Manager } from 'socket.io-client';
import type { Socket as ClientSocket } from 'socket.io-client';
import { useToast } from '@chakra-ui/react';
import config from '../config';
import { SequenceType } from '../constants/poker';

// --- Interfaces ---
interface Participant {
    id: string;
    name: string;
    vote: string | null;
}

interface RoomSettings {
    sequence: SequenceType;
    hasPassword: boolean;
}

interface UsePokerSocketProps {
    roomId: string; // Expect roomId only when connection is desired
    initialUserName?: string | null; // Optional: For auto-join attempts after connect
    onRoomJoined: () => void;
    onJoinError?: (message: string) => void; // Callback for join errors
}

interface UsePokerSocketResult {
    socket: ClientSocket | null;
    participants: Participant[];
    settings: RoomSettings;
    isRevealed: boolean;
    isJoined: boolean;
    joinRoom: (userName: string, password?: string) => void; // Public function to initiate join
    changeName: (newName: string) => void;
    vote: (value: string) => void;
    revealVotes: () => void;
    resetVotes: () => void;
    updateSettings: (settings: {
        sequence?: SequenceType;
        password?: string;
    }) => void;
    isConnected: boolean;
    isConnectingOrJoining: boolean; // Tracks connection OR join attempt
}

const debugLog = (message: string, data?: any) => {
    // if (import.meta.env.DEV) {
        console.log(`[usePokerSocket] ${message}`, data || '');
    // }
};

// Debounce function
function debounce<F extends (...args: any[]) => any>(func: F, waitFor: number) {
  let timeoutId: NodeJS.Timeout | null = null;
  return (...args: Parameters<F>): void => {
    if (timeoutId !== null) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), waitFor);
  };
}

export const usePokerSocket = ({ roomId, initialUserName, onRoomJoined, onJoinError }: UsePokerSocketProps): UsePokerSocketResult => {
    const [socket, setSocket] = useState<ClientSocket | null>(null);
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [settings, setSettings] = useState<RoomSettings>({ sequence: 'fibonacci', hasPassword: false });
    const [isRevealed, setIsRevealed] = useState(false);
    const [isJoined, setIsJoined] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const [isConnectingOrJoining, setIsConnectingOrJoining] = useState(false); // Tracks connection OR join attempt
    const socketRef = useRef<ClientSocket | null>(null);
    const managerRef = useRef<Manager | null>(null);
    // Ref to store details for a join attempt initiated *before* connection was established
    const pendingJoinRef = useRef<{ userName: string; password?: string; type: 'manual' | 'auto' } | null>(null);
    const toast = useToast();

    const debouncedConnectionErrorToast = useCallback(
        debounce((description: string) => {
            toast({
                title: 'Connection Error', description, status: 'error', duration: 5000, isClosable: true,
            });
        }, 300),
    [toast]);

    // Internal function to emit joinRoom
    const emitJoinRoom = useCallback((userName: string, password?: string) => {
        if (!socketRef.current) {
            debugLog('emitJoinRoom called but socketRef is null.');
            setIsConnectingOrJoining(false); // Ensure loading stops
            return;
        }
        if (!roomId) {
             debugLog('emitJoinRoom called but no roomId is set.');
             setIsConnectingOrJoining(false);
             return;
        }
        debugLog('Emitting joinRoom event:', { roomId, userName, hasPassword: !!password });
        setIsConnectingOrJoining(true); // Indicate join attempt is in progress

        const joinData = { roomId, userName, password };
        socketRef.current.emit('joinRoom', joinData, (ack: { error?: string }) => {
            // This callback confirms the server received the event,
            // but success/failure is determined by 'roomJoined' or 'error' events.
            if (ack?.error) {
                // Handle potential immediate errors from server acknowledgement
                debugLog(`Server acknowledged joinRoom with immediate error: ${ack.error}`);
                setIsConnectingOrJoining(false);
                if (onJoinError) onJoinError(ack.error);
                else toast({ title: 'Join Failed', description: ack.error, status: 'error' });
            } else {
                debugLog('Server acknowledged joinRoom emission (waiting for roomJoined event or error).');
                // Keep loading true until roomJoined event or error/timeout
            }
        });
    }, [roomId, onJoinError, toast]); // Dependencies

    // Effect for establishing and cleaning up the connection
    useEffect(() => {
        if (!roomId) {
            // Cleanup if roomId becomes empty or hook unmounts while disconnected
            if (socketRef.current) {
                debugLog(`roomId cleared, disconnecting socket: ${socketRef.current.id}`);
                socketRef.current.disconnect();
                socketRef.current = null;
                setSocket(null);
            }
             if (managerRef.current) {
                 debugLog('roomId cleared, disconnecting manager');
                 // managerRef.current.disconnect(); // Avoid private method
                 managerRef.current = null; // Just clear the ref
             }
            setIsJoined(false);
            setIsConnected(false);
            setIsConnectingOrJoining(false);
            pendingJoinRef.current = null;
            return;
        }

        debugLog(`Effect for roomId ${roomId}: Initializing connection.`);
        setIsConnectingOrJoining(true); // Indicate connection attempt start
        setIsJoined(false);
        pendingJoinRef.current = null; // Clear previous pending join

        // Create Manager only if it doesn't exist
        if (!managerRef.current) {
            debugLog('Creating new Manager instance');
            managerRef.current = new Manager(config.socketUrl, {
                reconnection: true, reconnectionAttempts: 3, reconnectionDelay: 1500,
                reconnectionDelayMax: 5000, timeout: 10000, transports: ['websocket', 'polling']
            });
        }

        const manager = managerRef.current;
        const newSocket = manager.socket('/poker');
        socketRef.current = newSocket;
        setSocket(newSocket);
        debugLog(`Created/Got socket ${newSocket.id}. Manager connecting...`);

        // --- Attach Listeners ---
        const handleConnect = () => {
            debugLog(`Socket connected: ${newSocket.id}`);
            debugLog(`Socket connected: ${newSocket.id}`);
            setIsConnected(true);
            setIsConnectingOrJoining(false); // Connection established, stop *connection* loading

            // ALWAYS check for pending join requests after connection
            if (pendingJoinRef.current && !isJoined) {
                 debugLog('Connected, processing pending join request:', pendingJoinRef.current.type);
                 const { userName, password } = pendingJoinRef.current;
                 pendingJoinRef.current = null; // Clear pending request
                 emitJoinRoom(userName, password); // This will set isConnectingOrJoining back to true for the join attempt
            }
            // Also handle initial auto-join if no manual join was pending
            else if (initialUserName && !isJoined && !pendingJoinRef.current) {
                 debugLog('Connected, attempting auto-join with initialUserName:', { userName: initialUserName });
                 emitJoinRoom(initialUserName, undefined);
            }
        };

        const handleRoomJoined = (data: { participants: Participant[], settings: RoomSettings }) => {
            debugLog('Received roomJoined:', data);
            setParticipants(data.participants);
            setSettings(data.settings);
            setIsJoined(true);
            setIsConnectingOrJoining(false); // Join successful
            pendingJoinRef.current = null; // Clear any pending join info
            onRoomJoined();
        };

        const handleParticipantUpdate = (data: { participants: Participant[] }) => { setParticipants(data.participants); };
        const handleSettingsUpdated = (data: { settings: RoomSettings }) => { setSettings(data.settings); };
        const handleVotesRevealed = () => { setIsRevealed(true); };
        const handleVotesReset = () => { setIsRevealed(false); };

        const handleConnectError = (err: Error) => {
            console.error(`Socket connect_error for ${newSocket.id}:`, err.message);
            setIsConnected(false);
            setIsConnectingOrJoining(false);
            pendingJoinRef.current = null;
            debouncedConnectionErrorToast(`Connection failed: ${err.message}`);
        };

        const handleSocketError = (errorData: any) => {
            const errorMessage = typeof errorData === 'object' && errorData?.message || 'An unknown socket error occurred';
            console.error(`Socket error for ${newSocket.id}:`, errorMessage, errorData);

            if (errorMessage.toLowerCase().includes('password') || errorMessage.toLowerCase().includes('join')) {
                debugLog('Join/Password error detected, stopping loading state.');
                setIsConnectingOrJoining(false);
                pendingJoinRef.current = null;
                if (onJoinError) onJoinError(errorMessage);
                else toast({ title: 'Join Error', description: errorMessage, status: 'error', duration: 3000 });
            } else {
                 toast({ title: 'Socket Error', description: errorMessage, status: 'error', duration: 3000 });
                 // Potentially stop loading for other errors too
                 // setIsConnectingOrJoining(false);
            }
        };

        const handleDisconnect = (reason: string) => {
            debugLog(`Socket disconnected: ${newSocket.id}, reason: ${reason}`);
            setIsConnected(false);
            setIsJoined(false);
            pendingJoinRef.current = null;
            if (reason !== 'io client disconnect') {
                setIsConnectingOrJoining(true); // Show loading during reconnection attempts
                debouncedConnectionErrorToast('Disconnected. Attempting to reconnect...');
            } else {
                 setIsConnectingOrJoining(false); // Explicit disconnect
            }
        };

        newSocket.on('connect', handleConnect);
        newSocket.on('roomJoined', handleRoomJoined);
        newSocket.on('participantUpdate', handleParticipantUpdate);
        newSocket.on('settingsUpdated', handleSettingsUpdated);
        newSocket.on('votesRevealed', handleVotesRevealed);
        newSocket.on('votesReset', handleVotesReset);
        newSocket.on('connect_error', handleConnectError);
        newSocket.on('error', handleSocketError);
        newSocket.on('disconnect', handleDisconnect);

        // --- Initiate Connection ---
        if (!newSocket.connected) {
            debugLog(`Socket ${newSocket.id} not connected, calling connect()`);
            newSocket.connect();
        } else {
             // Already connected, call handler logic directly
             handleConnect();
        }

        // --- Cleanup function ---
        return () => {
            debugLog(`Cleaning up effect for roomId: ${roomId}, socket: ${newSocket.id}`);
            newSocket.off('connect', handleConnect);
            newSocket.off('roomJoined', handleRoomJoined);
            newSocket.off('participantUpdate', handleParticipantUpdate);
            newSocket.off('settingsUpdated', handleSettingsUpdated);
            newSocket.off('votesRevealed', handleVotesRevealed);
            newSocket.off('votesReset', handleVotesReset);
            newSocket.off('connect_error', handleConnectError);
            newSocket.off('error', handleSocketError);
            newSocket.off('disconnect', handleDisconnect);

            debugLog(`Disconnecting socket ${newSocket.id} in cleanup`);
            newSocket.disconnect();

            if (socketRef.current === newSocket) {
                socketRef.current = null;
                setSocket(null);
            }
            // Manager cleanup handled by unmount effect
        };
    // Rerun ONLY if roomId or initialUserName changes.
    }, [roomId, initialUserName, onRoomJoined, onJoinError, toast, debouncedConnectionErrorToast, emitJoinRoom]);

    // Timeout effect for connection/join attempts
    useEffect(() => {
        let timeoutId: NodeJS.Timeout | null = null;
        if (isConnectingOrJoining) {
            debugLog('Starting operation timeout (15s)');
            timeoutId = setTimeout(() => {
                if (isConnectingOrJoining) {
                    console.error('Operation timed out after 15 seconds.');
                    toast({
                        title: 'Operation Timeout', description: 'Failed to connect or join the room in time.',
                        status: 'error', duration: 5000, isClosable: true,
                    });
                    setIsConnectingOrJoining(false);
                    pendingJoinRef.current = null;
                    if (socketRef.current && !isConnected) {
                        debugLog('Timeout reached while connecting, forcing disconnect.');
                        socketRef.current.disconnect();
                    }
                }
            }, 15000);
        }
        return () => { if (timeoutId) clearTimeout(timeoutId); };
    }, [isConnectingOrJoining, isConnected, isJoined, toast]);


    // Public function exposed to the component for manual joins
    const joinRoom = useCallback((userName: string, password?: string) => {
        if (!roomId) {
             debugLog('joinRoom called but no roomId is set.');
             toast({ title: 'Error', description: 'Cannot join room: Room ID is missing.', status: 'error' });
             return;
        }
         if (isJoined) {
             debugLog('joinRoom called but already joined.');
             return;
         }

        debugLog('Manual joinRoom requested:', { userName });

        if (socketRef.current && isConnected) {
            // If connected, call internal join logic immediately
            emitJoinRoom(userName, password);
        } else {
            // If not connected, store the details and attempt connection
            debugLog('Socket not connected yet. Storing manual join details and ensuring connection attempt.');
            pendingJoinRef.current = { userName, password, type: 'manual' }; // Mark as manual
            setIsConnectingOrJoining(true); // Show loading
            // Check if socket exists before accessing properties/methods
            if (socketRef.current) { // Check if socketRef.current exists
                if (!socketRef.current.active) {
                    debugLog('Socket inactive, calling connect()');
                    socketRef.current.connect();
                } else {
                     debugLog('Socket exists but not connected. Connect event will handle join.');
                     socketRef.current.connect(); // Ensure connection attempt
                }
            } else if (managerRef.current) {
                 // This case is less likely if socketRef is always set when manager exists
                 debugLog('No socket ref, but manager exists? Trying manager connect.');
                 // Manager connects automatically, but we can try to ensure socket connection
                 // This might create a new socket instance if the old one was lost
                 const currentManager = managerRef.current;
                 const socket = currentManager.socket('/poker');
                 socketRef.current = socket; // Update ref
                 setSocket(socket);
                 socket.connect();
            } else { // This case implies managerRef.current is also null
                 console.error("Cannot join: Manager not available.");
                 setIsConnectingOrJoining(false);
                 toast({ title: 'Error', description: 'Connection manager not available.', status: 'error' });
            }
        }
    }, [roomId, isConnected, isJoined, toast, emitJoinRoom]); // Use emitJoinRoom

    // Other actions...
    const changeName = useCallback((newName: string) => {
        if (!socketRef.current || !roomId || !isJoined) return;
        debugLog('Changing name:', newName);
        socketRef.current.emit('changeName', { roomId, newName });
     }, [roomId, isJoined]);

    const vote = useCallback((value: string) => {
        if (!socketRef.current || !roomId || !isJoined) return;
        debugLog('Voting:', value);
        socketRef.current.emit('vote', { roomId, vote: value });
     }, [roomId, isJoined]);

    const revealVotes = useCallback(() => {
        if (!socketRef.current || !roomId || !isJoined) return;
        debugLog('Revealing votes');
        socketRef.current.emit('revealVotes', { roomId });
     }, [roomId, isJoined]);

    const resetVotes = useCallback(() => {
        if (!socketRef.current || !roomId || !isJoined) return;
        debugLog('Resetting votes');
        socketRef.current.emit('resetVotes', { roomId });
     }, [roomId, isJoined]);

    const updateSettings = useCallback((newSettings: { sequence?: SequenceType; password?: string; }) => {
        if (!socketRef.current || !roomId || !isJoined) return;
        debugLog('Updating settings:', newSettings);
        socketRef.current.emit('updateSettings', { roomId, settings: newSettings });
     }, [roomId, isJoined]);

    // Effect to clean up manager on full component unmount
     useEffect(() => {
         // This effect ensures the manager is cleaned up ONLY when the component unmounts
         const managerToClean = managerRef.current; // Capture the ref value at the time the effect runs
         return () => {
             if (managerToClean) {
                 debugLog('Component unmounting, disconnecting manager instance');
                 // Disconnect the engine associated with this specific manager instance
                 // managerToClean.disconnect(); // Avoid calling private method
                 // Disconnecting the socket in the main effect's cleanup should be sufficient
                 managerRef.current = null; // Clear the ref
             }
         };
     }, []); // Empty dependency array ensures this runs only on unmount

    return {
        socket, participants, settings, isRevealed, isJoined, joinRoom,
        changeName, vote, revealVotes, resetVotes, updateSettings,
        isConnected, isConnectingOrJoining,
    };
};

export type { Participant, RoomSettings };
