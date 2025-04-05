import { useState, useEffect, useRef, useCallback } from 'react';
import type { Socket as ClientSocket } from 'socket.io-client'; // Keep type import
import { useToast } from '@chakra-ui/react';
import { apiRequest, AuthError } from '../utils/apiUtils';
import { useAuth } from '../contexts/AuthContext';
import { useSocketManager } from './useSocketManager'; // Import the new hook

// --- Interfaces ---
interface RetroCard {
    id: string
    text: string
    column_id: string
    author_name: string
    created_at: string
    votes: string[]
}

interface RetroBoard {
    id: string
    name: string
    created_at: string
    cards: RetroCard[]
    timer_running: boolean
    time_left: number
    default_timer: number
    hide_cards_by_default: boolean
    hide_author_names: boolean
    hasPassword: boolean
}

interface UseRetroSocketProps {
    boardId: string | null;
    onBoardJoined: () => void;
    onJoinError?: (message: string) => void;
}

interface UseRetroSocketResult {
    board: RetroBoard | null;
    isTimerRunning: boolean;
    timeLeft: number;
    hideCards: boolean;
    setHideCards: (hide: boolean) => void;
    hasJoined: boolean;
    joinBoard: (name: string, password?: string) => void;
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
    isConnected: boolean;
    isConnecting: boolean;
    isJoining: boolean;
    isConnectingOrJoining: boolean; // Combined loading state
}

const debugLog = (message: string, data?: any) => {
    console.log(`[useRetroSocket] ${message}`, data || '');
};

export const useRetroSocket = ({ boardId, onBoardJoined, onJoinError }: UseRetroSocketProps): UseRetroSocketResult => {
    // --- State specific to Retro ---
    const [board, setBoard] = useState<RetroBoard | null>(null);
    const [isTimerRunning, setIsTimerRunning] = useState(false);
    const [timeLeft, setTimeLeft] = useState(300);
    const [hideCards, setHideCards] = useState(false);
    const [hasJoined, setHasJoined] = useState(false);
    const [isJoining, setIsJoining] = useState(false);
    const [initialBoardDataLoaded, setInitialBoardDataLoaded] = useState(false);

    // --- Refs ---
    const joinParamsRef = useRef<{ name: string; password?: string } | null>(null);
    const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const toast = useToast();
    const { user, isAuthenticated } = useAuth(); // Keep access to auth state
    const socketRef = useRef<ClientSocket | null>(null);

    // --- Internal Emit Function ---
    const emitJoinBoard = useCallback((socketInstance: ClientSocket | null, name: string, password?: string) => {
        if (!socketInstance || !boardId) {
            debugLog('emitJoinBoard condition not met', { hasSocket: !!socketInstance, boardId });
            setIsJoining(false);
            return;
        }
        debugLog('Emitting joinRetroBoard event:', { boardId, name, hasPassword: !!password });
        setIsJoining(true);
        const joinData = { boardId, name, password };
        socketInstance.emit('joinRetroBoard', joinData, (ack: { error?: string }) => {
            if (ack?.error) {
                debugLog(`Server acknowledged joinRetroBoard with immediate error: ${ack.error}`);
                setIsJoining(false);
                joinParamsRef.current = null;
                if (onJoinError) onJoinError(ack.error);
                else toast({ title: 'Join Failed', description: ack.error, status: 'error' });
            } else {
                debugLog('Server acknowledged joinRetroBoard emission.');
            }
        });
    }, [boardId, onJoinError, toast]);

    // --- Callbacks passed to useSocketManager ---
    const handleManagerConnectInternal = useCallback(() => {
        const currentSocket = socketRef.current;
        debugLog('Socket connected via useSocketManager');
        if (joinParamsRef.current && !hasJoined) {
            debugLog('Processing pending join after connect');
            const { name, password } = joinParamsRef.current;
            emitJoinBoard(currentSocket, name, password);
        }
    }, [hasJoined, emitJoinBoard]);

    const handleManagerDisconnect = useCallback((reason: ClientSocket.DisconnectReason) => {
        debugLog('Socket disconnected via useSocketManager', { reason });
        setHasJoined(false);
        setIsJoining(false);
        joinParamsRef.current = null;
        if (reason !== 'io client disconnect') {
            toast({ title: 'Disconnected', description: 'Connection lost. Attempting to reconnect...', status: 'warning', duration: 3000 });
        }
    }, [toast]);

    const handleManagerError = useCallback((err: Error) => {
        debugLog('Socket connection error via useSocketManager', err);
        setIsJoining(false);
        joinParamsRef.current = null;
        toast({ title: 'Connection Error', description: err.message, status: 'error', duration: 5000, isClosable: true });
    }, [toast]);

    // --- Use the Socket Manager Hook ---
    const { socket, isConnected, isConnecting } = useSocketManager({
        namespace: '/retro',
        autoConnect: false, // Connect manually after fetching initial data
        onConnect: handleManagerConnectInternal,
        onDisconnect: handleManagerDisconnect,
        onError: handleManagerError
    });

    // Update socketRef whenever socket state changes from useSocketManager
    useEffect(() => {
        socketRef.current = socket;
    }, [socket]);

    // --- Retro-Specific Event Handlers ---
    const handleRetroBoardJoined = useCallback((data: RetroBoard) => {
        debugLog('Joined retro board', data);
        setBoard(data);
        setIsTimerRunning(data.timer_running);
        setTimeLeft(data.time_left);
        setHideCards(data.hide_cards_by_default);
        setHasJoined(true);
        setIsJoining(false);
        joinParamsRef.current = null;
        onBoardJoined();
    }, [onBoardJoined]);

    const handleRetroBoardUpdated = useCallback((data: RetroBoard) => {
        debugLog('Board updated', data);
        setBoard(data);
        setIsTimerRunning(data.timer_running);
        setTimeLeft(data.time_left);
    }, []);

    const handleCardsVisibilityChanged = useCallback(({ hideCards: newHideCards }: { hideCards: boolean }) => {
        debugLog('Cards visibility changed', { newHideCards });
        setHideCards(newHideCards);
    }, []);

    const handleTimerStarted = useCallback(({ timeLeft: serverTimeLeft }: { timeLeft: number }) => {
        debugLog('Timer started', { serverTimeLeft });
        setIsTimerRunning(true);
        setTimeLeft(serverTimeLeft);
    }, []);

    const handleTimerStopped = useCallback(() => {
        debugLog('Timer stopped');
        setIsTimerRunning(false);
    }, []);

    const handleTimerUpdate = useCallback(({ timeLeft: serverTimeLeft }: { timeLeft: number }) => {
        debugLog('Timer update', { serverTimeLeft });
        setTimeLeft(serverTimeLeft);
    }, []);

    const handleRetroError = useCallback((errorData: any) => {
        const errorMessage = typeof errorData === 'object' && errorData?.message || 'An unknown retro error occurred';
        debugLog('Retro Namespace Error:', errorMessage);
        if (errorMessage.toLowerCase().includes('password') || errorMessage.toLowerCase().includes('join')) {
            setIsJoining(false);
            joinParamsRef.current = null;
            setHasJoined(false);
            if (onJoinError) onJoinError(errorMessage);
            else toast({ title: 'Join Error', description: errorMessage, status: 'error', duration: 3000 });
        } else {
             toast({ title: 'Retro Board Error', description: errorMessage, status: 'error', duration: 3000 });
        }
    }, [onJoinError, toast]);

    // --- Effect for Initial Board Data Fetch ---
    useEffect(() => {
        if (!boardId) {
            setBoard(null);
            setInitialBoardDataLoaded(false);
            setHasJoined(false);
            setIsJoining(false);
            joinParamsRef.current = null;
            if (socketRef.current?.connected) {
                debugLog('boardId is null, disconnecting socket');
                socketRef.current.disconnect();
            }
            return;
        }

        let isActive = true;
        setInitialBoardDataLoaded(false);
        setHasJoined(false);
        setIsJoining(false);
        joinParamsRef.current = null;

        const fetchInitialData = async () => {
            debugLog('Fetching initial board data', { boardId });
            try {
                const initialBoardData = await apiRequest<RetroBoard>(`/retro/${boardId}`, { includeAuth: false });
                if (!isActive) return;

                debugLog('Initial board data loaded', initialBoardData);
                setBoard(initialBoardData);
                setIsTimerRunning(initialBoardData.timer_running);
                setTimeLeft(initialBoardData.time_left);
                setHideCards(initialBoardData.hide_cards_by_default);
                setInitialBoardDataLoaded(true);

                // Prepare for auto-join *after* fetching data
                // Use auth state directly here
                const currentIsAuthenticated = isAuthenticated;
                const currentUserName = user?.name;
                if (currentIsAuthenticated && currentUserName && initialBoardData && !initialBoardData.hasPassword) {
                    debugLog('Preparing for auto-join', { userName: currentUserName });
                    joinParamsRef.current = { name: currentUserName };
                }

                // Connect the socket now using socketRef
                const currentSocket = socketRef.current;
                if (currentSocket && !currentSocket.connected) {
                    debugLog('Connecting socket after initial data load...');
                    currentSocket.connect();
                } else if (currentSocket?.connected) {
                     debugLog('Socket already connected, connect handler will process pending join if any.');
                     // REMOVED manual call to handleManagerConnectInternal()
                } else {
                    // If no socket instance yet, useSocketManager will handle connection attempt
                    debugLog('Socket instance not yet available from manager. Connection will be attempted.');
                }

            } catch (error) {
                if (!isActive) return;
                debugLog('Error fetching initial board data', error);
                const description = error instanceof AuthError
                    ? 'Authentication error loading board.'
                    : error instanceof Error ? error.message : 'Failed to load board';
                toast({ title: 'Initialization Error', description, status: 'error', duration: 3000, isClosable: true });
                setInitialBoardDataLoaded(true); // Mark as loaded even on error
                setBoard(null);
            }
        };

        fetchInitialData();

        return () => {
            isActive = false;
        };
    // Dependencies: Only boardId. Auth state and toast are accessed directly inside.
    }, [boardId]); // Removed isAuthenticated, user?.name, toast

    // --- Effect for Retro-Specific Event Listeners ---
    useEffect(() => {
        const currentSocket = socketRef.current;
        if (!currentSocket || !initialBoardDataLoaded) {
             if (!currentSocket) {
                 setHasJoined(false);
                 setIsJoining(false);
             }
            return;
        }

        debugLog('Attaching retro event listeners');
        currentSocket.on('retroBoardJoined', handleRetroBoardJoined);
        currentSocket.on('retroBoardUpdated', handleRetroBoardUpdated);
        currentSocket.on('cardsVisibilityChanged', handleCardsVisibilityChanged);
        currentSocket.on('timerStarted', handleTimerStarted);
        currentSocket.on('timerStopped', handleTimerStopped);
        currentSocket.on('timerUpdate', handleTimerUpdate);
        currentSocket.on('error', handleRetroError);

        return () => {
            debugLog('Detaching retro event listeners');
            currentSocket.off('retroBoardJoined', handleRetroBoardJoined);
            currentSocket.off('retroBoardUpdated', handleRetroBoardUpdated);
            currentSocket.off('cardsVisibilityChanged', handleCardsVisibilityChanged);
            currentSocket.off('timerStarted', handleTimerStarted);
            currentSocket.off('timerStopped', handleTimerStopped);
            currentSocket.off('timerUpdate', handleTimerUpdate);
            currentSocket.off('error', handleRetroError);
        };
    }, [
        initialBoardDataLoaded,
        handleRetroBoardJoined,
        handleRetroBoardUpdated,
        handleCardsVisibilityChanged,
        handleTimerStarted,
        handleTimerStopped,
        handleTimerUpdate,
        handleRetroError
    ]);

    // Effect to manage the client-side timer interval (Unchanged)
    useEffect(() => {
        if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = null;
        }
        if (isTimerRunning && timeLeft > 0) {
            timerIntervalRef.current = setInterval(() => {
                setTimeLeft((prevTime) => {
                    const newTime = prevTime - 1;
                    if (newTime <= 0) {
                        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
                        timerIntervalRef.current = null;
                        return 0;
                    }
                    return newTime;
                });
            }, 1000);
        }
        return () => {
            if (timerIntervalRef.current) {
                clearInterval(timerIntervalRef.current);
                timerIntervalRef.current = null;
            }
        };
    }, [isTimerRunning, timeLeft]);


    // --- Public Actions ---
    const joinBoard = useCallback((name: string, password?: string) => {
        if (!boardId || hasJoined || isJoining) {
            debugLog('Join attempt ignored', { boardId, hasJoined, isJoining });
            return;
        }
         debugLog('Manual joinBoard requested', { name });
         joinParamsRef.current = { name, password };
         const currentSocket = socketRef.current;

         if (currentSocket && isConnected) {
             emitJoinBoard(currentSocket, name, password);
         } else if (currentSocket && !isConnected) {
              debugLog('Socket exists but not connected, attempting connect...');
             setIsJoining(true);
             currentSocket.connect();
        } else {
             debugLog('No socket instance, connection should be in progress or initiated by fetch effect.');
             setIsJoining(true);
        }
    }, [boardId, hasJoined, isJoining, isConnected, emitJoinBoard]);

    const changeName = useCallback((newName: string) => {
        if (!socketRef.current || !boardId || !hasJoined) return;
        debugLog('Changing name', { newName });
        socketRef.current.emit('changeRetroName', { boardId, newName });
    }, [boardId, hasJoined]);

    const addCard = useCallback((cardId: string, columnId: string, text: string, authorName: string) => {
        if (!socketRef.current || !boardId || !hasJoined) return;
        debugLog('Adding card', { cardId, columnId, text, authorName });
        socketRef.current.emit('addRetroCard', { boardId, cardId, columnId, text, authorName });
    }, [boardId, hasJoined]);

    const editCard = useCallback((cardId: string, text: string) => {
        if (!socketRef.current || !boardId || !hasJoined) return;
        debugLog('Editing card', { cardId, text });
        socketRef.current.emit('editRetroCard', { boardId, cardId, text });
    }, [boardId, hasJoined]);

    const deleteCard = useCallback((cardId: string) => {
        if (!socketRef.current || !boardId || !hasJoined) return;
        debugLog('Deleting card', { cardId });
        socketRef.current.emit('deleteRetroCard', { boardId, cardId });
    }, [boardId, hasJoined]);

    const toggleVote = useCallback((cardId: string) => {
        if (!socketRef.current || !boardId || !hasJoined) return;
        debugLog('Toggling vote', { cardId });
        socketRef.current.emit('toggleVote', { boardId, cardId });
    }, [boardId, hasJoined]);

    const toggleTimer = useCallback(() => {
        if (!socketRef.current || !boardId || !hasJoined) return;
        debugLog('Toggling timer', { isTimerRunning });
        if (isTimerRunning) {
            socketRef.current.emit('stopTimer', { boardId });
        } else {
            socketRef.current.emit('startTimer', { boardId });
        }
    }, [boardId, hasJoined, isTimerRunning]);

    const updateSettings = useCallback((settings: {
        defaultTimer?: number;
        hideCardsByDefault?: boolean;
        hideAuthorNames?: boolean;
        password?: string;
    }) => {
        if (!socketRef.current || !boardId || !hasJoined) return;
        debugLog('Updating settings', settings);
        socketRef.current.emit('updateSettings', { boardId, settings });
    }, [boardId, hasJoined]);

    const setHideCardsRequest = useCallback((hide: boolean) => {
        if (!socketRef.current || !boardId || !hasJoined) return;
        debugLog('Requesting hide cards', { hide });
        socketRef.current.emit('toggleCardsVisibility', { boardId, hideCards: hide });
    }, [boardId, hasJoined]);

    // Combined loading state includes connection, joining, and initial data load
    const combinedLoadingState = isConnecting || isJoining || !initialBoardDataLoaded;

    return {
        // socket: socketRef.current, // Expose socket instance via ref if needed
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
