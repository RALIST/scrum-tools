import { FC, useState, useEffect, useCallback } from 'react'; // Added useCallback
import { useNavigate } from 'react-router-dom';
import {
    Box,
    Heading,
    Button,
    VStack,
    useColorMode,
    useToast,
    Center,
    HStack, // Keep HStack if used by PokerLandingActions
    useDisclosure,
    Divider,
    Text, // Keep Text if used by PokerLandingActions
    Badge, // Keep Badge if used by PokerLandingActions
    Spinner,
} from '@chakra-ui/react';
import PageContainer from "../../components/PageContainer";
import PageHelmet from "../../components/PageHelmet";
import SeoText from "../../components/SeoText";
import { planningPokerSeoSections } from "../../content/planningPokerSeo";
import { SequenceType } from "../../constants/poker"; // Keep SequenceType
import config from "../../config";
import { useAuth } from "../../contexts/AuthContext";
import { useWorkspace } from "../../contexts/WorkspaceContext";
import { apiRequest } from "../../utils/apiUtils";
// Import new components
import { CreateRoomModal } from '../../components/poker/CreateRoomModal';
import { RoomListTable, Room } from '../../components/poker/RoomListTable'; // Import Room type too
import { PokerLandingActions } from '../../components/poker/PokerLandingActions';

// Remove local Room interface if imported from RoomListTable
// interface Room { ... }

interface CreateRoomSettings {
    password?: string;
    sequence: SequenceType;
    roomName: string;
    workspaceId?: string;
}

const PlanningPoker: FC = () => {
    const [showRoomList, setShowRoomList] = useState(false);
    const [activeRooms, setActiveRooms] = useState<Room[]>([]);
    const [workspaceRooms, setWorkspaceRooms] = useState<Room[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isCreating, setIsCreating] = useState(false); // Loading state for creation
    const { colorMode } = useColorMode();
    const navigate = useNavigate();
    const toast = useToast();
    const { isOpen: isCreateModalOpen, onOpen: onCreateModalOpen, onClose: onCreateModalClose } = useDisclosure();
    const { isAuthenticated } = useAuth();
    const { currentWorkspace, workspaces } = useWorkspace();
    
    const [createSettings, setCreateSettings] = useState<CreateRoomSettings>({
        sequence: 'fibonacci',
        roomName: '',
        workspaceId: currentWorkspace?.id // Initialize with current workspace
    });

     // Update workspaceId in createSettings when currentWorkspace changes
     useEffect(() => {
        setCreateSettings(prev => ({
            ...prev,
            // Reset room name when workspace changes? Optional.
            // roomName: '', 
            workspaceId: currentWorkspace?.id || undefined
        }));
    }, [currentWorkspace]);

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
    };

    // Load rooms function using useCallback
    const loadRooms = useCallback(async () => {
        setIsLoading(true);
        try {
            // Load public rooms (always load)
            const publicRooms = await apiRequest<Room[]>('/poker/rooms', { includeAuth: false });
            setActiveRooms(publicRooms);
            
            // Load workspace rooms only if authenticated and have a workspace context
            if (isAuthenticated && currentWorkspace) {
                 try {
                    // Use the dedicated workspace endpoint
                    const wsRooms = await apiRequest<Room[]>(`/workspaces/${currentWorkspace.id}/rooms`);
                    setWorkspaceRooms(wsRooms);
                 } catch (wsError) {
                     console.error("Error loading workspace rooms:", wsError);
                     // Don't necessarily show a toast for this, maybe workspace has no rooms
                     setWorkspaceRooms([]); // Reset to empty array on error
                 }
            } else {
                setWorkspaceRooms([]); // Clear workspace rooms if not authenticated or no workspace
            }
        } catch (error) {
            console.error("Error loading public rooms:", error);
            toast({
                title: 'Error',
                description: 'Failed to load public rooms',
                status: 'error',
                duration: 3000,
            });
        } finally {
            setIsLoading(false);
        }
    }, [isAuthenticated, currentWorkspace, toast]); // Dependencies for loadRooms

    // Load rooms on mount and when auth/workspace changes
    useEffect(() => {
        loadRooms();
    }, [loadRooms]); // useEffect depends on the memoized loadRooms

    const handleCreateSettingsChange = useCallback((newSettings: Partial<CreateRoomSettings>) => {
        setCreateSettings(prev => ({ ...prev, ...newSettings }));
    }, []);

    const handleCreateRoom = async () => {
        // Validate room name only if creating within a workspace
        if (isAuthenticated && createSettings.workspaceId && !createSettings.roomName.trim()) {
            toast({
                title: 'Room Name Required',
                description: 'Please enter a name for your workspace room',
                status: 'warning',
                duration: 3000,
            });
            return;
        }
        
        const newRoomId = Math.random().toString(36).substring(2, 8);
        setIsCreating(true);
        try {
            // Use authentication only if creating in a workspace
            const includeAuth = !!(isAuthenticated && createSettings.workspaceId);
            
            await apiRequest('/poker/rooms', { 
                method: 'POST',
                body: {
                    roomId: newRoomId,
                    // Use name from settings, default if public and empty
                    name: createSettings.roomName.trim() || `Room ${newRoomId}`, 
                    workspaceId: createSettings.workspaceId,
                    sequence: createSettings.sequence,
                    password: createSettings.password
                },
                includeAuth // Send token only if workspaceId is set
            });
            
            toast({
                title: 'Room Created',
                description: `Room "${createSettings.roomName.trim() || newRoomId}" created.`,
                status: 'success',
                duration: 2000,
            });
            
            onCreateModalClose();
            navigate(`/planning-poker/${newRoomId}`); // Navigate to the new room
        } catch (error) {
            toast({
                title: 'Error Creating Room',
                description: error instanceof Error ? error.message : 'Failed to create new room',
                status: 'error',
                duration: 3000,
            });
        } finally {
            setIsCreating(false);
        }
    };

    const handleJoinRoom = (roomId: string) => {
        navigate(`/planning-poker/${roomId}`);
    };

    // Show loading spinner while workspaces are loading for authenticated users
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
            <Box bg={colorMode === 'light' ? 'gray.50' : 'gray.900'} minH="calc(100vh - 60px)" py={8}>
                <VStack spacing={{ base: 4, md: 8 }}>
                    <Box textAlign="center" w="full" px={4}>
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
                           <PokerLandingActions
                                isAuthenticated={isAuthenticated}
                                currentWorkspace={currentWorkspace}
                                workspaceRooms={workspaceRooms}
                                onShowRoomList={() => setShowRoomList(true)}
                                onCreateModalOpen={onCreateModalOpen}
                                onJoinRoom={handleJoinRoom}
                           />
                        </Center>
                    ) : (
                        <Box
                            w="full"
                            maxW="container.lg" // Limit width for better table view
                            mx="auto" // Center the box
                            p={{ base: 4, md: 8 }}
                            borderRadius="lg"
                            bg={colorMode === 'light' ? 'white' : 'gray.700'}
                            shadow="md"
                        >
                            <VStack spacing={6}>
                                <HStack w="full" justify="space-between">
                                    <Heading size="md">Join a Room</Heading>
                                    <Button size="sm" onClick={() => setShowRoomList(false)}>
                                        Back
                                    </Button>
                                </HStack>
                                
                                {/* Workspace Rooms Table */}
                                {isAuthenticated && currentWorkspace && (
                                    <RoomListTable
                                        title="Workspace Rooms"
                                        rooms={workspaceRooms}
                                        onJoinRoom={handleJoinRoom}
                                        showWorkspaceInfo={true}
                                        workspaceName={currentWorkspace.name}
                                    />
                                )}
                                
                                {/* Public Rooms Table */}
                                <RoomListTable
                                    title="Public Rooms"
                                    rooms={activeRooms}
                                    onJoinRoom={handleJoinRoom}
                                />
                            </VStack>
                        </Box>
                    )}

                   <CreateRoomModal
                        isOpen={isCreateModalOpen}
                        onClose={onCreateModalClose}
                        onSubmit={handleCreateRoom}
                        settings={createSettings}
                        onSettingsChange={handleCreateSettingsChange}
                        workspaces={workspaces}
                        isLoading={isCreating}
                   />

                    <Divider my={8} />

                    <SeoText sections={planningPokerSeoSections} />
                </VStack>
            </Box>
        </PageContainer>
    );
};

export default PlanningPoker;
