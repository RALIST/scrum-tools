import { useState, useEffect, useRef, useCallback } from 'react';
import { Manager } from 'socket.io-client';
import type { Socket as ClientSocket } from 'socket.io-client';
import { useToast } from '@chakra-ui/react';
import config from '../config';
import { apiRequest, AuthError } from '../utils/apiUtils'; // Import apiRequest and AuthError
import { useAuth } from '../contexts/AuthContext'; // Import useAuth

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
    boardId: string
    onBoardJoined: () => void
}

interface UseRetroSocketResult {
    socket: ClientSocket | null
    board: RetroBoard | null
    isTimerRunning: boolean
    timeLeft: number
    hideCards: boolean
    setHideCards: (hide: boolean) => void
    hasJoined: boolean
    joinBoard: (name: string, password?: string) => void
    changeName: (newName: string) => void
    addCard: (cardId: string, columnId: string, text: string, authorName: string) => void
    editCard: (cardId: string, text: string) => void
    deleteCard: (cardId: string) => void
    toggleVote: (cardId: string) => void
    toggleTimer: () => void
    updateSettings: (settings: {
        defaultTimer: number
        hideCardsByDefault: boolean
        hideAuthorNames: boolean
        password?: string
    }) => void
}

const debugLog = (message: string, data?: any) => {
    console.log(`[useRetroSocket] ${message}`, data || '')
}

export const useRetroSocket = ({ boardId, onBoardJoined }: UseRetroSocketProps): UseRetroSocketResult => {
    const [socket, setSocket] = useState<ClientSocket | null>(null)
    const [board, setBoard] = useState<RetroBoard | null>(null)
    const [isTimerRunning, setIsTimerRunning] = useState(false)
    const [timeLeft, setTimeLeft] = useState(300)
    const [hideCards, setHideCards] = useState(false)
    const [hasJoined, setHasJoined] = useState(false)
    const socketRef = useRef<ClientSocket | null>(null)
    const joinParamsRef = useRef<{ name: string; password?: string } | null>(null)
    const initRef = useRef(false);
    const toast = useToast();
    const timerIntervalRef = useRef<NodeJS.Timeout | null>(null); // Ref to store interval ID
    const { user, isAuthenticated } = useAuth(); // Get auth state

    useEffect(() => {
        if (!boardId || initRef.current) return

        let isActive = true
        initRef.current = true

        const initializeBoard = async () => {
            try {
                debugLog('Fetching board data', { boardId });
                // Use apiRequest instead of fetch
                const data = await apiRequest<RetroBoard>(`/retro/${boardId}`, { includeAuth: false }); 

                if (!isActive) return;

                debugLog('Board data loaded', data);
                setBoard(data);
                setIsTimerRunning(data.timer_running);
                setTimeLeft(data.time_left);
                setHideCards(data.hide_cards_by_default);

                // --- Auto-join logic ---
                // Check if user is authenticated, has a name, board exists, and board doesn't require a password
                if (isAuthenticated && user?.name && data && !data.hasPassword) {
                    debugLog('User authenticated, attempting auto-join', { userName: user.name });
                    // Store join params immediately for potential reconnects
                    joinParamsRef.current = { name: user.name };
                    // No need to wait for socket connection here, it will auto-join on 'connect' event
                } else {
                    debugLog('Auto-join conditions not met or board requires password');
                }
                // --- End Auto-join logic ---


                debugLog('Setting up socket connection');
                
                const manager = new Manager(config.socketUrl, {
                    reconnection: true,
                    reconnectionAttempts: 5,
                    reconnectionDelay: 1000,
                    reconnectionDelayMax: 5000,
                    timeout: 20000,
                    transports: ['websocket', 'polling']
                })

                const newSocket = manager.socket('/retro')

                newSocket.on('connect', () => {
                    if (!isActive) return
                    debugLog('Socket connected')
                    if (joinParamsRef.current) {
                        const { name, password } = joinParamsRef.current
                        debugLog('Auto-joining with params', { name })
                        newSocket.emit('joinRetroBoard', { boardId, name, password })
                    }
                })

                newSocket.on('retroBoardJoined', (data: RetroBoard) => {
                    if (!isActive) return
                    debugLog('Joined retro board', data)
                    setBoard(data)
                    setIsTimerRunning(data.timer_running)
                    setTimeLeft(data.time_left)
                    setHideCards(data.hide_cards_by_default)
                    setHasJoined(true)
                    onBoardJoined()
                })

                newSocket.on('retroBoardUpdated', (data: RetroBoard) => {
                    if (!isActive) return
                    debugLog('Board updated', data)
                    setBoard(data)
                })

                newSocket.on('cardsVisibilityChanged', ({ hideCards: newHideCards }) => {
                    if (!isActive) return
                    debugLog('Cards visibility changed', { newHideCards })
                    setHideCards(newHideCards)
                })

                newSocket.on('timerStarted', ({ timeLeft: serverTimeLeft }) => {
                    if (!isActive) return
                    debugLog('Timer started', { serverTimeLeft })
                    setIsTimerRunning(true)
                    setTimeLeft(serverTimeLeft)
                })

                newSocket.on('timerStopped', () => {
                    if (!isActive) return
                    debugLog('Timer stopped')
                    setIsTimerRunning(false)
                })

                newSocket.on('timerUpdate', ({ timeLeft: serverTimeLeft }) => {
                    if (!isActive) return
                    debugLog('Timer update', { serverTimeLeft })
                    setTimeLeft(serverTimeLeft)
                })

                newSocket.on('error', (data: { message: string }) => {
                    if (!isActive) return
                    debugLog('Socket error', data);
                    // Clear join params on join-related errors
                    if (data.message.toLowerCase().includes('password') || data.message.toLowerCase().includes('join')) {
                        joinParamsRef.current = null;
                    }
                    toast({
                        title: 'Error',
                        description: data.message, // Keep original message
                        status: 'error',
                        duration: 2000,
                    })
                })

                socketRef.current = newSocket
                setSocket(newSocket)
            } catch (error) {
                if (!isActive) return
                debugLog('Error initializing board', error);
                // Handle AuthError specifically if needed, though this endpoint is public
                const description = error instanceof AuthError 
                    ? 'Authentication error loading board.' 
                    : error instanceof Error ? error.message : 'Failed to load board';
                toast({
                    title: 'Error',
                    description: description,
                    status: 'error',
                    duration: 2000,
                })
            }
        }

        initializeBoard()

        return () => {
            isActive = false
            if (socketRef.current) {
                debugLog('Cleaning up socket')
                socketRef.current.disconnect()
                socketRef.current = null
            }
            // Clear interval on cleanup
            if (timerIntervalRef.current) {
                clearInterval(timerIntervalRef.current);
                timerIntervalRef.current = null;
            }
            initRef.current = false;
            joinParamsRef.current = null; // Clear join params on full cleanup
            setHasJoined(false);
        }
    // Add toast dependency. Keep user/isAuthenticated out for stability.
    }, [boardId, onBoardJoined, toast]);

    // Effect to manage the client-side timer interval
    useEffect(() => {
        // Clear previous interval if any
        if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = null;
        }

        // Start interval only if timer is running and time is left
        if (isTimerRunning && timeLeft > 0) {
            timerIntervalRef.current = setInterval(() => {
                setTimeLeft((prevTime) => {
                    if (prevTime <= 1) {
                        // Timer finished, clear interval
                        if (timerIntervalRef.current) {
                            clearInterval(timerIntervalRef.current);
                            timerIntervalRef.current = null;
                        }
                        setIsTimerRunning(false); // Optionally update local running state
                        return 0;
                    }
                    return prevTime - 1; // Decrement time
                });
            }, 1000); // Run every second
        }

        // Cleanup function to clear interval when timer stops or component unmounts
        return () => {
            if (timerIntervalRef.current) {
                clearInterval(timerIntervalRef.current);
                timerIntervalRef.current = null;
            }
        };
    }, [isTimerRunning, timeLeft]); // Rerun effect when isTimerRunning or timeLeft changes (timeLeft change needed to stop at 0)


    const joinBoard = useCallback((name: string, password?: string) => {
        if (!boardId || hasJoined) return

        debugLog('Joining board', { name })
        joinParamsRef.current = { name, password }
        if (socketRef.current?.connected) {
            debugLog('Emitting joinRetroBoard', { boardId, name })
            socketRef.current.emit('joinRetroBoard', { boardId, name, password })
        }
    }, [boardId, hasJoined])

    const changeName = useCallback((newName: string) => {
        if (!socketRef.current || !boardId) return
        debugLog('Changing name', { newName })
        socketRef.current.emit('changeRetroName', { boardId, newName })
    }, [boardId])

    const addCard = useCallback((cardId: string, columnId: string, text: string, authorName: string) => {
        if (!socketRef.current || !boardId) return
        debugLog('Adding card', { cardId, columnId, text, authorName })
        socketRef.current.emit('addRetroCard', {
            boardId,
            cardId,
            columnId,
            text,
            authorName
        })
    }, [boardId])

    const editCard = useCallback((cardId: string, text: string) => {
        if (!socketRef.current || !boardId) return
        debugLog('Editing card', { cardId, text })
        socketRef.current.emit('editRetroCard', { boardId, cardId, text })
    }, [boardId])

    const deleteCard = useCallback((cardId: string) => {
        if (!socketRef.current || !boardId) return
        debugLog('Deleting card', { cardId })
        socketRef.current.emit('deleteRetroCard', { boardId, cardId })
    }, [boardId])

    const toggleVote = useCallback((cardId: string) => {
        if (!socketRef.current || !boardId) return
        debugLog('Toggling vote', { cardId })
        socketRef.current.emit('toggleVote', { boardId, cardId })
    }, [boardId])

    const toggleTimer = useCallback(() => {
        if (!socketRef.current || !boardId) return
        debugLog('Toggling timer', { isTimerRunning })
        if (isTimerRunning) {
            socketRef.current.emit('stopTimer', { boardId })
        } else {
            socketRef.current.emit('startTimer', { boardId })
        }
    }, [boardId, isTimerRunning]);

    const updateSettings = useCallback((settings: {
        defaultTimer: number;
        hideCardsByDefault: boolean
        hideAuthorNames: boolean
        password?: string;
    }) => {
        if (!socketRef.current || !boardId) return;
        debugLog('Updating settings', settings);
        socketRef.current.emit('updateSettings', { boardId, settings });
    }, [boardId]);

    // Renamed to requestHideCards - only sends the event
    const requestHideCards = useCallback((hide: boolean) => {
        if (!socketRef.current || !boardId) return;
        debugLog('Requesting hide cards', { hide });
        // Only emit the event, state will be updated by server response
        socketRef.current.emit('toggleCardsVisibility', { boardId, hideCards: hide });
    }, [boardId]);

    // The actual state update happens in the 'cardsVisibilityChanged' event handler useEffect

    return {
        socket,
        board,
        isTimerRunning,
        timeLeft,
        hideCards, // State is still managed here
        setHideCards: requestHideCards, // Expose the request function
        hasJoined,
        joinBoard,
        changeName,
        addCard,
        editCard,
        deleteCard,
        toggleVote,
        toggleTimer,
        updateSettings
    }
}

export type { RetroBoard, RetroCard }
