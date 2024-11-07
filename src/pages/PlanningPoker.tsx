import { FC, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    Box,
    Heading,
    Button,
    VStack,
    Table,
    Thead,
    Tbody,
    Tr,
    Th,
    Td,
    useColorMode,
    useToast,
    TableContainer,
    Center,
    HStack
} from '@chakra-ui/react'
import PageContainer from '../components/PageContainer'

const SOCKET_URL = 'http://localhost:3001'

interface Room {
    id: string
    name: string
    participantCount: number
    createdAt: string
}

const PlanningPoker: FC = () => {
    const [showRoomList, setShowRoomList] = useState(false)
    const [activeRooms, setActiveRooms] = useState<Room[]>([])
    const { colorMode } = useColorMode()
    const navigate = useNavigate()
    const toast = useToast()

    useEffect(() => {
        fetch(`${SOCKET_URL}/api/rooms`)
            .then(res => res.json())
            .then(setActiveRooms)
            .catch(console.error)
    }, [])

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

    const handleJoinRoom = (roomId: string) => {
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
                    </Box>

                    {!showRoomList ? (
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
                    ) : (
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
                                                                onClick={() => handleJoinRoom(room.id)}
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
                    )}
                </VStack>
            </Box>
        </PageContainer>
    )
}

export default PlanningPoker
