import { FC, useState, useEffect } from 'react'
import {
    Container,
    Heading,
    VStack,
    Button,
    useToast,
    FormControl,
    FormLabel,
    Input,
    Grid,
    GridItem,
    Card,
    CardBody,
    Text,
    HStack,
    Divider,
    useDisclosure,
    FormErrorMessage,
    Badge,
    Flex,
    Spacer,
    Spinner,
    Box,
    Alert,
    AlertIcon,
    AlertDescription,
} from '@chakra-ui/react'
import PageContainer from "../../components/PageContainer";
import PageHelmet from "../../components/PageHelmet";
import SeoText from "../../components/SeoText";
import { AddSprintModal } from "../../components/modals";
import { VelocityChart, VelocityStats } from "../../components/velocity";
import {
  teamVelocitySeo,
  teamVelocitySeoSections,
} from "../../content/teamVelocitySeo";
import config from "../../config";
import { useAuth } from "../../contexts/AuthContext";
import { useWorkspace } from "../../contexts/WorkspaceContext";
import { apiRequest } from "../../utils/apiUtils";

interface SprintData {
    sprint_name: string
    committed_points: number
    completed_points: number
    start_date: string
    end_date: string
}

interface TeamAverages {
    average_velocity: number
    average_commitment: number
    completion_rate: number
}

interface FormErrors {
    teamName?: string
    teamPassword?: string
}

interface WorkspaceMember {
    id: string
    name: string
    email: string
    role: string
}

const TeamVelocity: FC = () => {
    const { isAuthenticated } = useAuth()
    const { currentWorkspace, getWorkspaceMembers } = useWorkspace()
    const [workspaceMembers, setWorkspaceMembers] = useState<WorkspaceMember[]>([])
    const [_isLoadingMembers, setIsLoadingMembers] = useState(false)
    
    const [teamName, setTeamName] = useState('')
    const [teamPassword, setTeamPassword] = useState('')
    const [sprintName, setSprintName] = useState('')
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')
    const [committedPoints, setCommittedPoints] = useState('')
    const [completedPoints, setCompletedPoints] = useState('')
    const [velocityData, setVelocityData] = useState<SprintData[]>([])
    const [averages, setAverages] = useState<TeamAverages | null>(null)
    const [isTeamLoaded, setIsTeamLoaded] = useState(false)
    const [formErrors, setFormErrors] = useState<FormErrors>({})
    const { isOpen: isAddSprintOpen, onOpen: onAddSprintOpen, onClose: onAddSprintClose } = useDisclosure()
    const toast = useToast()

    // Load workspace members when current workspace changes
    useEffect(() => {
        if (isAuthenticated && currentWorkspace) {
            loadWorkspaceMembers();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAuthenticated, currentWorkspace]);

    // Load workspace members
    const loadWorkspaceMembers = async () => {
        if (!currentWorkspace) return;
        
        setIsLoadingMembers(true);
        try {
            const members = await getWorkspaceMembers(currentWorkspace.id);
            setWorkspaceMembers(members);
            
            // If we have a workspace, let's automatically create/load a team with the workspace name
            if (!isTeamLoaded) {
                setTeamName(currentWorkspace.name);
                setTeamPassword(currentWorkspace.name);
                // We'll auto-load the team if authenticated and have a workspace
                handleCreateOrLoadTeam(currentWorkspace.name, currentWorkspace.name);
            }
        } catch (error) {
            console.error('Error loading workspace members:', error);
            toast({
                title: 'Error',
                description: 'Failed to load workspace members',
                status: 'error',
                duration: 3000,
            });
        } finally {
            setIsLoadingMembers(false);
        }
    };

    const validateTeamForm = (): boolean => {
        const errors: FormErrors = {}
        let isValid = true

        if (!teamName.trim()) {
            errors.teamName = 'Team name is required'
            isValid = false
        } else if (teamName.length < 3) {
            errors.teamName = 'Team name must be at least 3 characters'
            isValid = false
        }

        if (!teamPassword.trim()) {
            errors.teamPassword = 'Password is required'
            isValid = false
        } else if (teamPassword.length < 6) {
            errors.teamPassword = 'Password must be at least 6 characters'
            isValid = false
        }

        setFormErrors(errors)
        return isValid
    }

    const handleCreateOrLoadTeam = async (name = teamName, password = teamPassword) => {
        if (!name || !password) {
            if (!validateTeamForm()) {
                return;
            }
        }

        try {
            // If authenticated, use API with authentication
            let response;
            if (isAuthenticated) {
                response = await apiRequest('/velocity/teams', { // Use correct prefix
                    method: 'POST',
                    body: {
                        name: name,
                        password: password,
                        workspace_id: currentWorkspace?.id
                    }
                });
            } else {
                // Legacy non-authenticated flow
                response = await fetch(`${config.apiUrl}/velocity/teams`, { // Use correct prefix
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        name: name,
                        password: password,
                    }),
                });
                response = await response.json();
            }

            if (response.success) {
                setIsTeamLoaded(true)
                setTeamName(name);
                setTeamPassword(password);
                setFormErrors({})
                toast({
                    title: 'Team loaded successfully',
                    status: 'success',
                    duration: 3000,
                })
                loadTeamData(name, password)
            }
        } catch (error) {
            toast({
                title: 'Error',
                description: error instanceof Error ? error.message : 'Unknown error occurred',
                status: 'error',
                duration: 3000,
            })
        }
    }

    const handleAddSprint = async (data: {
        sprintName: string
        startDate: string
        endDate: string
        committedPoints: string
        completedPoints: string
    }) => {
        if (!isTeamLoaded) {
            toast({
                title: 'Error',
                description: 'Please create or load a team first',
                status: 'error',
                duration: 3000,
            })
            return
        }

        try {
            // Create sprint
            let sprintData;
            
            if (isAuthenticated) {
                // Use authenticated API
                sprintData = await apiRequest(`/velocity/teams/${teamName}/sprints`, { // Use correct prefix
                    method: 'POST',
                    body: {
                        sprintName: data.sprintName,
                        startDate: data.startDate,
                        endDate: data.endDate,
                        workspaceId: currentWorkspace?.id
                    }
                });
            } else {
                // Legacy non-authenticated flow
                const sprintResponse = await fetch(
                    `${config.apiUrl}/velocity/teams/${teamName}/sprints?password=${teamPassword}`, // Use correct prefix
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            sprintName: data.sprintName,
                            startDate: data.startDate,
                            endDate: data.endDate,
                        }),
                    }
                );

                if (!sprintResponse.ok) {
                    const errorData = await sprintResponse.json();
                    throw new Error(errorData.error || 'Failed to create sprint');
                }

                sprintData = await sprintResponse.json();
            }

            // Update velocity
            if (isAuthenticated) {
                // Use authenticated API
                await apiRequest(`/velocity/sprints/${sprintData.id}/velocity`, { // Use correct prefix
                    method: 'PUT',
                    body: {
                        committedPoints: parseInt(data.committedPoints),
                        completedPoints: parseInt(data.completedPoints),
                    }
                });
            } else {
                // Legacy non-authenticated flow
                const velocityResponse = await fetch(`${config.apiUrl}/velocity/sprints/${sprintData.id}/velocity`, { // Use correct prefix
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        committedPoints: parseInt(data.committedPoints),
                        completedPoints: parseInt(data.completedPoints),
                    }),
                });

                if (!velocityResponse.ok) {
                    const errorData = await velocityResponse.json();
                    throw new Error(errorData.error || 'Failed to update velocity');
                }
            }

            toast({
                title: 'Sprint data added successfully',
                status: 'success',
                duration: 3000,
            })
            loadTeamData()
            onAddSprintClose()

            // Reset form
            setSprintName('')
            setStartDate('')
            setEndDate('')
            setCommittedPoints('')
            setCompletedPoints('')
        } catch (error) {
            toast({
                title: 'Error',
                description: error instanceof Error ? error.message : 'Unknown error occurred',
                status: 'error',
                duration: 3000,
            })
        }
    }

    const loadTeamData = async (name = teamName, password = teamPassword) => {
        if (!name || !password) {
            console.warn('Attempted to load team data without name or password');
            return;
        }
        
        try {
            let data;
            
            if (isAuthenticated && currentWorkspace) {
                // Use authenticated API with workspace
                data = await apiRequest(`/velocity/teams/${name}/velocity`, { // Use correct prefix
                    method: 'GET',
                    headers: {
                        'workspace-id': currentWorkspace.id
                    }
                });
            } else if (isAuthenticated) {
                // Authenticated but no workspace
                data = await apiRequest(`/velocity/teams/${name}/velocity`); // Use correct prefix
            } else {
                // Legacy non-authenticated flow
                const response = await fetch(
                    `${config.apiUrl}/velocity/teams/${name}/velocity?password=${password}` // Use correct prefix
                );
                
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Failed to load team data');
                }
                
                data = await response.json();
            }

            if (data && data.sprints) {
                setVelocityData(data.sprints);
                setAverages(data.averages || null);
                setIsTeamLoaded(true);
            } else {
                throw new Error('Invalid data format received from server');
            }
        } catch (error) {
            console.error('Error loading team data:', error);
            toast({
                title: 'Error',
                description: error instanceof Error ? error.message : 'Unknown error occurred',
                status: 'error',
                duration: 3000,
            });
            
            // Reset team state on error
            setIsTeamLoaded(false);
            setVelocityData([]);
            setAverages(null);
            
            // Clear localStorage on error
            localStorage.removeItem('velocityTeamName');
            localStorage.removeItem('velocityTeamPassword');
            localStorage.removeItem('velocityTeamLoaded');
        }
    }

    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        "name": "Team Velocity Tracker",
        "applicationCategory": "BusinessApplication",
        "operatingSystem": "Any",
        "description": teamVelocitySeo.description,
        "offers": {
            "@type": "Offer",
            "price": "0",
            "priceCurrency": "USD"
        },
        "featureList": teamVelocitySeo.content.features
    }

    return (
        <PageContainer>
            <PageHelmet
                title={teamVelocitySeo.title}
                description={teamVelocitySeo.description}
                keywords={teamVelocitySeo.keywords}
                canonicalUrl={`${config.siteUrl}/velocity`}
                jsonLd={jsonLd}
            />
            <Container maxW="container.xl" py={8}>
                <VStack spacing={8} align="stretch">
                    <VStack spacing={4} align="center" textAlign="center">
                        <Heading as="h1" size="xl">
                            {teamVelocitySeo.content.heading}
                        </Heading>
                        <Text fontSize="lg" color="gray.600">
                            {teamVelocitySeo.content.subheading}
                        </Text>
                    </VStack>

                    {isAuthenticated && currentWorkspace && isTeamLoaded ? (
                        // Authenticated workspace view
                        <Card>
                            <CardBody>
                                <VStack spacing={4}>
                                    <Flex width="100%" alignItems="center">
                                        <Heading size="md">Workspace: {currentWorkspace.name}</Heading>
                                        <Spacer />
                                        {isTeamLoaded ? (
                                            <Button colorScheme="green" onClick={onAddSprintOpen}>
                                                Add Sprint Data
                                            </Button>
                                        ) : (
                                            <Spinner />
                                        )}
                                    </Flex>

                                    {isTeamLoaded && workspaceMembers.length > 0 && (
                                        <Box width="100%">
                                            <Text fontWeight="bold" mb={2}>Team Members:</Text>
                                            <Grid templateColumns="repeat(auto-fill, minmax(200px, 1fr))" gap={3}>
                                                {workspaceMembers.map(member => (
                                                    <GridItem key={member.id}>
                                                        <Badge colorScheme="blue" px={2} py={1}>
                                                            {member.name} ({member.role})
                                                        </Badge>
                                                    </GridItem>
                                                ))}
                                            </Grid>
                                        </Box>
                                    )}
                                </VStack>
                            </CardBody>
                        </Card>
                    ) : (
                        // Anonymous view - Team Setup
                        <Card>
                            <CardBody>
                                <VStack spacing={4}>
                                    <Grid templateColumns="repeat(2, 1fr)" gap={4} width="100%">
                                        <GridItem>
                                            <FormControl isInvalid={!!formErrors.teamName}>
                                                <FormLabel>Team Name</FormLabel>
                                                <Input
                                                    value={teamName}
                                                    onChange={(e) => {
                                                        setTeamName(e.target.value)
                                                        setFormErrors(prev => ({ ...prev, teamName: undefined }))
                                                    }}
                                                    placeholder="Enter team name"
                                                    isDisabled={isTeamLoaded}
                                                />
                                                <FormErrorMessage>{formErrors.teamName}</FormErrorMessage>
                                            </FormControl>
                                        </GridItem>
                                        <GridItem>
                                            <FormControl isInvalid={!!formErrors.teamPassword}>
                                                <FormLabel>Team Password</FormLabel>
                                                <Input
                                                    type="password"
                                                    value={teamPassword}
                                                    onChange={(e) => {
                                                        setTeamPassword(e.target.value)
                                                        setFormErrors(prev => ({ ...prev, teamPassword: undefined }))
                                                    }}
                                                    placeholder="Enter team password"
                                                    isDisabled={isTeamLoaded}
                                                />
                                                <FormErrorMessage>{formErrors.teamPassword}</FormErrorMessage>
                                            </FormControl>
                                        </GridItem>
                                    </Grid>
                                    <HStack spacing={4}>
                                        {!isTeamLoaded ? (
                                            <Button colorScheme="blue" onClick={() => handleCreateOrLoadTeam()}>
                                                Create/Load Team
                                            </Button>
                                        ) : (
                                            <>
                                                <Button colorScheme="green" onClick={onAddSprintOpen}>
                                                    Add Sprint Data
                                                </Button>
                                                <Button
                                                    colorScheme="blue"
                                                    variant="outline"
                                                    onClick={() => {
                                                        // Clear state
                                                        setIsTeamLoaded(false)
                                                        setTeamName('')
                                                        setTeamPassword('')
                                                        setVelocityData([])
                                                        setAverages(null)
                                                        setFormErrors({})
                                                        
                                                        // Clear localStorage items
                                                        localStorage.removeItem('velocityTeamName')
                                                        localStorage.removeItem('velocityTeamPassword')
                                                        localStorage.removeItem('velocityTeamLoaded')
                                                    }}
                                                >
                                                    Change Team
                                                </Button>
                                            </>
                                        )}
                                    </HStack>
                                </VStack>
                            </CardBody>
                        </Card>
                    )}

                    {/* Statistics */}
                    {averages && <VelocityStats averages={averages} />}

                    {/* Velocity Chart */}
                    {velocityData.length > 0 && <VelocityChart velocityData={velocityData} />}

                    {/* No data view */}
                    {isTeamLoaded && velocityData.length === 0 && (
                        <Alert status="info" borderRadius="md">
                            <AlertIcon />
                            <AlertDescription>
                                No sprint data available. Add your first sprint to see velocity metrics.
                            </AlertDescription>
                        </Alert>
                    )}

                    <Divider my={8} />

                    <SeoText sections={teamVelocitySeoSections} />
                </VStack>
            </Container>

            <AddSprintModal
                isOpen={isAddSprintOpen}
                onClose={onAddSprintClose}
                onSubmit={handleAddSprint}
                sprintName={sprintName}
                startDate={startDate}
                endDate={endDate}
                committedPoints={committedPoints}
                completedPoints={completedPoints}
                onSprintNameChange={setSprintName}
                onStartDateChange={setStartDate}
                onEndDateChange={setEndDate}
                onCommittedPointsChange={setCommittedPoints}
                onCompletedPointsChange={setCompletedPoints}
            />
        </PageContainer>
    )
}

export default TeamVelocity
