import { FC, useState, useEffect } from 'react'
import { Manager } from 'socket.io-client'
import type { Socket as ClientSocket } from 'socket.io-client'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import {
    Box,
    Heading,
    Button,
    Text,
    VStack,
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
    useColorMode,
    useToast,
    Stack,
    TableContainer,
    Wrap,
    WrapItem,
    useClipboard,
    useDisclosure,
    Center,
    HStack
} from '@chakra-ui/react'
import { CopyIcon, CheckIcon } from '@chakra-ui/icons'
import PageContainer from '../components/PageContainer'

const FIBONACCI_SEQUENCE: string[] = ['1', '2', '3', '5', '8', '13', '21', '?']
const SOCKET_URL = 'http://localhost:3001'
const LOCAL_STORAGE_USERNAME_KEY = 'planningPokerUsername'

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
            h={{ base: "100px", md: "120px" }}
            w={{ base: "70px", md: "80px" }}
            fontSize={{ base: "xl", md: "2xl" }}
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
    const [showJoinModal, setShowJoinModal] = useState(false)
    const [showRoomList, setShowRoomList] = useState(false)
    const [participants, setParticipants] = useState<Participant[]>([])
    const [isRevealed, setIsRevealed] = useState(false)
    const [activeRooms, setActiveRooms] = useState<Room[]>([])
    const { colorMode } = useColorMode()
    const toast = useToast()
    const navigate = useNavigate()
    const location = useLocation()
    const { roomId: roomIdParam } = useParams()
    const shareableLink = `${window.location.origin}/planning-poker/${roomId}`
    const { hasCopied, onCopy } = useClipboard(shareableLink)
    const { isOpen: isChangeNameOpen, onOpen: onChangeNameOpen, onClose: onChangeNameClose } = useDisclosure()
    const [newUserName, setNewUserName] = useState<string>('')

    // Reset state when navigating to main planning poker page
    useEffect(() => {
        if (location.pathname === '/planning-poker' && !roomIdParam) {
            setIsJoined(false)
            setShowJoinModal(false)
            setShowRoomList(false)
            setRoomId('')
            setSelectedCard(null)
            setParticipants([])
            setIsRevealed(false)
            socket?.disconnect()
        }
    }, [location.pathname, roomIdParam])

    useEffect(() => {
        const savedUsername = localStorage.getItem(LOCAL_STORAGE_USERNAME_KEY)
        if (savedUsername) {
            setUserName(savedUsername)
        }
    }, [])

    useEffect(() => {
        fetch(`${SOCKET_URL}/api/rooms`)
            .then(res => res.json())
            .then(setActiveRooms)
            .catch(console.error)

        if (roomIdParam) {
            setRoomId(roomIdParam)
            setShowJoinModal(true)
        }
    }, [roomIdParam])

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
            navigate(`/planning-poker/${roomId}`, { replace: true })
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

    const handleCreateRoom = async () => {
        const newRoomId = Math.random().toString(36).substring(2, 8)
        try {
            const response = await fetch(`${SOCKET_URL}/api/rooms`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ roomId: newRoomId }),
            })

            if (response.ok) {
                setRoomId(newRoomId)
                setShowJoinModal(true)
                navigate(`/planning-poker/${newRoomId}`)
            } else {
                throw new Error('Failed to create room')
            }
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to create new room',
                status: 'error',
                duration: 2000,
            })
        }
    }

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

        localStorage.setItem(LOCAL_STORAGE_USERNAME_KEY, userName)

        if (socket?.connected) {
            socket.emit('joinRoom', { roomId, userName })
            setIsJoined(true)
            setShowJoinModal(false)
            setShowRoomList(false)
        } else {
            toast({
                title: 'Connection Error',
                description: 'Not connected to server. Please try again.',
                status: 'error',
                duration: 2000,
            })
        }
    }

    const handleChangeName = () => {
        if (!newUserName.trim()) {
            toast({
                title: 'Error',
                description: 'Please enter a valid name',
                status: 'error',
                duration: 2000,
            })
            return
        }

        localStorage.setItem(LOCAL_STORAGE_USERNAME_KEY, newUserName)
        setUserName(newUserName)
        socket?.emit('changeName', { roomId, newName: newUserName })
        onChangeNameClose()
        toast({
            title: 'Name Updated',
            status: 'success',
            duration: 2000,
        })
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
        navigate(`/planning-poker/${roomId}`)
    }

    return (
        <PageContainer>
            <Box bg={colorMode === 'light' ? 'gray.50' : 'gray.900'} minH="calc(100vh - 60px)">
                <VStack spacing={{ base: 4, md: 8 }}>
                    <Box textAlign="center" w="full">
                        <Heading size={{ base: "lg", md: "xl" }} mb={4}>
                            Planning Poker
                        </Heading>
                        {isJoined && (
                            <VStack spacing={2}>
                                <Stack direction="row" spacing={2} align="center">
                                    <Text fontSize={{ base: "md", md: "lg" }} color={colorMode === 'light' ? 'gray.600' : 'gray.300'}>
                                        Playing as: {userName}
                                    </Text>
                                    <Button size="sm" onClick={() => {
                                        setNewUserName(userName)
                                        onChangeNameOpen()
                                    }}>
                                        Change Name
                                    </Button>
                                </Stack>
                                <Text fontSize={{ base: "md", md: "lg" }} color={colorMode === 'light' ? 'gray.600' : 'gray.300'}>
                                    Room: {roomId}
                                </Text>
                                <Stack direction={{ base: "column", md: "row" }} spacing={2} w="full" align="center">
                                    <Input
                                        value={shareableLink}
                                        isReadOnly
                                        size="sm"
                                        width={{ base: "full", md: "auto" }}
                                    />
                                    <IconButton
                                        aria-label="Copy link"
                                        icon={hasCopied ? <CheckIcon /> : <CopyIcon />}
                                        onClick={onCopy}
                                        size="sm"
                                    />
                                </Stack>
                            </VStack>
                        )}
                    </Box>

                    {!isJoined && !showRoomList && !roomIdParam && (
                        <Center p={8}>
                            <VStack spacing={4} w={{ base: "full", md: "400px" }}>
                                <Button
                                    colorScheme="blue"
                                    size="lg"
                                    w="full"
                                    onClick={handleCreateRoom}
                                >
                                    Create New Room
                                </Button>
                                <Button
                                    colorScheme="green"
                                    size="lg"
                                    w="full"
                                    onClick={() => setShowRoomList(true)}
                                >
                                    Join Existing Room
                                </Button>
                            </VStack>
                        </Center>
                    )}

                    {isJoined ? (
                        <Box
                            w="full"
                            p={{ base: 4, md: 8 }}
                            borderRadius="lg"
                            bg={colorMode === 'light' ? 'white' : 'gray.700'}
                            shadow="md"
                        >
                            <VStack spacing={{ base: 4, md: 8 }}>
                                <Wrap spacing={4} justify="center">
                                    {FIBONACCI_SEQUENCE.map((value) => (
                                        <WrapItem key={value}>
                                            <Card
                                                value={value}
                                                isSelected={selectedCard === value}
                                                onClick={() => handleCardSelect(value)}
                                                disabled={isRevealed}
                                            />
                                        </WrapItem>
                                    ))}
                                </Wrap>

                                <Stack
                                    direction={{ base: "column", md: "row" }}
                                    spacing={4}
                                    justify="center"
                                    w="full"
                                >
                                    <Button
                                        colorScheme="blue"
                                        onClick={handleRevealVotes}
                                        disabled={isRevealed}
                                        w={{ base: "full", md: "auto" }}
                                    >
                                        Reveal Votes
                                    </Button>
                                    <Button
                                        colorScheme="orange"
                                        onClick={handleResetVotes}
                                        w={{ base: "full", md: "auto" }}
                                    >
                                        New Round
                                    </Button>
                                </Stack>

                                <Box w="full" overflowX="auto">
                                    <TableContainer>
                                        <Table variant="simple" size={{ base: "sm", md: "md" }}>
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
                                    </TableContainer>
                                    {isRevealed && (
                                        <Text mt={4} fontWeight="bold" textAlign={{ base: "center", md: "left" }}>
                                            Average (excluding '?'): {calculateAverage()}
                                        </Text>
                                    )}
                                </Box>
                            </VStack>
                        </Box>
                    ) : showRoomList && !roomIdParam ? (
                        <Box
                            w="full"
                            p={{ base: 4, md: 8 }}
                            borderRadius="lg"
                            bg={colorMode === 'light' ? 'white' : 'gray.700'}
                            shadow="md"
                        >
                            <VStack spacing={4}>
                                <HStack w="full" justify="space-between">
                                    <Heading size="md">Active Rooms</Heading>
                                    <Button size="sm" onClick={() => setShowRoomList(false)}>
                                        Back
                                    </Button>
                                </HStack>
                                <Box w="full" overflowX="auto">
                                    <TableContainer>
                                        <Table variant="simple" size={{ base: "sm", md: "md" }}>
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
                                    </TableContainer>
                                </Box>
                            </VStack>
                        </Box>
                    ) : null}
                </VStack>

                <Modal isOpen={showJoinModal} onClose={() => { }} closeOnOverlayClick={false}>
                    <ModalOverlay />
                    <ModalContent mx={4}>
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
                                    isReadOnly={!!roomIdParam}
                                />
                            </VStack>
                        </ModalBody>
                        <ModalFooter>
                            <Button colorScheme="blue" onClick={handleJoinRoom} w="full">
                                Join Room
                            </Button>
                        </ModalFooter>
                    </ModalContent>
                </Modal>

                <Modal isOpen={isChangeNameOpen} onClose={onChangeNameClose}>
                    <ModalOverlay />
                    <ModalContent mx={4}>
                        <ModalHeader>Change Name</ModalHeader>
                        <ModalBody>
                            <Input
                                placeholder="Enter new name"
                                value={newUserName}
                                onChange={(e) => setNewUserName(e.target.value)}
                            />
                        </ModalBody>
                        <ModalFooter>
                            <Button variant="ghost" mr={3} onClick={onChangeNameClose}>
                                Cancel
                            </Button>
                            <Button colorScheme="blue" onClick={handleChangeName}>
                                Save
                            </Button>
                        </ModalFooter>
                    </ModalContent>
                </Modal>
            </Box>
        </PageContainer>
    )
}

export default PlanningPoker
