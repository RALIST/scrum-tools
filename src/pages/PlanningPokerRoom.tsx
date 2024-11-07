import { FC, useState, useEffect } from 'react'
import { Manager } from 'socket.io-client'
import type { Socket as ClientSocket } from 'socket.io-client'
import { useParams, useNavigate } from 'react-router-dom'
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
    useDisclosure
} from '@chakra-ui/react'
import { CopyIcon, CheckIcon } from '@chakra-ui/icons'
import PageContainer from '../components/PageContainer'

const FIBONACCI_SEQUENCE: string[] = ['1', '2', '3', '5', '8', '13', '21', '?']
const SOCKET_URL = 'http://localhost:3001'
const LOCAL_STORAGE_USERNAME_KEY = 'planningPokerUsername'

interface Participant {
    id: string
    name: string
    vote: string | null
}

interface CardProps {
    value: string
    isSelected: boolean
    onClick: () => void
    disabled?: boolean
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

const PlanningPokerRoom: FC = () => {
    const [socket, setSocket] = useState<typeof ClientSocket | null>(null)
    const [selectedCard, setSelectedCard] = useState<string | null>(null)
    const [userName, setUserName] = useState<string>('')
    const [isJoined, setIsJoined] = useState(false)
    const [showJoinModal, setShowJoinModal] = useState(true)
    const [participants, setParticipants] = useState<Participant[]>([])
    const [isRevealed, setIsRevealed] = useState(false)
    const { colorMode } = useColorMode()
    const toast = useToast()
    const navigate = useNavigate()
    const { roomId } = useParams<{ roomId: string }>()
    const shareableLink = `${window.location.origin}/planning-poker/${roomId}`
    const { hasCopied, onCopy } = useClipboard(shareableLink)
    const { isOpen: isChangeNameOpen, onOpen: onChangeNameOpen, onClose: onChangeNameClose } = useDisclosure()
    const [newUserName, setNewUserName] = useState<string>('')

    useEffect(() => {
        const savedUsername = localStorage.getItem(LOCAL_STORAGE_USERNAME_KEY)
        if (savedUsername) {
            setUserName(savedUsername)
        }
    }, [])

    useEffect(() => {
        if (!roomId) {
            navigate('/planning-poker')
            return
        }

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
            setIsJoined(true)
            setShowJoinModal(false)
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
        if (!userName.trim()) {
            toast({
                title: 'Error',
                description: 'Please enter your name',
                status: 'error',
                duration: 2000,
            })
            return
        }

        localStorage.setItem(LOCAL_STORAGE_USERNAME_KEY, userName)

        if (socket?.connected && roomId) {
            socket.emit('joinRoom', { roomId, userName })
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

        if (numericVotes.length === 0) return 0
        const avg = numericVotes.reduce((a, b) => a + b, 0) / numericVotes.length
        return avg
    }

    const getVoteColor = (vote: string | null) => {
        if (!vote || vote === '?' || !isRevealed) return undefined

        const voteNum = Number(vote)
        const average = calculateAverage()

        if (isNaN(voteNum)) return undefined

        // Calculate the percentage difference from the average
        const maxDiff = Math.max(...FIBONACCI_SEQUENCE
            .filter(v => v !== '?')
            .map(v => Math.abs(Number(v) - average)))

        const diff = Math.abs(voteNum - average)
        const percentage = diff / maxDiff

        // Color gradient from green (close to average) to red (far from average)
        if (percentage <= 0.2) return 'green.500'
        if (percentage <= 0.4) return 'green.300'
        if (percentage <= 0.6) return 'yellow.400'
        if (percentage <= 0.8) return 'orange.400'
        return 'red.500'
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

                    {isJoined && (
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
                                                            <Td>
                                                                <Text
                                                                    color={getVoteColor(participant.vote)}
                                                                    fontWeight="bold"
                                                                >
                                                                    {participant.vote || 'No vote'}
                                                                </Text>
                                                            </Td>
                                                        )}
                                                    </Tr>
                                                ))}
                                            </Tbody>
                                        </Table>
                                    </TableContainer>
                                    {isRevealed && (
                                        <Text mt={4} fontWeight="bold" textAlign={{ base: "center", md: "left" }}>
                                            Average: {calculateAverage().toFixed(1)}
                                        </Text>
                                    )}
                                </Box>
                            </VStack>
                        </Box>
                    )}
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

export default PlanningPokerRoom