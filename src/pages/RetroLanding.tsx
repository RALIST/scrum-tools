import { FC, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    Box,
    Heading,
    Button,
    VStack,
    Text,
    useColorMode,
    Center,
    useToast,
    Input,
    Divider,
    FormControl,
    FormLabel,
    Modal,
    ModalOverlay,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
    useDisclosure,
    Select,
    HStack,
    Flex,
    Spacer,
    Spinner
} from '@chakra-ui/react'
import PageHelmet from '../components/PageHelmet'
import SeoText from '../components/SeoText'
import { retroBoardSeoSections } from '../content/retroBoardSeo'
import config from '../config'
import { useAuth } from '../contexts/AuthContext'
import { useWorkspace } from '../contexts/WorkspaceContext'
import { apiRequest } from '../utils/apiUtils'

interface RetroBoard {
    id: string;
    name: string;
    createdAt: string;
    workspace_id?: string;
    created_by?: string;
}

interface CreateBoardSettings {
    boardName: string;
    workspaceId?: string;
    password?: string;
    hideCardsByDefault?: boolean;
    hideAuthorNames?: boolean;
}

const RetroLanding: FC = () => {
    const { colorMode } = useColorMode()
    const navigate = useNavigate()
    const toast = useToast()
    const [joinBoardId, setJoinBoardId] = useState('')
    const [workspaceBoards, setWorkspaceBoards] = useState<RetroBoard[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const { isAuthenticated } = useAuth()
    const { currentWorkspace, workspaces } = useWorkspace()
    const { isOpen: isCreateModalOpen, onOpen: onCreateModalOpen, onClose: onCreateModalClose } = useDisclosure()
    
    const [createSettings, setCreateSettings] = useState<CreateBoardSettings>({
        boardName: '',
        workspaceId: currentWorkspace?.id,
        hideCardsByDefault: false,
        hideAuthorNames: false
    })

    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        "name": "Sprint Retrospective Board",
        "applicationCategory": "BusinessApplication",
        "operatingSystem": "Any",
        "description": "Free online retrospective board for agile teams. Collaborate with your team to identify what went well and what could be improved. Features include real-time voting, timer control, and card management.",
        "offers": {
            "@type": "Offer",
            "price": "0",
            "priceCurrency": "USD"
        },
        "featureList": [
            "Real-time team collaboration",
            "Three-column retro format",
            "Action item tracking",
            "Card voting system",
            "Timer control",
            "Card visibility toggle",
            "Author name management",
            "No registration required",
            "Instant board sharing",
            "Password protection option"
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

    // Load workspace boards
    useEffect(() => {
        const loadWorkspaceBoards = async () => {
            if (!isAuthenticated || !currentWorkspace) return;
            
            setIsLoading(true);
            try {
                const boards = await apiRequest<RetroBoard[]>(`/workspace/${currentWorkspace.id}/retros`);
                setWorkspaceBoards(boards);
            } catch (error) {
                console.error("Error loading workspace boards:", error);
            } finally {
                setIsLoading(false);
            }
        };
        
        loadWorkspaceBoards();
    }, [isAuthenticated, currentWorkspace]);

    const handleCreateBoard = async () => {
        // Validate board name if authenticated and in a workspace
        if (isAuthenticated && currentWorkspace && !createSettings.boardName.trim()) {
            toast({
                title: 'Board Name Required',
                description: 'Please enter a name for your board',
                status: 'warning',
                duration: 3000,
            });
            return;
        }
        
        try {
            setIsLoading(true);
            
            // Use authentication if we're creating in a workspace
            const includeAuth = !!(isAuthenticated && createSettings.workspaceId);
            
            const data = await apiRequest<{ boardId: string }>('/retro', {
                method: 'POST',
                body: {
                    name: createSettings.boardName || 'Retro Board',
                    workspace_id: createSettings.workspaceId,
                    password: createSettings.password,
                    hide_cards_by_default: createSettings.hideCardsByDefault,
                    hide_author_names: createSettings.hideAuthorNames
                },
                includeAuth
            });
            
            onCreateModalClose();
            navigate(`/retro/${data.boardId}`);
        } catch (error) {
            toast({
                title: 'Error',
                description: error instanceof Error ? error.message : 'Failed to create retro board',
                status: 'error',
                duration: 3000,
            });
        } finally {
            setIsLoading(false);
        }
    }

    const handleJoinBoard = () => {
        if (!joinBoardId.trim()) {
            toast({
                title: 'Error',
                description: 'Please enter a board ID',
                status: 'error',
                duration: 2000,
            })
            return
        }
        navigate(`/retro/${joinBoardId.trim()}`)
    }

    if (isAuthenticated && !workspaces) {
            return (
                  <Center h="200px">
                    <Spinner size="xl" color="blue.500" />
                  </Center>
                );
        }

    return (
        <>
            <PageHelmet
                title="Retro Board - Team Retrospective Tool"
                description="Free online retrospective board for agile teams. Collaborate with your team to identify what went well and what could be improved. Features include real-time voting, timer control, and card management."
                keywords="retro board, retrospective, agile retrospective, team collaboration, sprint retrospective, scrum ceremonies, voting, timer control, card management"
                canonicalUrl={`${config.siteUrl}/retro`}
                jsonLd={jsonLd}
            />
            <Box bg={colorMode === 'light' ? 'gray.50' : 'gray.900'} borderRadius="lg">
                <VStack spacing={{ base: 6, md: 8 }} align="stretch">
                    <Box textAlign="center" mb={{ base: 6, md: 8 }}>
                        <Heading
                            as="h1"
                            size={{ base: "xl", md: "2xl" }}
                            mb={{ base: 3, md: 4 }}
                            px={{ base: 2, md: 0 }}
                        >
                            Sprint Retrospective Board
                        </Heading>
                        <Text
                            fontSize={{ base: "lg", md: "xl" }}
                            color={colorMode === 'light' ? 'gray.600' : 'gray.300'}
                            px={{ base: 2, md: 0 }}
                        >
                            Collaborate with your team to improve your process
                        </Text>
                        <Text
                            fontSize={{ base: "md", md: "lg" }}
                            color={colorMode === 'light' ? 'gray.500' : 'gray.400'}
                            mt={2}
                            px={{ base: 2, md: 0 }}
                        >
                            Features: Real-time voting • Timer control • Card management
                        </Text>
                    </Box>

                    <Center p={8}>
                        <VStack spacing={6} w={{ base: "full", md: "500px" }}>
                            <Button
                                colorScheme="blue"
                                size="lg"
                                w="full"
                                onClick={onCreateModalOpen}
                                isLoading={isLoading}
                            >
                                Create New Board
                            </Button>
                            <Text textAlign="center">or</Text>
                            <VStack w="full" spacing={2}>
                                <Input
                                    placeholder="Enter board ID"
                                    value={joinBoardId}
                                    onChange={(e) => setJoinBoardId(e.target.value)}
                                    onKeyPress={(e) => {
                                        if (e.key === 'Enter') {
                                            handleJoinBoard()
                                        }
                                    }}
                                />
                                <Button
                                    colorScheme="green"
                                    size="lg"
                                    w="full"
                                    onClick={handleJoinBoard}
                                    isLoading={isLoading}
                                >
                                    Join Existing Board
                                </Button>
                            </VStack>
                            
                            {isAuthenticated && currentWorkspace && workspaceBoards.length > 0 && (
                                <Box w="full" mt={4}>
                                    <Text fontWeight="bold" mb={2}>Your Workspace Boards:</Text>
                                    <VStack 
                                        spacing={2} 
                                        align="stretch" 
                                        bg={colorMode === 'light' ? 'white' : 'gray.700'} 
                                        p={4} 
                                        borderRadius="md"
                                        shadow="sm"
                                    >
                                        {workspaceBoards.slice(0, 5).map(board => (
                                            <HStack key={board.id} justify="space-between">
                                                <Text fontWeight="medium">{board.name}</Text>
                                                <Button 
                                                    size="sm" 
                                                    colorScheme="blue" 
                                                    onClick={() => navigate(`/retro/${board.id}`)}
                                                >
                                                    Open
                                                </Button>
                                            </HStack>
                                        ))}
                                        {workspaceBoards.length > 5 && (
                                            <Button 
                                                size="sm" 
                                                variant="link" 
                                                colorScheme="blue"
                                                alignSelf="flex-end"
                                            >
                                                View more workspace boards
                                            </Button>
                                        )}
                                    </VStack>
                                </Box>
                            )}
                        </VStack>
                    </Center>
                    
                    {/* Create Board Modal */}
                    <Modal isOpen={isCreateModalOpen} onClose={onCreateModalClose}>
                        <ModalOverlay />
                        <ModalContent mx={4}>
                            <ModalHeader>Create Retrospective Board</ModalHeader>
                            <ModalBody>
                                <VStack spacing={4}>
                                    {isAuthenticated && (
                                        <>
                                            <FormControl isRequired={isAuthenticated && !!currentWorkspace}>
                                                <FormLabel>Board Name</FormLabel>
                                                <Input
                                                    placeholder="Enter board name"
                                                    value={createSettings.boardName}
                                                    onChange={(e) => setCreateSettings(prev => ({
                                                        ...prev,
                                                        boardName: e.target.value
                                                    }))}
                                                />
                                            </FormControl>
                                            
                                            {workspaces && workspaces.length > 0 && (
                                                <FormControl>
                                                    <FormLabel>Workspace (Optional)</FormLabel>
                                                    <Select
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
                                                        Workspace boards are only visible to workspace members
                                                    </Text>
                                                </FormControl>
                                            )}
                                        </>
                                    )}
                                    
                                    <FormControl>
                                        <FormLabel>Board Password (Optional)</FormLabel>
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
                                    
                                    <FormControl>
                                        <FormLabel>Board Settings</FormLabel>
                                        <VStack align="start" spacing={2}>
                                            <Flex w="full">
                                                <Text>Hide cards by default</Text>
                                                <Spacer />
                                                <input 
                                                    type="checkbox" 
                                                    checked={createSettings.hideCardsByDefault}
                                                    onChange={(e) => setCreateSettings(prev => ({
                                                        ...prev,
                                                        hideCardsByDefault: e.target.checked
                                                    }))}
                                                />
                                            </Flex>
                                            <Flex w="full">
                                                <Text>Hide author names</Text>
                                                <Spacer />
                                                <input 
                                                    type="checkbox" 
                                                    checked={createSettings.hideAuthorNames}
                                                    onChange={(e) => setCreateSettings(prev => ({
                                                        ...prev,
                                                        hideAuthorNames: e.target.checked
                                                    }))}
                                                />
                                            </Flex>
                                        </VStack>
                                    </FormControl>
                                </VStack>
                            </ModalBody>
                            <ModalFooter>
                                <Button variant="ghost" mr={3} onClick={onCreateModalClose}>
                                    Cancel
                                </Button>
                                <Button 
                                    colorScheme="blue" 
                                    onClick={handleCreateBoard}
                                    isLoading={isLoading}
                                >
                                    Create Board
                                </Button>
                            </ModalFooter>
                        </ModalContent>
                    </Modal>

                    <Divider my={8} />

                    <SeoText sections={retroBoardSeoSections} />
                </VStack>
            </Box>
        </>
    )
}

export default RetroLanding
