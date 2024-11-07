import { FC, useState, useEffect } from 'react'
import { Manager } from 'socket.io-client'
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
    Badge
} from '@chakra-ui/react'

const FIBONACCI_SEQUENCE: string[] = ['1', '2', '3', '5', '8', '13', '21', '?']
const SOCKET_URL = 'http://localhost:3001'

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
    const [socket, setSocket] = useState<any>(null)
    const [selectedCard, setSelectedCard] = useState<string | null>(null)
    const [roomId, setRoomId] = useState<string>('')
    const [userName, setUserName] = useState<string>('')
    const [isJoined, setIsJoined] = useState(false)
    const [showJoinModal, setShowJoinModal] = useState(true)
    const [participants, setParticipants] = useState<Participant[]>([])
    const [isRevealed, setIsRevealed] = useState(false)
    const { colorMode } = useColorMode()
    const toast = useToast()

    useEffect(() => {
        const manager = new Manager(SOCKET_URL)
        const newSocket = manager.socket('/')
        setSocket(newSocket)

        newSocket.on('roomJoined', (data: { participants: Participant[] }) => {
            setParticipants(data.participants)
            toast({
                title: 'Joined Room',
                status: 'success',
                duration: 2000,
            })
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
    }, [])

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

        socket?.emit('joinRoom', { roomId, userName })
        setIsJoined(true)
        setShowJoinModal(false)
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

    return (
        <Box bg={colorMode === 'light' ? 'gray.50' : 'gray.900'} minH="calc(100vh - 60px)">
            <Container maxW="1200px" py={12}>
                <VStack spacing={8}>
                    <Box textAlign="center">
                        <Heading size="xl" mb={4}>
                            Planning Poker
                        </Heading>
                        {isJoined && (
                            <Text fontSize="lg" color={colorMode === 'light' ? 'gray.600' : 'gray.300'}>
                                Room: {roomId}
                            </Text>
                        )}
                    </Box>

                    {isJoined && (
                        <>
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
                        </>
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
