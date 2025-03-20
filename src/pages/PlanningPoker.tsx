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
    Modal,
    ModalOverlay,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
    Input,
    Select,
    FormControl,
    FormLabel,
    useDisclosure,
    Divider,
    Text,
    Badge,
    Spinner,
} from '@chakra-ui/react'
import PageContainer from '../components/PageContainer'
import PageHelmet from '../components/PageHelmet'
import SeoText from '../components/SeoText'
import { planningPokerSeoSections } from '../content/planningPokerSeo'
import { SEQUENCE_LABELS, SequenceType } from '../constants/poker'
import config from '../config'
import { useAuth } from '../contexts/AuthContext'
import { useWorkspace } from '../contexts/WorkspaceContext'
import { apiRequest } from '../utils/apiUtils'

interface Room {
    id: string
    name: string
    participantCount: number
    createdAt: string
    hasPassword: boolean
    sequence: string
    workspace_id?: string
    created_by?: string
}

interface CreateRoomSettings {
    password?: string
    sequence: SequenceType
    roomName: string
    workspaceId?: string
}

const PlanningPoker: FC = () => {
    const [showRoomList, setShowRoomList] = useState(false)
    const [activeRooms, setActiveRooms] = useState<Room[]>([])
    const [workspaceRooms, setWorkspaceRooms] = useState<Room[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const { colorMode } = useColorMode()
    const navigate = useNavigate()
    const toast = useToast()
    const { isOpen: isCreateModalOpen, onOpen: onCreateModalOpen, onClose: onCreateModalClose } = useDisclosure()
    const { isAuthenticated } = useAuth()
    const { currentWorkspace, workspaces } = useWorkspace()
    
    const [createSettings, setCreateSettings] = useState<CreateRoomSettings>({
        sequence: 'fibonacci',
        roomName: '',
        workspaceId: currentWorkspace?.id
    })

    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        "name": "Planning Poker - Online Estimation Tool",
        "applicationCategory": "BusinessApplication",
        "operatingSystem": "Any",
        "description": "Free online Planning Poker tool for agile teams. Real-time story point estimation with your team. No registration required.",
        "offers": {
            "@type": "Offer",
            "price": "0",
            "priceCurrency": "USD"
        },
        "featureList": [
            "Real-time team collaboration",
            "Multiple estimation sequences",
            "Password-protected rooms",
            "Instant voting results",
            "No registration required"
        ]
    }

    // Update workspaceId when currentWorkspace changes
    useEffect(() => {
        if (currentWorkspace) {
            setCreateSettings(prev => ({
                ...prev,
                workspaceId: currentWorkspace.id
            }));
        }
    }, [currentWorkspace]);

    // Load rooms
    useEffect(() => {
        const loadRooms = async () => {
            setIsLoading(true);
            try {
                // Load public rooms
                const publicRooms = await apiRequest<Room[]>('/rooms', { includeAuth: false });
                setActiveRooms(publicRooms);
                
                // Load workspace rooms if authenticated and have a workspace
                if (isAuthenticated && currentWorkspace) {
                    try {
                        const wsRooms = await apiRequest<Room[]>(`/workspaces/${currentWorkspace.id}/rooms`);
                        setWorkspaceRooms(wsRooms);
                    } catch (error) {
                        console.error("Error loading workspace rooms:", error);
                    }
                }
            } catch (error) {
                console.error("Error loading rooms:", error);
                toast({
                    title: 'Error',
                    description: 'Failed to load active rooms',
                    status: 'error',
                    duration: 3000,
                });
            } finally {
                setIsLoading(false);
            }
        };
        
        loadRooms();
    }, [isAuthenticated, currentWorkspace])

    const handleCreateRoom = async () => {
        // Validate room name if authenticated and in a workspace
        if (isAuthenticated && currentWorkspace && !createSettings.roomName.trim()) {
            toast({
                title: 'Room Name Required',
                description: 'Please enter a name for your room',
                status: 'warning',
                duration: 3000,
            });
            return;
        }
        
        const newRoomId = Math.random().toString(36).substring(2, 8);
        try {
            // Use authentication if we're creating in a workspace
            const includeAuth = !!(isAuthenticated && createSettings.workspaceId);
            
            await apiRequest('/rooms', {
                method: 'POST',
                body: {
                    roomId: newRoomId,
                    name: createSettings.roomName || `Room ${newRoomId}`,
                    workspaceId: createSettings.workspaceId,
                    sequence: createSettings.sequence,
                    password: createSettings.password
                },
                includeAuth
            });
            
            toast({
                title: 'Room Created',
                description: 'Your planning poker room is ready',
                status: 'success',
                duration: 2000,
            });
            
            onCreateModalClose();
            navigate(`/planning-poker/${newRoomId}`);
        } catch (error) {
            toast({
                title: 'Error',
                description: error instanceof Error ? error.message : 'Failed to create new room',
                status: 'error',
                duration: 3000,
            });
        }
    }

    const handleJoinRoom = (roomId: string) => {
        navigate(`/planning-poker/${roomId}`)
    }

    if (isAuthenticated && !workspaces) {
        return (
              <Center h="200px">
                <Spinner size="xl" color="blue.500" />
              </Center>
            );
    }

    return (
        <PageContainer>
            <PageHelmet
                title="Planning Poker - Free Online Estimation Tool for Agile Teams"
                description="Free online Planning Poker tool for agile teams. Real-time story point estimation with your team. No registration required. Start estimating user stories instantly."
                keywords="planning poker, scrum poker, agile estimation, story points, team estimation, real-time voting, sprint planning, agile tools, fibonacci sequence"
                canonicalUrl={`${config.siteUrl}/planning-poker`}
                jsonLd={jsonLd}
            />
            <Box bg={colorMode === 'light' ? 'gray.50' : 'gray.900'} minH="calc(100vh - 60px)">
                <VStack spacing={{ base: 4, md: 8 }}>
                    <Box textAlign="center" w="full">
                        <Heading
                            as="h1"
                            size={{ base: "lg", md: "xl" }}
                            mb={4}
                        >
                            Online Planning Poker - Free Story Point Estimation Tool
                        </Heading>
                    </Box>

                    {!showRoomList ? (
                        <Center p={8}>
                            <VStack spacing={6} w={{ base: "full", md: "500px" }}>
                                                                
                                {isAuthenticated && currentWorkspace && workspaceRooms.length > 0 && (
                                    <Box w="full" mt={4}>
                                        <Text fontWeight="bold" mb={2}>Your Workspace Rooms:</Text>
                                        <VStack 
                                            spacing={2} 
                                            align="stretch" 
                                            bg={colorMode === 'light' ? 'white' : 'gray.700'} 
                                            p={4} 
                                            borderRadius="md"
                                            shadow="sm"
                                        >
                                            {workspaceRooms.slice(0, 3).map(room => (
                                                <HStack key={room.id} justify="space-between">
                                                    <HStack>
                                                        <Text fontWeight="medium">{room.name}</Text>
                                                        <Badge colorScheme="blue">{room.sequence}</Badge>
                                                    </HStack>
                                                    <Button 
                                                        size="sm" 
                                                        colorScheme="blue" 
                                                        onClick={() => handleJoinRoom(room.id)}
                                                    >
                                                        Join
                                                    </Button>
                                                </HStack>
                                            ))}
                                            {workspaceRooms.length > 3 && (
                                                <Button 
                                                    size="sm" 
                                                    variant="link" 
                                                    colorScheme="blue"
                                                    alignSelf="flex-end"
                                                    onClick={() => setShowRoomList(true)}
                                                >
                                                    See all workspace rooms →
                                                </Button>
                                            )}
                                        </VStack>
                                    </Box>
                                )}
                                <Button
                                    colorScheme="blue"
                                    size="lg"
                                    w="full"
                                    onClick={onCreateModalOpen}
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
                            <VStack spacing={6}>
                                <HStack w="full" justify="space-between">
                                    <Heading size="md">Available Rooms</Heading>
                                    <Button size="sm" onClick={() => setShowRoomList(false)}>
                                        Back
                                    </Button>
                                </HStack>
                                
                                {isAuthenticated && currentWorkspace && workspaceRooms.length > 0 && (
                                    <Box w="full">
                                        <HStack mb={3}>
                                            <Heading size="sm">Workspace Rooms</Heading>
                                            <Badge colorScheme="blue">{currentWorkspace.name}</Badge>
                                        </HStack>
                                        
                                        <Box w="full" overflowX="auto">
                                            <TableContainer>
                                                <Table variant="simple" size={{ base: "sm", md: "md" }}>
                                                    <Thead>
                                                        <Tr>
                                                            <Th>Room Name</Th>
                                                            <Th>Room ID</Th>
                                                            <Th>Participants</Th>
                                                            <Th>Sequence</Th>
                                                            <Th>Protected</Th>
                                                            <Th>Action</Th>
                                                        </Tr>
                                                    </Thead>
                                                    <Tbody>
                                                        {workspaceRooms.map((room) => (
                                                            <Tr key={room.id}>
                                                                <Td fontWeight="medium">{room.name}</Td>
                                                                <Td>{room.id}</Td>
                                                                <Td>{room.participantCount}</Td>
                                                                <Td>{room.sequence}</Td>
                                                                <Td>{room.hasPassword ? 'Yes' : 'No'}</Td>
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
                                    </Box>
                                )}
                                
                                <Box w="full">
                                    <Heading size="sm" mb={3}>Public Rooms</Heading>
                                    <Box w="full" overflowX="auto">
                                        <TableContainer>
                                            <Table variant="simple" size={{ base: "sm", md: "md" }}>
                                                <Thead>
                                                    <Tr>
                                                        <Th>Room ID</Th>
                                                        <Th>Participants</Th>
                                                        <Th>Sequence</Th>
                                                        <Th>Protected</Th>
                                                        <Th>Action</Th>
                                                    </Tr>
                                                </Thead>
                                                <Tbody>
                                                    {activeRooms.length === 0 ? (
                                                        <Tr>
                                                            <Td colSpan={5} textAlign="center">No active public rooms</Td>
                                                        </Tr>
                                                    ) : (
                                                        activeRooms.map((room) => (
                                                            <Tr key={room.id}>
                                                                <Td>{room.id}</Td>
                                                                <Td>{room.participantCount}</Td>
                                                                <Td>{room.sequence}</Td>
                                                                <Td>{room.hasPassword ? 'Yes' : 'No'}</Td>
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
                                                        ))
                                                    )}
                                                </Tbody>
                                            </Table>
                                        </TableContainer>
                                    </Box>
                                </Box>
                            </VStack>
                        </Box>
                    )}

                    <Modal isOpen={isCreateModalOpen} onClose={onCreateModalClose}>
                        <ModalOverlay />
                        <ModalContent mx={4}>
                            <ModalHeader>Create Planning Poker Room</ModalHeader>
                            <ModalBody>
                                <VStack spacing={4}>
                                    {isAuthenticated && (
                                        <>
                                            <FormControl isRequired={isAuthenticated && !!currentWorkspace}>
                                                <FormLabel>Room Name</FormLabel>
                                                <Input
                                                    placeholder="Enter room name"
                                                    value={createSettings.roomName}
                                                    onChange={(e) => setCreateSettings(prev => ({
                                                        ...prev,
                                                        roomName: e.target.value
                                                    }))}
                                                />
                                            </FormControl>
                                            
                                            {workspaces && workspaces.length > 0 && (
                                                <FormControl>
                                                    <FormLabel>Workspace (Optional)</FormLabel>
                                                    <Select
                                                        name='workspaceId'
                                                        value={createSettings.workspaceId || ''}
                                                        onChange={(e) => setCreateSettings(prev => ({
                                                            ...prev,
                                                            workspaceId: e.target.value || undefined
                                                        }))}
                                                    >
                                                        <option value="">No Workspace (Public)</option>
                                                        {workspaces.map(workspace => (
                                                            <option key={workspace.id} value={workspace.id}>
                                                                {workspace.name}
                                                            </option>
                                                        ))}
                                                    </Select>
                                                    <Text fontSize="sm" color="gray.500" mt={1}>
                                                        Workspace rooms are only visible to workspace members
                                                    </Text>
                                                </FormControl>
                                            )}
                                        </>
                                    )}
                                    
                                    <FormControl>
                                        <FormLabel>Estimation Sequence</FormLabel>
                                        <Select
                                            value={createSettings.sequence}
                                            onChange={(e) => setCreateSettings(prev => ({
                                                ...prev,
                                                sequence: e.target.value as SequenceType
                                            }))}
                                        >
                                            {Object.entries(SEQUENCE_LABELS).map(([key, label]) => (
                                                <option key={key} value={key}>{label}</option>
                                            ))}
                                        </Select>
                                    </FormControl>
                                    
                                    <FormControl>
                                        <FormLabel>Room Password (Optional)</FormLabel>
                                        <Input
                                            type="password"
                                            placeholder="Leave empty for no password"
                                            value={createSettings.password || ''}
                                            onChange={(e) => setCreateSettings(prev => ({
                                                ...prev,
                                                password: e.target.value || undefined
                                            }))}
                                        />
                                    </FormControl>
                                </VStack>
                            </ModalBody>
                            <ModalFooter>
                                <Button variant="ghost" mr={3} onClick={onCreateModalClose}>
                                    Cancel
                                </Button>
                                <Button colorScheme="blue" onClick={handleCreateRoom} isDisabled={isLoading}>
                                    Create Room
                                </Button>
                            </ModalFooter>
                        </ModalContent>
                    </Modal>

                    <Divider my={8} />

                    <SeoText sections={planningPokerSeoSections} />
                </VStack>
            </Box>
        </PageContainer>
    )
}

export default PlanningPoker
