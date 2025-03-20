import { useState, useEffect, useRef, useCallback } from 'react'
import { Manager } from 'socket.io-client'
import type { Socket as ClientSocket } from 'socket.io-client'
import { useToast } from '@chakra-ui/react'
import config from '../config'
import { SequenceType } from '../constants/poker'
import { getAuthToken } from '../utils/apiUtils'

interface Participant {
    id: string
    name: string
    vote: string | null
}

interface RoomSettings {
    sequence: SequenceType
    hasPassword: boolean
}

interface UsePokerSocketProps {
    roomId: string
    onRoomJoined: () => void
}

interface UsePokerSocketResult {
    socket: ClientSocket | null
    participants: Participant[]
    settings: RoomSettings
    isRevealed: boolean
    isJoined: boolean
    joinRoom: (userName: string, password?: string) => void
    changeName: (newName: string) => void
    vote: (value: string) => void
    revealVotes: () => void
    resetVotes: () => void
    updateSettings: (settings: {
        sequence?: SequenceType
        password?: string
    }) => void
}

export const usePokerSocket = ({ roomId, onRoomJoined }: UsePokerSocketProps): UsePokerSocketResult => {
    const [socket, setSocket] = useState<ClientSocket | null>(null)
    const [participants, setParticipants] = useState<Participant[]>([])
    const [settings, setSettings] = useState<RoomSettings>({
        sequence: 'fibonacci',
        hasPassword: false
    })
    const [isRevealed, setIsRevealed] = useState(false)
    const [isJoined, setIsJoined] = useState(false)
    const socketRef = useRef<ClientSocket | null>(null)
    const joinParamsRef = useRef<{ userName: string; password?: string } | null>(null)
    const toast = useToast()

    // Single socket setup and cleanup
    useEffect(() => {
        if (!roomId) return

        console.log('Setting up socket connection')
        // Get auth token if available
        const token = getAuthToken();
        
        const manager = new Manager(config.socketUrl, {
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            timeout: 20000,
            transports: ['websocket', 'polling'],
            auth: token ? { token } : undefined
        })

        const newSocket = manager.socket('/poker')

        newSocket.on('connect', () => {
            console.log('Connected to poker server')
            if (joinParamsRef.current) {
                const { userName, password } = joinParamsRef.current
                console.log('Auto-joining with params:', { userName })
                newSocket.emit('joinRoom', { roomId, userName, password })
            }
        })

        newSocket.on('roomJoined', (data: { participants: Participant[], settings: RoomSettings }) => {
            console.log('Joined room:', data)
            setParticipants(data.participants)
            setSettings(data.settings)
            setIsJoined(true)
            onRoomJoined()
        })

        newSocket.on('participantUpdate', (data: { participants: Participant[] }) => {
            console.log('Participants updated:', data)
            setParticipants(data.participants)
        })

        newSocket.on('settingsUpdated', (data: { settings: RoomSettings }) => {
            console.log('Settings updated:', data)
            setSettings(data.settings)
        })

        newSocket.on('votesRevealed', () => {
            console.log('Votes revealed')
            setIsRevealed(true)
        })

        newSocket.on('votesReset', () => {
            console.log('Votes reset')
            setIsRevealed(false)
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
            joinParamsRef.current = null
            setIsJoined(false)
        }
    }, [roomId, onRoomJoined])

    const joinRoom = useCallback((userName: string, password?: string) => {
        if (!roomId || isJoined) return

        console.log('Joining room:', { userName })
        joinParamsRef.current = { userName, password }

        if (socketRef.current?.connected) {
            console.log('Emitting joinRoom:', { roomId, userName })
            socketRef.current.emit('joinRoom', { roomId, userName, password })
        }
    }, [roomId, isJoined])

    const changeName = useCallback((newName: string) => {
        if (!socketRef.current || !roomId) return
        console.log('Changing name:', newName)
        socketRef.current.emit('changeName', { roomId, newName })
    }, [roomId])

    const vote = useCallback((value: string) => {
        if (!socketRef.current || !roomId) return
        console.log('Voting:', value)
        socketRef.current.emit('vote', { roomId, vote: value })
    }, [roomId])

    const revealVotes = useCallback(() => {
        if (!socketRef.current || !roomId) return
        console.log('Revealing votes')
        socketRef.current.emit('revealVotes', { roomId })
    }, [roomId])

    const resetVotes = useCallback(() => {
        if (!socketRef.current || !roomId) return
        console.log('Resetting votes')
        socketRef.current.emit('resetVotes', { roomId })
    }, [roomId])

    const updateSettings = useCallback((newSettings: {
        sequence?: SequenceType
        password?: string
    }) => {
        if (!socketRef.current || !roomId) return
        console.log('Updating settings:', newSettings)
        socketRef.current.emit('updateSettings', { roomId, settings: newSettings })
    }, [roomId])

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
        updateSettings
    }
}

export type { Participant, RoomSettings }
