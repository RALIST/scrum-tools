import { useState, useEffect, useRef, useCallback } from 'react';
import { Manager } from 'socket.io-client';
import type { Socket as ClientSocket } from 'socket.io-client';
import { useToast } from '@chakra-ui/react';
import config from '../config';
import { SequenceType } from '../constants/poker';
import { useAuth } from '../contexts/AuthContext'; // Import useAuth

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
    roomId: string;
    onRoomJoined: () => void;
}

interface UsePokerSocketResult {
    socket: ClientSocket | null;
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
        sequence?: SequenceType;
        password?: string;
    }) => void;
    isConnectingOrJoining: boolean; // Add new state indicator
}

const debugLog = (message: string, data?: any) => {
    console.log(`[usePokerSocket] ${message}`, data || '');
};

// Debounce function
function debounce<F extends (...args: any[]) => any>(func: F, waitFor: number) {
  let timeoutId: NodeJS.Timeout | null = null;

  return (...args: Parameters<F>): void => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => func(...args), waitFor);
  };
}


export const usePokerSocket = ({ roomId, onRoomJoined }: UsePokerSocketProps): UsePokerSocketResult => {
    const [socket, setSocket] = useState<ClientSocket | null>(null);
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [settings, setSettings] = useState<RoomSettings>({
        sequence: 'fibonacci',
        hasPassword: false
    });
    const [isRevealed, setIsRevealed] = useState(false);
    const [isJoined, setIsJoined] = useState(false);
    // Default to false, set true only when actively trying to connect/join
    const [isConnectingOrJoining, setIsConnectingOrJoining] = useState(false);
    const socketRef = useRef<ClientSocket | null>(null);
    // Manager ref might not be strictly needed if we create it inside effect
    // const managerRef = useRef<Manager | null>(null);
    const joinParamsRef = useRef<{ userName: string; password?: string } | null>(null);
    const toast = useToast();
    const { user, isAuthenticated } = useAuth();

    // Debounced toast for connection errors to avoid spamming
    const debouncedConnectionErrorToast = useCallback(
        debounce((description: string) => {
            toast({
                title: 'Connection Error',
                description: description,
                status: 'error',
                duration: 5000, // Longer duration for connection errors
                isClosable: true,
            });
        }, 300), // Debounce for 300ms
    [toast]);

    // Main effect for socket connection and events
    useEffect(() => {
        // If no roomId, disconnect and cleanup
        if (!roomId) {
            if (socketRef.current) {
                debugLog(`No roomId, disconnecting socket: ${socketRef.current.id}`);
                socketRef.current.disconnect();
                socketRef.current = null;
                setSocket(null);
                setIsJoined(false);
                setIsConnectingOrJoining(false);
            }
            return;
        }

        debugLog(`Effect triggered for roomId: ${roomId}. Current socket: ${socketRef.current?.id}, connected: ${socketRef.current?.connected}`);
        setIsConnectingOrJoining(true); // Start loading state
        setIsJoined(false); // Reset joined state

        // --- Create Manager and Socket ---
        // Create manager and socket instance directly here.
        // Rely on default autoConnect: true.
        // This ensures a fresh connection attempt for the specific roomId.
        debugLog('Creating new Manager and Socket instance');
        const manager = new Manager(config.socketUrl, {
            reconnection: true,
            reconnectionAttempts: 3, // Fewer attempts might be better UX
            reconnectionDelay: 1500,
            reconnectionDelayMax: 5000,
            timeout: 10000, // Shorter timeout
            transports: ['websocket', 'polling']
        });
        const newSocket = manager.socket('/poker');
        socketRef.current = newSocket;
        setSocket(newSocket);
        debugLog(`New socket created: ${newSocket.id}, trying to connect...`);

        // --- Prepare Join Params ---
        if (isAuthenticated && user?.name) {
            debugLog('User authenticated, preparing auto-join params', { userName: user.name });
            joinParamsRef.current = { userName: user.name };
        } else {
            debugLog('User not authenticated, manual join required');
            joinParamsRef.current = null; // Ensure it's null for non-auth users
        }

        // --- Attach Listeners ---
        const handleConnect = () => {
            debugLog(`Socket connected: ${newSocket.id}`);
            // Attempt to join only if we have params and haven't successfully joined yet
            if (joinParamsRef.current && !isJoined) {
                const joinData = { roomId, userName: joinParamsRef.current.userName, password: joinParamsRef.current.password };
                debugLog('Attempting joinRoom on connect:', joinData);
                newSocket.emit('joinRoom', joinData);
                // Keep isConnectingOrJoining true until roomJoined or error
            } else if (!joinParamsRef.current && !isJoined) {
                debugLog('Connected, but no auto-join params. Waiting for manual join.');
                setIsConnectingOrJoining(false); // Stop loading, wait for manual action
            } else if (isJoined) {
                 debugLog('Reconnected and already joined.');
                 setIsConnectingOrJoining(false); // Already joined
            }
        };

        const handleRoomJoined = (data: { participants: Participant[], settings: RoomSettings }) => {
            debugLog('Received roomJoined:', data);
            setParticipants(data.participants);
            setSettings(data.settings);
            setIsJoined(true);
            setIsConnectingOrJoining(false); // Successfully joined, stop loading
            onRoomJoined();
        };

        const handleParticipantUpdate = (data: { participants: Participant[] }) => {
            debugLog('Received participantUpdate:', data);
            setParticipants(data.participants);
        };

        const handleSettingsUpdated = (data: { settings: RoomSettings }) => {
            debugLog('Received settingsUpdated:', data);
            setSettings(data.settings);
        };

        const handleVotesRevealed = () => {
            debugLog('Received votesRevealed');
            setIsRevealed(true);
        };

        const handleVotesReset = () => {
            debugLog('Received votesReset');
            setIsRevealed(false);
        };

        const handleConnectError = (err: Error) => {
            console.error(`Socket connect_error for ${newSocket.id}:`, err.message);
            setIsConnectingOrJoining(false); // Stop loading on connection error
            debouncedConnectionErrorToast(`Connection failed: ${err.message}`);
            // Consider if joinParams should be cleared here or allow manual retry
        };

        const handleSocketError = (errorData: any) => {
            const errorMessage = typeof errorData === 'object' && errorData !== null && typeof errorData.message === 'string'
                ? errorData.message
                : 'An unknown socket error occurred';
            console.error(`Socket error for ${newSocket.id}:`, errorMessage, errorData);

            // Specific handling for join/password errors
            if (errorMessage.toLowerCase().includes('password') || errorMessage.toLowerCase().includes('join')) {
                debugLog('Join/Password error detected, stopping loading state.');
                setIsConnectingOrJoining(false);
                joinParamsRef.current = null; // Clear params after failed join attempt
                // No toast here? The server might send specific messages handled elsewhere,
                // or maybe a generic "Join failed" toast is needed. Let's rely on server message for now.
                toast({ title: 'Join Error', description: errorMessage, status: 'error', duration: 3000 });
            } else {
                 // Generic toast for other errors
                 toast({ title: 'Socket Error', description: errorMessage, status: 'error', duration: 3000 });
                 // Decide if other errors should also stop loading
                 // setIsConnectingOrJoining(false);
            }
        };

        const handleDisconnect = (reason: string) => {
            debugLog(`Socket disconnected: ${newSocket.id}, reason: ${reason}`);
            setIsJoined(false); // Assume not joined on disconnect
            // If disconnect was not initiated by client, manager will try to reconnect based on options
            if (reason !== 'io client disconnect') {
                setIsConnectingOrJoining(true); // Show loading during reconnection attempts
                debouncedConnectionErrorToast('Disconnected. Attempting to reconnect...');
            } else {
                 setIsConnectingOrJoining(false); // Explicit disconnect, stop loading
            }
        };

        // Attach listeners
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
        // Manager has autoConnect: true by default, but open() is idempotent
        debugLog(`Calling manager.open() for socket ${newSocket.id}`);
        manager.open((err?: Error) => {
            if (err) {
                console.error(`Manager.open() failed for ${newSocket.id}:`, err.message);
                setIsConnectingOrJoining(false);
                debouncedConnectionErrorToast(`Connection manager failed: ${err.message}`);
            } else {
                debugLog(`Manager.open() called successfully for ${newSocket.id}. Waiting for 'connect' event.`);
            }
        });

        // --- Cleanup function for this effect ---
        return () => {
            debugLog(`Cleaning up effect for roomId: ${roomId}, socket: ${newSocket.id}`);
            // Remove listeners
            newSocket.off('connect', handleConnect);
            newSocket.off('roomJoined', handleRoomJoined);
            newSocket.off('participantUpdate', handleParticipantUpdate);
            newSocket.off('settingsUpdated', handleSettingsUpdated);
            newSocket.off('votesRevealed', handleVotesRevealed);
            newSocket.off('votesReset', handleVotesReset);
            newSocket.off('connect_error', handleConnectError);
            newSocket.off('error', handleSocketError);
            newSocket.off('disconnect', handleDisconnect);

            // Disconnect the socket and potentially the manager
            debugLog(`Disconnecting socket ${newSocket.id} in cleanup`);
            newSocket.disconnect();

            // If this is the currently active socket, clear the state ref
            if (socketRef.current === newSocket) {
                socketRef.current = null;
                setSocket(null);
            }
            // Close the manager associated with this socket instance?
            // NO - Manager might be reused by other sockets or needed for reconnection.
            // Let the unmount effect handle final cleanup if necessary.
            // debugLog(`Closing manager for socket ${newSocket.id}`);
            // manager.close(); // This caused errors before

            // Reset state related to this connection attempt
            setIsJoined(false);
            setIsConnectingOrJoining(false);
            // Don't clear joinParamsRef here, it might be needed for a quick reconnect/re-render
        };
    // Dependencies: Re-run effect if roomId changes, or if user/auth state changes (to update joinParams)
    }, [roomId, onRoomJoined, toast, user, isAuthenticated, debouncedConnectionErrorToast]); // Added debounced toast

    // Timeout effect remains useful as a final fallback
    useEffect(() => {
        let timeoutId: NodeJS.Timeout | null = null;
        if (isConnectingOrJoining && !isJoined) {
            debugLog('Starting connection/join timeout (15s)');
            timeoutId = setTimeout(() => {
                if (isConnectingOrJoining && !isJoined) { // Double check state before firing
                    console.error('Connection/Join timed out after 15 seconds.');
                    toast({
                        title: 'Connection Timeout',
                        description: 'Failed to connect or join the room in time.',
                        status: 'error',
                        duration: 5000,
                        isClosable: true,
                    });
                    setIsConnectingOrJoining(false);
                    // Force disconnect if socket still exists
                    if (socketRef.current) {
                        debugLog('Timeout reached, forcing disconnect.');
                        socketRef.current.disconnect();
                    }
                }
            }, 15000); // 15 seconds timeout
        }
        return () => {
            if (timeoutId) {
                debugLog('Clearing connection/join timeout.');
                clearTimeout(timeoutId);
            }
        };
    }, [isConnectingOrJoining, isJoined, toast]);

    // Manual join function (called from UI)
    const joinRoom = useCallback((userName: string, password?: string) => {
        if (!roomId) {
             debugLog('joinRoom called with no roomId');
             return;
        }
         if (isJoined) {
             debugLog('joinRoom called but already joined');
             return;
         }

        debugLog('Manual joinRoom requested:', { userName });
        joinParamsRef.current = { userName, password }; // Set params for manual join
        setIsConnectingOrJoining(true); // Indicate joining process starts

        if (socketRef.current) {
            if (socketRef.current.connected) {
                debugLog('Socket connected, emitting joinRoom manually');
                socketRef.current.emit('joinRoom', { roomId, userName, password });
            } else {
                debugLog('Socket exists but not connected, attempting to connect manager');
                // Manager should already be trying to connect due to autoConnect: true
                // or the main effect's manager.open() call.
                // We just need to wait for the 'connect' event.
                // If manager.open() failed previously, this won't work, but timeout should handle it.
                 socketRef.current.connect(); // Explicitly try connecting the socket instance
            }
        } else {
            // This case should ideally not happen with the new effect structure
            console.error("joinRoom called, but socket is not initialized. This might indicate an issue.");
            // Optionally trigger a state update to force re-run of the main effect?
             toast({ title: 'Error', description: 'Socket not ready. Please wait and try again.', status: 'error' });
             setIsConnectingOrJoining(false);
        }
    }, [roomId, isJoined, toast]); // Added toast dependency

    // Other actions (changeName, vote, etc.) remain largely the same
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

    const updateSettings = useCallback((newSettings: {
        sequence?: SequenceType;
        password?: string;
    }) => {
        if (!socketRef.current || !roomId || !isJoined) return;
        debugLog('Updating settings:', newSettings);
        socketRef.current.emit('updateSettings', { roomId, settings: newSettings });
    }, [roomId, isJoined]);

    return {
        socket,
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
        isConnectingOrJoining,
    };
};

export type { Participant, RoomSettings };
