import { FC, useState, useEffect, useCallback, Suspense, lazy } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'; // Import mutation hooks
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
  Spinner,
} from '@chakra-ui/react';
import PageContainer from '../../components/PageContainer';
import PageHelmet from '../../components/PageHelmet';
import SeoText from '../../components/SeoText';
import { planningPokerSeoSections } from '../../content/planningPokerSeo';
import { SequenceType } from '../../constants/poker'; // Keep SequenceType
import config from '../../config';
import { useAuth } from '../../contexts/AuthContext';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { apiRequest } from '../../utils/apiUtils';
// Import new components
import { RoomListTable, Room } from '../../components/poker/RoomListTable'; // Import Room type too
import { PokerLandingActions } from '../../components/poker/PokerLandingActions';

// Lazy load modal component
const CreateRoomModal = lazy(() =>
  import('../../components/poker/CreateRoomModal').then(module => ({
    default: module.CreateRoomModal,
  }))
);

// Modal loading component for poker
const PokerModalLoadingSpinner: FC = () => (
  <Center h="300px">
    <Spinner size="lg" color="blue.500" />
  </Center>
);

interface CreateRoomSettings {
  password?: string;
  sequence: SequenceType;
  roomName: string;
  workspaceId?: string;
}

const PlanningPoker: FC = () => {
  const [showRoomList, setShowRoomList] = useState(false);
  // Remove useState for rooms and isLoading, they will come from useQuery
  // const [rooms, setRooms] = useState<Room[]>([]);
  // const [isLoading, setIsLoading] = useState(false);
  // Remove isCreating state, use state from useMutation
  // const [isCreating, setIsCreating] = useState(false);
  const { colorMode } = useColorMode();
  const navigate = useNavigate();
  const toast = useToast();
  const {
    isOpen: isCreateModalOpen,
    onOpen: onCreateModalOpen,
    onClose: onCreateModalClose,
  } = useDisclosure();
  const { isAuthenticated } = useAuth();
  // Keep workspaces for the modal, currentWorkspace for API calls
  const { currentWorkspace, workspaces } = useWorkspace();

  const [createSettings, setCreateSettings] = useState<CreateRoomSettings>({
    sequence: 'fibonacci',
    roomName: '',
    workspaceId: currentWorkspace?.id, // Initialize with current workspace
  });

  // Update workspaceId in createSettings when currentWorkspace changes
  useEffect(() => {
    setCreateSettings(prev => ({
      ...prev,
      // Reset room name when workspace changes? Optional.
      // roomName: '',
      workspaceId: currentWorkspace?.id || undefined,
    }));
  }, [currentWorkspace]);

  // --- React Query for fetching rooms ---
  const queryKey = ['pokerRooms', { workspaceId: currentWorkspace?.id }];

  const fetchRooms = async (): Promise<Room[]> => {
    const headers = currentWorkspace ? { 'workspace-id': currentWorkspace.id } : undefined;
    // Let apiRequest handle auth based on token presence
    return await apiRequest<Room[]>('/poker/rooms', { headers });
  };

  const {
    data: rooms = [], // Default to empty array
    isLoading, // Use isLoading from useQuery
    isError,
    error,
  } = useQuery<Room[], Error>({
    // Specify types for data and error
    queryKey: queryKey,
    queryFn: fetchRooms,
    // Optional: Add staleTime or cacheTime if needed
    // staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Effect to show toast on error
  useEffect(() => {
    if (isError && error) {
      console.error('Error loading rooms:', error);
      toast({
        title: 'Error Loading Rooms',
        description: error.message || 'Failed to load poker rooms',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  }, [isError, error, toast]);
  // --- End React Query ---

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Planning Poker - Online Estimation Tool',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Any',
    description:
      'Free online Planning Poker tool for agile teams. Real-time story point estimation with your team. No registration required.',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    featureList: [
      'Real-time team collaboration',
      'Multiple estimation sequences',
      'Password-protected rooms',
      'Instant voting results',
      'No registration required',
    ],
  };

  // Remove loadRooms and the useEffect that calls it

  const handleCreateSettingsChange = useCallback((newSettings: Partial<CreateRoomSettings>) => {
    setCreateSettings(prev => ({ ...prev, ...newSettings }));
  }, []);

  // --- React Query Mutation for creating a room ---
  const queryClient = useQueryClient(); // Get query client instance

  const createRoomMutation = useMutation<
    void, // Type of the data returned by the mutation function (void in this case)
    Error, // Type of the error
    { newRoomId: string } // Type of the variables passed to the mutation function
  >({
    mutationFn: async ({ newRoomId }) => {
      // Use authentication only if creating in a workspace
      const includeAuth = !!(isAuthenticated && createSettings.workspaceId);
      await apiRequest('/poker/rooms', {
        method: 'POST',
        body: {
          roomId: newRoomId,
          name: createSettings.roomName.trim() || `Room ${newRoomId}`,
          workspaceId: createSettings.workspaceId,
          sequence: createSettings.sequence,
          password: createSettings.password,
        },
        includeAuth,
      });
    },
    onSuccess: (_, variables) => {
      // Invalidate the rooms query to refetch the list
      queryClient.invalidateQueries({ queryKey: queryKey });

      toast({
        title: 'Room Created',
        description: `Room "${createSettings.roomName.trim() || variables.newRoomId}" created.`,
        status: 'success',
        duration: 2000,
      });
      onCreateModalClose();
      navigate(`/planning-poker/${variables.newRoomId}`); // Navigate after success
    },
    onError: error => {
      toast({
        title: 'Error Creating Room',
        description: error.message || 'Failed to create new room',
        status: 'error',
        duration: 3000,
      });
    },
  });
  // --- End React Query Mutation ---

  const handleCreateRoomSubmit = () => {
    // Renamed original function
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
    createRoomMutation.mutate({ newRoomId }); // Call the mutation
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
            <Heading as="h1" size={{ base: 'lg', md: 'xl' }} mb={4}>
              Online Planning Poker - Free Story Point Estimation Tool
            </Heading>
          </Box>

          {!showRoomList ? (
            <Center p={8}>
              <PokerLandingActions
                isAuthenticated={isAuthenticated}
                currentWorkspace={currentWorkspace}
                rooms={rooms} // Pass the unified rooms list
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
                  <Heading size="md">
                    {currentWorkspace ? `Rooms in ${currentWorkspace.name}` : 'Public Rooms'}
                  </Heading>
                  <Button size="sm" onClick={() => setShowRoomList(false)}>
                    Back
                  </Button>
                </HStack>

                {/* Single Room List Table */}
                {isLoading ? (
                  <Center h="100px">
                    <Spinner />
                  </Center>
                ) : (
                  <RoomListTable
                    title={currentWorkspace ? `Rooms in ${currentWorkspace.name}` : 'Public Rooms'} // Restore title prop
                    rooms={rooms}
                    onJoinRoom={handleJoinRoom}
                    // showWorkspaceInfo={!!currentWorkspace} // Keep commented out for now
                    // workspaceName={currentWorkspace?.name}
                  />
                )}
              </VStack>
            </Box>
          )}

          <Suspense fallback={<PokerModalLoadingSpinner />}>
            <CreateRoomModal
              isOpen={isCreateModalOpen}
              onClose={onCreateModalClose}
              onSubmit={handleCreateRoomSubmit} // Use the renamed submit handler
              settings={createSettings}
              onSettingsChange={handleCreateSettingsChange}
              workspaces={workspaces}
              isLoading={createRoomMutation.isPending} // Use loading state from mutation
            />
          </Suspense>

          <Divider my={8} />

          <SeoText sections={planningPokerSeoSections} />
        </VStack>
      </Box>
    </PageContainer>
  );
};

export default PlanningPoker;
