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
    useToast
} from '@chakra-ui/react'
import { AddIcon, DeleteIcon, ViewIcon, ViewOffIcon } from '@chakra-ui/icons'
import PageContainer from '../components/PageContainer'
import { Helmet } from 'react-helmet-async'
import config from '../config'

interface RetroCard {
    id: string
    text: string
    column_id: string
    created_at: string
}

interface RetroBoard {
    id: string
    name: string
    created_at: string
    cards: RetroCard[]
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
            .then(setBoard)
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
            setBoard(data)
        })

        newSocket.on('retroBoardUpdated', (data: RetroBoard) => {
            setBoard(data)
        })

        newSocket.on('error', (data: { message: string }) => {
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
        if (!newCardText[columnId]?.trim() || !socket || !boardId) return

        const cardId = Math.random().toString(36).substring(7)
        socket.emit('addRetroCard', {
            boardId,
            cardId,
            columnId,
            text: newCardText[columnId]
        })

        setNewCardText({ ...newCardText, [columnId]: '' })
    }

    const handleDeleteCard = (cardId: string) => {
        if (!socket || !boardId) return
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
                        </HStack>
                        <Text fontSize="lg" color={colorMode === 'light' ? 'gray.600' : 'gray.300'} mt={2}>
                            Share your thoughts about the sprint
                        </Text>
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
                                                </CardBody>
                                            </Card>
                                        ))}

                                    <Box>
                                        <Input
                                            placeholder="Add a new card"
                                            value={newCardText[column.id] || ''}
                                            onChange={(e) => setNewCardText({
                                                ...newCardText,
                                                [column.id]: e.target.value
                                            })}
                                            onKeyPress={(e) => {
                                                if (e.key === 'Enter') {
                                                    handleAddCard(column.id)
                                                }
                                            }}
                                        />
                                        <Button
                                            leftIcon={<AddIcon />}
                                            mt={2}
                                            w="full"
                                            onClick={() => handleAddCard(column.id)}
                                        >
                                            Add Card
                                        </Button>
                                    </Box>
                                </VStack>
                            </VStack>
                        ))}
                    </SimpleGrid>
                </VStack>
            </Box>
        </PageContainer>
    )
}

export default RetroBoard
