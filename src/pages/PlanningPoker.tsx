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
    HStack,
    Container,
    Text,
    List,
    ListItem,
    ListIcon,
    Divider,
    Stack
} from '@chakra-ui/react'
import { CheckCircleIcon } from '@chakra-ui/icons'
import PageContainer from '../components/PageContainer'
import PageHelmet from '../components/PageHelmet'

const SOCKET_URL = `https://${window.location.hostname}`

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
            <PageHelmet
                title="Planning Poker - Free Online Estimation Tool for Agile Teams"
                description="Free online Planning Poker tool for agile teams. Real-time story point estimation with your team. No registration required. Start estimating user stories instantly."
                keywords="planning poker, scrum poker, agile estimation, story points, team estimation, real-time voting, sprint planning, agile tools, fibonacci sequence"
                canonicalUrl="https://scrumtools.app/planning-poker"
            />
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

                    <Divider my={8} />

                    <Container maxW="container.lg">
                        <Stack spacing={12}>
                            <Box>
                                <Heading as="h2" size="lg" mb={6}>
                                    What is Planning Poker?
                                </Heading>
                                <Text fontSize="lg" mb={4}>
                                    Planning Poker, also known as Scrum Poker, is a consensus-based estimation technique used by agile teams to estimate the effort of project backlog items. Team members make estimates by playing numbered cards face-down, revealing them simultaneously to avoid anchoring bias.
                                </Text>
                                <List spacing={3}>
                                    <ListItem>
                                        <ListIcon as={CheckCircleIcon} color="green.500" />
                                        Uses Fibonacci sequence for relative sizing
                                    </ListItem>
                                    <ListItem>
                                        <ListIcon as={CheckCircleIcon} color="green.500" />
                                        Promotes team discussion and alignment
                                    </ListItem>
                                    <ListItem>
                                        <ListIcon as={CheckCircleIcon} color="green.500" />
                                        Reduces influence bias in estimations
                                    </ListItem>
                                </List>
                            </Box>

                            <Box>
                                <Heading as="h2" size="lg" mb={6}>
                                    How to Use Our Planning Poker Tool
                                </Heading>
                                <Text fontSize="lg" mb={4}>
                                    Our free online Planning Poker tool makes it easy to conduct estimation sessions with your team, whether you're co-located or working remotely. Here's how it works:
                                </Text>
                                <List spacing={3}>
                                    <ListItem>
                                        <ListIcon as={CheckCircleIcon} color="green.500" />
                                        Create a room and share the link with your team
                                    </ListItem>
                                    <ListItem>
                                        <ListIcon as={CheckCircleIcon} color="green.500" />
                                        Each team member selects their estimate privately
                                    </ListItem>
                                    <ListItem>
                                        <ListIcon as={CheckCircleIcon} color="green.500" />
                                        Reveal votes simultaneously to discuss differences
                                    </ListItem>
                                    <ListItem>
                                        <ListIcon as={CheckCircleIcon} color="green.500" />
                                        Use color-coded results to identify consensus and outliers
                                    </ListItem>
                                </List>
                            </Box>

                            <Box>
                                <Heading as="h2" size="lg" mb={6}>
                                    Benefits of Online Planning Poker
                                </Heading>
                                <Text fontSize="lg" mb={4}>
                                    Using our online Planning Poker tool offers several advantages over traditional physical cards or basic video conferencing:
                                </Text>
                                <List spacing={3}>
                                    <ListItem>
                                        <ListIcon as={CheckCircleIcon} color="green.500" />
                                        Real-time collaboration for distributed teams
                                    </ListItem>
                                    <ListItem>
                                        <ListIcon as={CheckCircleIcon} color="green.500" />
                                        Automatic calculation of averages and statistics
                                    </ListItem>
                                    <ListItem>
                                        <ListIcon as={CheckCircleIcon} color="green.500" />
                                        Visual indicators help identify estimation patterns
                                    </ListItem>
                                    <ListItem>
                                        <ListIcon as={CheckCircleIcon} color="green.500" />
                                        No registration or setup required
                                    </ListItem>
                                </List>
                            </Box>

                            <Box>
                                <Heading as="h2" size="lg" mb={6}>
                                    Best Practices for Story Point Estimation
                                </Heading>
                                <Text fontSize="lg" mb={4}>
                                    To get the most out of your estimation sessions, consider these best practices:
                                </Text>
                                <List spacing={3}>
                                    <ListItem>
                                        <ListIcon as={CheckCircleIcon} color="green.500" />
                                        Focus on relative sizing rather than exact time estimates
                                    </ListItem>
                                    <ListItem>
                                        <ListIcon as={CheckCircleIcon} color="green.500" />
                                        Discuss outliers to understand different perspectives
                                    </ListItem>
                                    <ListItem>
                                        <ListIcon as={CheckCircleIcon} color="green.500" />
                                        Use the Fibonacci sequence to force meaningful differences between estimates
                                    </ListItem>
                                    <ListItem>
                                        <ListIcon as={CheckCircleIcon} color="green.500" />
                                        Keep reference stories in mind for consistent estimation
                                    </ListItem>
                                </List>
                            </Box>
                        </Stack>
                    </Container>
                </VStack>
            </Box>
        </PageContainer>
    )
}

export default PlanningPoker
