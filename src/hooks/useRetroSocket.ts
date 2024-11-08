import { useState, useEffect, useRef, useCallback } from 'react'
import { Manager } from 'socket.io-client'
import type { Socket as ClientSocket } from 'socket.io-client'
import { useToast } from '@chakra-ui/react'
import config from '../config'

interface RetroCard {
    id: string
    text: string
    column_id: string
    author_name: string
    created_at: string
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

interface JoinParams {
    name: string
    password?: string
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
    deleteCard: (cardId: string) => void
    toggleTimer: () => void
    updateSettings: (settings: {
        defaultTimer: number
        hideCardsByDefault: boolean
        hideAuthorNames: boolean
        password?: string
    }) => void
}

export const useRetroSocket = ({ boardId, onBoardJoined }: UseRetroSocketProps): UseRetroSocketResult => {
    const [socket, setSocket] = useState<ClientSocket | null>(null)
    const [board, setBoard] = useState<RetroBoard | null>(null)
    const [isTimerRunning, setIsTimerRunning] = useState(false)
    const [timeLeft, setTimeLeft] = useState(300)
    const [hideCards, setHideCards] = useState(false)
    const [hasJoined, setHasJoined] = useState(false)
    const joinParamsRef = useRef<JoinParams | null>(null)
    const socketRef = useRef<ClientSocket | null>(null)
    const boardLoadedRef = useRef(false)
    const toast = useToast()

    const setupSocket = useCallback(() => {
        if (socketRef.current) {
            console.log('Socket already exists')
            return
        }

        console.log('Setting up socket connection')
        const manager = new Manager(config.socketUrl, {
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            timeout: 20000,
            transports: ['websocket', 'polling']
        })

        const newSocket = manager.socket('/')

        newSocket.on('connect', () => {
            console.log('Socket connected')
            if (boardId && joinParamsRef.current) {
                const { name, password } = joinParamsRef.current
                console.log('Emitting joinRetroBoard:', { boardId, name })
                newSocket.emit('joinRetroBoard', { boardId, name, password })
            }
        })

        newSocket.on('retroBoardJoined', (data: RetroBoard) => {
            console.log('Joined retro board:', data)
            setBoard(data)
            setIsTimerRunning(data.timer_running)
            setTimeLeft(data.time_left)
            setHideCards(data.hide_cards_by_default)
            setHasJoined(true)
            onBoardJoined()
        })

        newSocket.on('retroBoardUpdated', (data: RetroBoard) => {
            console.log('Board updated:', data)
            setBoard(data)
            setHideCards(data.hide_cards_by_default)
        })

        newSocket.on('timerStarted', ({ timeLeft: serverTimeLeft }) => {
            console.log('Timer started:', serverTimeLeft)
            setIsTimerRunning(true)
            setTimeLeft(serverTimeLeft)
        })

        newSocket.on('timerStopped', () => {
            console.log('Timer stopped')
            setIsTimerRunning(false)
        })

        newSocket.on('timerUpdate', ({ timeLeft: serverTimeLeft }) => {
            console.log('Timer update:', serverTimeLeft)
            setTimeLeft(serverTimeLeft)
        })

        newSocket.on('error', (data: { message: string }) => {
            console.error('Socket error:', data)
            toast({
                title: 'Error',
                description: data.message,
                status: 'error',
                duration: 2000,
            })
        })

        socketRef.current = newSocket
        setSocket(newSocket)

        return () => {
            console.log('Cleaning up socket')
            newSocket.disconnect()
            socketRef.current = null
        }
    }, [boardId, onBoardJoined])

    // Load initial board data
    useEffect(() => {
        if (!boardId || boardLoadedRef.current) return

        console.log('Fetching board data:', boardId)
        boardLoadedRef.current = true

        fetch(`${config.apiUrl}/retro/${boardId}`)
            .then(res => {
                if (!res.ok) throw new Error('Board not found')
                return res.json()
            })
            .then(data => {
                console.log('Board data loaded:', data)
                setBoard(data)
                setIsTimerRunning(data.timer_running)
                setTimeLeft(data.time_left)
                setHideCards(data.hide_cards_by_default)
            })
            .catch((error) => {
                console.error('Error fetching board:', error)
                toast({
                    title: 'Error',
                    description: 'Board not found',
                    status: 'error',
                    duration: 2000,
                })
            })
    }, [boardId])

    const joinBoard = useCallback((name: string, password?: string) => {
        if (!boardId) return

        console.log('Joining board:', { name })
        joinParamsRef.current = { name, password }

        if (!socketRef.current) {
            setupSocket()
        } else {
            console.log('Emitting joinRetroBoard:', { boardId, name })
            socketRef.current.emit('joinRetroBoard', { boardId, name, password })
        }
    }, [boardId, setupSocket])

    const changeName = useCallback((newName: string) => {
        if (!socketRef.current || !boardId) return
        console.log('Changing name:', newName)
        socketRef.current.emit('changeRetroName', { boardId, newName })
    }, [boardId])

    const addCard = useCallback((cardId: string, columnId: string, text: string, authorName: string) => {
        if (!socketRef.current || !boardId) return
        console.log('Adding card:', { cardId, columnId, text, authorName })
        socketRef.current.emit('addRetroCard', {
            boardId,
            cardId,
            columnId,
            text,
            authorName
        })
    }, [boardId])

    const deleteCard = useCallback((cardId: string) => {
        if (!socketRef.current || !boardId) return
        console.log('Deleting card:', cardId)
        socketRef.current.emit('deleteRetroCard', { boardId, cardId })
    }, [boardId])

    const toggleTimer = useCallback(() => {
        if (!socketRef.current || !boardId) return
        console.log('Toggling timer:', { isTimerRunning })
        if (isTimerRunning) {
            socketRef.current.emit('stopTimer', { boardId })
        } else {
            socketRef.current.emit('startTimer', { boardId })
        }
    }, [boardId, isTimerRunning])

    const updateSettings = useCallback((settings: {
        defaultTimer: number
        hideCardsByDefault: boolean
        hideAuthorNames: boolean
        password?: string
    }) => {
        if (!socketRef.current || !boardId) return
        console.log('Updating settings:', settings)
        socketRef.current.emit('updateSettings', { boardId, settings })
    }, [boardId])

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (socketRef.current) {
                console.log('Disconnecting socket')
                socketRef.current.disconnect()
                socketRef.current = null
            }
        }
    }, [])

    return {
        socket,
        board,
        isTimerRunning,
        timeLeft,
        hideCards,
        setHideCards,
        hasJoined,
        joinBoard,
        changeName,
        addCard,
        deleteCard,
        toggleTimer,
        updateSettings
    }
}

export type { RetroBoard, RetroCard }
