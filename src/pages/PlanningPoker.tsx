import { FC, useState, useEffect } from 'react'
import { Manager } from 'socket.io-client'
import type { Socket as ClientSocket } from 'socket.io-client'
import { useSearchParams, useNavigate } from 'react-router-dom'
import {
    Box,
    Container,
    Heading,
    SimpleGrid,
    Button,
    Text,
    VStack,
    HStack,
    useColorMode,
    useToast,
    Input,
    Modal,
    ModalOverlay,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
    Table,
    Thead,
    Tbody,
    Tr,
    Th,
    Td,
    Badge,
    IconButton,
    useClipboard
} from '@chakra-ui/react'
import { CopyIcon, CheckIcon } from '@chakra-ui/icons'

const FIBONACCI_SEQUENCE: string[] = ['1', '2', '3', '5', '8', '13', '21', '?']
const SOCKET_URL = 'http://localhost:3001'

interface Room {
    id: string
    name: string
    participantCount: number
    createdAt: string
}

interface CardProps {
    value: string
    isSelected: boolean
    onClick: () => void
    disabled?: boolean
}

interface Participant {
    id: string
    name: string
    vote: string | null
}

const Card: FC<CardProps> = ({ value, isSelected, onClick, disabled }) => {
    const { colorMode } = useColorMode()

    return (
        <Button
            h="120px"
            w="80px"
            fontSize="2xl"
            variant="outline"
            colorScheme={isSelected ? 'blue' : 'gray'}
            bg={isSelected ? (colorMode === 'light' ? 'blue.50' : 'blue.900') : 'transparent'}
            onClick={onClick}
            disabled={disabled}
            _hover={{
                transform: disabled ? 'none' : 'translateY(-4px)',
                transition: 'transform 0.2s'
            }}
        >
            {value}
        </Button>
    )
}

const PlanningPoker: FC = () => {
    const [socket, setSocket] = useState<typeof ClientSocket | null>(null)
    const [selectedCard, setSelectedCard] = useState<string | null>(null)
    const [roomId, setRoomId] = useState<string>('')
    const [userName, setUserName] = useState<string>('')
    const [isJoined, setIsJoined] = useState(false)
    const [showJoinModal, setShowJoinModal] = useState(true)
    const [participants, setParticipants] = useState<Participant[]>([])
    const [isRevealed, setIsRevealed] = useState(false)
    const [activeRooms, setActiveRooms] = useState<Room[]>([])
    const { colorMode } = useColorMode()
    const toast = useToast()
    const [searchParams] = useSearchParams()
    const navigate = useNavigate()
    const shareableLink = `${window.location.origin}/planning-poker?room=${roomId}`
    const { hasCopied, onCopy } = useClipboard(shareableLink)

    useEffect(() => {
        // Load active rooms
        fetch(`${SOCKET_URL}/api/rooms`)
            .then(res => res.json())
            .then(setActiveRooms)
            .catch(console.error)

        // Check for room in URL
        const roomFromUrl = searchParams.get('room')
        if (roomFromUrl) {
            setRoomId(roomFromUrl)
        }
    }, [])

    useEffect(() => {
        const manager = new Manager(SOCKET_URL, {
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
            toast({
                title: 'Connected to server',
                status: 'success',
                duration: 2000,
            })
        })

        newSocket.on('connect_error', (error: Error) => {
            console.error('Connection error:', error)
            toast({
                title: 'Connection error',
                description: 'Failed to connect to server',
                status: 'error',
                duration: 2000,
            })
        })

        setSocket(newSocket)

        newSocket.on('roomJoined', (data: { participants: Participant[] }) => {
            setParticipants(data.participants)
            toast({
                title: 'Joined Room',
                status: 'success',
                duration: 2000,
            })
            // Update URL with room ID
            navigate(`/planning-poker?room=${roomId}`, { replace: true })
        })

        newSocket.on('participantUpdate', (data: { participants: Participant[] }) => {
            setParticipants(data.participants)
        })

        newSocket.on('votesRevealed', () => {
            setIsRevealed(true)
        })

        newSocket.on('votesReset', () => {
            setIsRevealed(false)
            setSelectedCard(null)
        })

        return () => {
            newSocket.disconnect()
        }
    }, [roomId])

    const handleJoinRoom = () => {
        if (!userName.trim() || !roomId.trim()) {
            toast({
                title: 'Error',
                description: 'Please enter both name and room ID',
                status: 'error',
                duration: 2000,
            })
            return
        }

        if (socket?.connected) {
            socket.emit('joinRoom', { roomId, userName })
            setIsJoined(true)
            setShowJoinModal(false)
        } else {
            toast({
                title: 'Connection Error',
                description: 'Not connected to server. Please try again.',
                status: 'error',
                duration: 2000,
            })
        }
    }

    const handleCardSelect = (value: string) => {
        setSelectedCard(value)
        socket?.emit('vote', { roomId, vote: value })
        toast({
            title: 'Vote Recorded',
            description: `You selected ${value} points`,
            status: 'success',
            duration: 2000,
        })
    }

    const handleRevealVotes = () => {
        socket?.emit('revealVotes', { roomId })
    }

    const handleResetVotes = () => {
        socket?.emit('resetVotes', { roomId })
    }

    const calculateAverage = () => {
        const numericVotes = participants
            .map(p => p.vote)
            .filter(vote => vote && vote !== '?' && !isNaN(Number(vote)))
            .map(Number)

        if (numericVotes.length === 0) return 'N/A'
        const avg = numericVotes.reduce((a, b) => a + b, 0) / numericVotes.length
        return avg.toFixed(1)
    }

    const handleJoinExistingRoom = (roomId: string) => {
        setRoomId(roomId)
        setShowJoinModal(true)
    }

    return (
        <Box bg={colorMode === 'light' ? 'gray.50' : 'gray.900'} minH="calc(100vh - 60px)">
            <Container maxW="1200px" py={12}>
                <VStack spacing={8}>
                    <Box textAlign="center">
                        <Heading size="xl" mb={4}>
                            Planning Poker
                        </Heading>
                        {isJoined && (
                            <VStack spacing={2}>
                                <Text fontSize="lg" color={colorMode === 'light' ? 'gray.600' : 'gray.300'}>
                                    Room: {roomId}
                                </Text>
                                <HStack>
                                    <Input
                                        value={shareableLink}
                                        isReadOnly
                                        size="sm"
                                        width="auto"
                                    />
                                    <IconButton
                                        aria-label="Copy link"
                                        icon={hasCopied ? <CheckIcon /> : <CopyIcon />}
                                        onClick={onCopy}
                                        size="sm"
                                    />
                                </HStack>
                            </VStack>
                        )}
                    </Box>

                    {isJoined ? (
                        <Box
                            w="full"
                            p={8}
                            borderRadius="lg"
                            bg={colorMode === 'light' ? 'white' : 'gray.700'}
                            shadow="md"
                        >
                            <VStack spacing={8}>
                                <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4}>
                                    {FIBONACCI_SEQUENCE.map((value) => (
                                        <Card
                                            key={value}
                                            value={value}
                                            isSelected={selectedCard === value}
                                            onClick={() => handleCardSelect(value)}
                                            disabled={isRevealed}
                                        />
                                    ))}
                                </SimpleGrid>

                                <HStack spacing={4} wrap="wrap" justify="center">
                                    <Button
                                        colorScheme="blue"
                                        onClick={handleRevealVotes}
                                        disabled={isRevealed}
                                    >
                                        Reveal Votes
                                    </Button>
                                    <Button
                                        colorScheme="orange"
                                        onClick={handleResetVotes}
                                    >
                                        New Round
                                    </Button>
                                </HStack>

                                <Box w="full">
                                    <Table variant="simple">
                                        <Thead>
                                            <Tr>
                                                <Th>Participant</Th>
                                                <Th>Status</Th>
                                                {isRevealed && <Th>Vote</Th>}
                                            </Tr>
                                        </Thead>
                                        <Tbody>
                                            {participants.map((participant) => (
                                                <Tr key={participant.id}>
                                                    <Td>{participant.name}</Td>
                                                    <Td>
                                                        <Badge
                                                            colorScheme={participant.vote ? 'green' : 'yellow'}
                                                        >
                                                            {participant.vote ? 'Voted' : 'Not Voted'}
                                                        </Badge>
                                                    </Td>
                                                    {isRevealed && (
                                                        <Td>{participant.vote || 'No vote'}</Td>
                                                    )}
                                                </Tr>
                                            ))}
                                        </Tbody>
                                    </Table>
                                    {isRevealed && (
                                        <Text mt={4} fontWeight="bold">
                                            Average (excluding '?'): {calculateAverage()}
                                        </Text>
                                    )}
                                </Box>
                            </VStack>
                        </Box>
                    ) : (
                        <Box
                            w="full"
                            p={8}
                            borderRadius="lg"
                            bg={colorMode === 'light' ? 'white' : 'gray.700'}
                            shadow="md"
                        >
                            <VStack spacing={4}>
                                <Heading size="md">Active Rooms</Heading>
                                <Table variant="simple">
                                    <Thead>
                                        <Tr>
                                            <Th>Room ID</Th>
                                            <Th>Participants</Th>
                                            <Th>Action</Th>
                                        </Tr>
                                    </Thead>
                                    <Tbody>
                                        {activeRooms.map((room) => (
                                            <Tr key={room.id}>
                                                <Td>{room.id}</Td>
                                                <Td>{room.participantCount}</Td>
                                                <Td>
                                                    <Button
                                                        size="sm"
                                                        colorScheme="blue"
                                                        onClick={() => handleJoinExistingRoom(room.id)}
                                                    >
                                                        Join
                                                    </Button>
                                                </Td>
                                            </Tr>
                                        ))}
                                    </Tbody>
                                </Table>
                            </VStack>
                        </Box>
                    )}
                </VStack>
            </Container>

            <Modal isOpen={showJoinModal} onClose={() => { }} closeOnOverlayClick={false}>
                <ModalOverlay />
                <ModalContent>
                    <ModalHeader>Join Planning Poker</ModalHeader>
                    <ModalBody>
                        <VStack spacing={4}>
                            <Input
                                placeholder="Enter your name"
                                value={userName}
                                onChange={(e) => setUserName(e.target.value)}
                            />
                            <Input
                                placeholder="Enter room ID"
                                value={roomId}
                                onChange={(e) => setRoomId(e.target.value)}
                            />
                        </VStack>
                    </ModalBody>
                    <ModalFooter>
                        <Button colorScheme="blue" onClick={handleJoinRoom}>
                            Join Room
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>
        </Box>
    )
}

export default PlanningPoker
