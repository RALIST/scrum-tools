import { FC, useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Manager } from 'socket.io-client'
import type { Socket as ClientSocket } from 'socket.io-client'
import {
    Box,
    Heading,
    SimpleGrid,
    VStack,
    Text,
    Button,
    useColorMode,
    Input,
    IconButton,
    Card,
    CardBody,
    HStack,
    useToast,
    Badge,
    useDisclosure
} from '@chakra-ui/react'
import { AddIcon, DeleteIcon, ViewIcon, ViewOffIcon, TimeIcon, SettingsIcon } from '@chakra-ui/icons'
import PageContainer from '../components/PageContainer'
import { Helmet } from 'react-helmet-async'
import config from '../config'
import { RetroBoardSettingsModal } from '../components/modals'

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

const COLUMNS = [
    { id: 'good', title: 'What Went Well', color: 'green.500' },
    { id: 'improve', title: 'What Could Be Improved', color: 'orange.500' },
    { id: 'actions', title: 'Action Items', color: 'blue.500' }
]

const RetroBoard: FC = () => {
    const { colorMode } = useColorMode()
    const { boardId } = useParams<{ boardId: string }>()
    const navigate = useNavigate()
    const toast = useToast()
    const [socket, setSocket] = useState<ClientSocket | null>(null)
    const [board, setBoard] = useState<RetroBoard | null>(null)
    const [newCardText, setNewCardText] = useState<{ [key: string]: string }>({})
    const [hideCards, setHideCards] = useState(false)
    const [timeLeft, setTimeLeft] = useState(300)
    const [isTimerRunning, setIsTimerRunning] = useState(false)
    const [userName, setUserName] = useState<string>('')
    const { isOpen: isSettingsOpen, onOpen: onSettingsOpen, onClose: onSettingsClose } = useDisclosure()

    useEffect(() => {
        const savedUsername = localStorage.getItem('retroUserName')
        if (savedUsername) {
            setUserName(savedUsername)
        }
    }, [])

    useEffect(() => {
        if (!boardId) {
            navigate('/retro')
            return
        }

        // First, try to get the board data
        fetch(`${config.apiUrl}/retro/${boardId}`)
            .then(res => {
                if (!res.ok) throw new Error('Board not found')
                return res.json()
            })
            .then(data => {
                setBoard(data)
                setIsTimerRunning(data.timer_running)
                setTimeLeft(data.time_left)
                setHideCards(data.hide_cards_by_default)
            })
            .catch(() => {
                toast({
                    title: 'Error',
                    description: 'Board not found',
                    status: 'error',
                    duration: 2000,
                })
                navigate('/retro')
            })

        // Set up socket connection
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
            console.log('Connected to server')
            newSocket.emit('joinRetroBoard', { boardId })
        })

        newSocket.on('retroBoardJoined', (data: RetroBoard) => {
            console.log('Joined retro board:', data)
            setBoard(data)
            setIsTimerRunning(data.timer_running)
            setTimeLeft(data.time_left)
            setHideCards(data.hide_cards_by_default)
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

        setSocket(newSocket)

        return () => {
            newSocket.disconnect()
        }
    }, [boardId])

    const handleAddCard = (columnId: string) => {
        if (!newCardText[columnId]?.trim() || !socket || !boardId || !isTimerRunning || !userName) {
            if (!userName) {
                toast({
                    title: 'Error',
                    description: 'Please enter your name first',
                    status: 'error',
                    duration: 2000,
                })
            }
            return
        }

        const cardId = Math.random().toString(36).substring(7)
        console.log('Adding card:', { boardId, cardId, columnId, text: newCardText[columnId], authorName: userName })
        socket.emit('addRetroCard', {
            boardId,
            cardId,
            columnId,
            text: newCardText[columnId],
            authorName: userName
        })

        setNewCardText({ ...newCardText, [columnId]: '' })
    }

    const handleDeleteCard = (cardId: string) => {
        if (!socket || !boardId) return
        console.log('Deleting card:', { boardId, cardId })
        socket.emit('deleteRetroCard', { boardId, cardId })
    }

    const handleToggleCards = () => {
        setHideCards(!hideCards)
        toast({
            title: hideCards ? 'Cards Revealed' : 'Cards Hidden',
            status: 'info',
            duration: 2000,
        })
    }

    const handleToggleTimer = () => {
        if (!socket || !boardId) return

        console.log('Toggling timer:', { boardId, currentState: isTimerRunning })
        if (isTimerRunning) {
            socket.emit('stopTimer', { boardId })
        } else {
            socket.emit('startTimer', { boardId })
        }
    }

    const handleUpdateSettings = (settings: {
        defaultTimer: number
        hideCardsByDefault: boolean
        hideAuthorNames: boolean
        password?: string
    }) => {
        if (!socket || !boardId) return
        socket.emit('updateSettings', { boardId, settings })
    }

    const formatTime = (seconds: number) => {
        const minutes = Math.floor(seconds / 60)
        const remainingSeconds = seconds % 60
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
    }

    return (
        <PageContainer>
            <Helmet>
                <title>Retro Board</title>
                <meta name="robots" content="noindex, nofollow" />
            </Helmet>
            <Box bg={colorMode === 'light' ? 'gray.50' : 'gray.900'} minH="calc(100vh - 60px)" p={4}>
                <VStack spacing={8} align="stretch">
                    <Box textAlign="center">
                        <HStack justify="center" spacing={4}>
                            <Heading as="h1" size="xl">
                                Retro Board
                            </Heading>
                            <IconButton
                                aria-label={hideCards ? "Show Cards" : "Hide Cards"}
                                icon={hideCards ? <ViewIcon /> : <ViewOffIcon />}
                                onClick={handleToggleCards}
                                colorScheme="purple"
                                size="sm"
                            />
                            <Button
                                leftIcon={<TimeIcon />}
                                onClick={handleToggleTimer}
                                colorScheme={isTimerRunning ? "red" : "green"}
                                size="sm"
                            >
                                {isTimerRunning ? "Stop Timer" : "Start Timer"}
                            </Button>
                            <Badge
                                colorScheme={isTimerRunning ? "green" : "gray"}
                                fontSize="xl"
                                px={3}
                                py={1}
                                borderRadius="md"
                            >
                                {formatTime(timeLeft)}
                            </Badge>
                            <IconButton
                                aria-label="Board Settings"
                                icon={<SettingsIcon />}
                                onClick={onSettingsOpen}
                                size="sm"
                            />
                        </HStack>
                        <Text fontSize="lg" color={colorMode === 'light' ? 'gray.600' : 'gray.300'} mt={2}>
                            Share your thoughts about the sprint
                        </Text>
                        {!isTimerRunning && timeLeft < (board?.default_timer ?? 300) && (
                            <Text color="red.500" mt={2}>
                                Timer is paused. Cards cannot be added.
                            </Text>
                        )}
                        <Input
                            placeholder="Enter your name"
                            value={userName}
                            onChange={(e) => {
                                setUserName(e.target.value)
                                localStorage.setItem('retroUserName', e.target.value)
                            }}
                            maxW="300px"
                            mt={2}
                        />
                    </Box>

                    <SimpleGrid columns={{ base: 1, md: 3 }} spacing={8}>
                        {COLUMNS.map(column => (
                            <VStack
                                key={column.id}
                                bg={colorMode === 'light' ? 'white' : 'gray.700'}
                                p={4}
                                borderRadius="lg"
                                shadow="md"
                                spacing={4}
                                align="stretch"
                            >
                                <Heading
                                    size="md"
                                    color={column.color}
                                    textAlign="center"
                                >
                                    {column.title}
                                </Heading>

                                <VStack spacing={4} align="stretch">
                                    {board?.cards
                                        .filter(card => card.column_id === column.id)
                                        .map(card => (
                                            <Card key={card.id} variant="outline">
                                                <CardBody>
                                                    <VStack align="stretch" spacing={2}>
                                                        <HStack justify="space-between">
                                                            <Text>{hideCards ? '[ Hidden ]' : card.text}</Text>
                                                            <IconButton
                                                                aria-label="Delete card"
                                                                icon={<DeleteIcon />}
                                                                size="sm"
                                                                variant="ghost"
                                                                colorScheme="red"
                                                                onClick={() => handleDeleteCard(card.id)}
                                                            />
                                                        </HStack>
                                                        {!board.hide_author_names && (
                                                            <Text fontSize="sm" color="gray.500">
                                                                Added by: {card.author_name}
                                                            </Text>
                                                        )}
                                                    </VStack>
                                                </CardBody>
                                            </Card>
                                        ))}

                                    <Box>
                                        <Input
                                            placeholder={isTimerRunning ? "Add a new card" : "Timer is paused"}
                                            value={newCardText[column.id] || ''}
                                            onChange={(e) => setNewCardText({
                                                ...newCardText,
                                                [column.id]: e.target.value
                                            })}
                                            onKeyPress={(e) => {
                                                if (e.key === 'Enter' && isTimerRunning) {
                                                    handleAddCard(column.id)
                                                }
                                            }}
                                            disabled={!isTimerRunning}
                                        />
                                        <Button
                                            leftIcon={<AddIcon />}
                                            mt={2}
                                            w="full"
                                            onClick={() => handleAddCard(column.id)}
                                            disabled={!isTimerRunning}
                                        >
                                            Add Card
                                        </Button>
                                    </Box>
                                </VStack>
                            </VStack>
                        ))}
                    </SimpleGrid>
                </VStack>

                {board && (
                    <RetroBoardSettingsModal
                        isOpen={isSettingsOpen}
                        onClose={onSettingsClose}
                        settings={{
                            defaultTimer: board.default_timer,
                            hideCardsByDefault: board.hide_cards_by_default,
                            hideAuthorNames: board.hide_author_names
                        }}
                        onSave={handleUpdateSettings}
                    />
                )}
            </Box>
        </PageContainer>
    )
}

export default RetroBoard
