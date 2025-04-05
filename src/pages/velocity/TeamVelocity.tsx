import { FC, useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"; // Import useMutation
import {
  Container,
  Heading,
  VStack,
  useToast,
  Text,
  Divider,
  useDisclosure,
  Spinner,
  Alert,
  AlertIcon,
  AlertDescription,
  Center,
} from "@chakra-ui/react";
import PageContainer from "../../components/PageContainer";
import PageHelmet from "../../components/PageHelmet";
import SeoText from "../../components/SeoText";
import { AddSprintModal } from "../../components/modals";
import {
  VelocityChart,
  VelocityStats,
  TeamSetupForm,
  WorkspaceTeamHeader,
} from "../../components/velocity";
import {
  teamVelocitySeo,
  teamVelocitySeoSections,
} from "../../content/teamVelocitySeo";
import config from "../../config";
import { useAuth } from "../../contexts/AuthContext";
import { useWorkspace } from "../../contexts/WorkspaceContext";
import { apiRequest } from "../../utils/apiUtils"; // Import AuthError

interface SprintData {
  sprint_id: string; // Assuming API returns sprint_id now
  sprint_name: string;
  committed_points: number;
  completed_points: number;
  start_date: string;
  end_date: string;
  team_id: string;
}

interface TeamAverages {
  average_velocity: number;
  average_commitment: number;
  completion_rate: number;
}

interface FormErrors {
  teamName?: string;
  teamPassword?: string;
}

interface WorkspaceMember {
  id: string;
  name: string;
  email: string;
  role: string;
}

const TeamVelocity: FC = () => {
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth(); // Get loading state
  const {
    currentWorkspace,
    getWorkspaceMembers,
    isLoading: isWorkspaceLoading,
  } = useWorkspace(); // Get loading state
  const [workspaceMembers, setWorkspaceMembers] = useState<WorkspaceMember[]>(
    []
  );
  const [_isLoadingMembers, setIsLoadingMembers] = useState(false);

  // State for anonymous team setup
  const [teamName, setTeamName] = useState("");
  const [teamPassword, setTeamPassword] = useState("");
  const [formErrors, setFormErrors] = useState<FormErrors>({});

  // State for sprint data form (used by modal)
  const [sprintName, setSprintName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [committedPoints, setCommittedPoints] = useState("");
  const [completedPoints, setCompletedPoints] = useState("");

  // Restore useState for velocity data and averages for anonymous mode
  const [anonVelocityData, setAnonVelocityData] = useState<SprintData[]>([]);
  const [anonAverages, setAnonAverages] = useState<TeamAverages | null>(null);
  const [isTeamLoaded, setIsTeamLoaded] = useState(false);

  const {
    isOpen: isAddSprintOpen,
    onOpen: onAddSprintOpen,
    onClose: onAddSprintClose,
  } = useDisclosure();
  const toast = useToast();
  const queryClient = useQueryClient(); // Get client instance

  // Determine the effective team name (from workspace or state)
  const effectiveTeamName = currentWorkspace ? currentWorkspace.name : teamName;

  // Load workspace members when current workspace changes
  const loadWorkspaceMembers = useCallback(async () => {
    if (!isAuthenticated || !currentWorkspace) {
      setWorkspaceMembers([]);
      return;
    }

    setIsLoadingMembers(true);
    try {
      // Assuming getWorkspaceMembers is now potentially using React Query or similar
      // If it's still a direct function call, this is fine.
      const members = await getWorkspaceMembers(currentWorkspace.id);
      setWorkspaceMembers(members);
    } catch (error) {
      console.error("Error loading workspace members:", error);
      // Optional: Show toast for member loading error
    } finally {
      setIsLoadingMembers(false);
    }
  }, [isAuthenticated, currentWorkspace, getWorkspaceMembers]);

  useEffect(() => {
    loadWorkspaceMembers();
  }, [loadWorkspaceMembers]);

  // --- React Query for fetching team velocity data ---
  const teamVelocityQueryKey = [
    "teamVelocity",
    { teamName: effectiveTeamName, workspaceId: currentWorkspace?.id },
  ];

  const fetchTeamVelocityData = async (): Promise<{
    sprints: SprintData[];
    averages: TeamAverages;
  }> => {
    if (!effectiveTeamName) {
      throw new Error("Team name is required to fetch velocity data.");
    }

    const endpoint = `/velocity/teams/${effectiveTeamName}/velocity`;
    let options: any = { method: "GET" };

    if (currentWorkspace) {
      options.headers = { "workspace-id": currentWorkspace.id };
    } else {
      if (!teamPassword) {
        // This condition should ideally not be met if 'enabled' works correctly
        throw new Error("Password required for anonymous team lookup.");
      }
      options.includeAuth = false;
      options.queryParams = { password: teamPassword };
    }

    return await apiRequest<{ sprints: SprintData[]; averages: TeamAverages }>(
      endpoint,
      options
    );
  };

  const {
    data: teamData,
    isLoading: isLoadingData, // Use isLoading from useQuery
    isError: isDataError,
    error: dataError,
    isSuccess: isDataSuccess, // Use isSuccess flag
  } = useQuery<{ sprints: SprintData[]; averages: TeamAverages }, Error>({
    queryKey: teamVelocityQueryKey,
    queryFn: fetchTeamVelocityData,
    // Enable query only when in workspace mode AND team is considered loaded
    enabled: !!currentWorkspace && isTeamLoaded,
    retry: 1,
  });

  // --- Mutation for creating/checking anonymous team ---
  // Define this mutation before it's used in isLoadingDisplayData and handleCreateOrLoadTeam
  const createOrLoadTeamMutation = useMutation<
    {
      success: boolean;
      team: any;
      sprints: SprintData[];
      averages: TeamAverages;
    },
    Error,
    { name: string; password: string }
  >({
    mutationFn: async (variables) => {
      return await apiRequest<{
        success: boolean;
        team: any;
        sprints: SprintData[];
        averages: TeamAverages;
      }>(`/velocity/teams`, {
        method: "POST",
        body: variables,
        includeAuth: false,
      });
    },
    onSuccess: (data) => {
      // Receive data in onSuccess
      toast({
        title: "Team Ready",
        description: "Team found or created successfully.", // Simplified message
        status: "success", // Use success status
        duration: 2000,
      });
      // Set isTeamLoaded to true AFTER the POST request succeeds
      setIsTeamLoaded(true);
      setFormErrors({}); // Clear errors
      // Save the returned data to local state for anonymous mode
      setAnonVelocityData(data.sprints || []);
      setAnonAverages(data.averages || null);
    },
    onError: (error) => {
      console.error("Error creating/loading team:", error);
      toast({
        title: "Error Accessing Team",
        description: error.message || "Failed to create or load team",
        status: "error",
        duration: 3000,
      });
      setIsTeamLoaded(false); // Ensure team is marked as not loaded on error
    },
  });
  // --- End Mutation ---

  // Determine which data source to use based on mode
  const isLoadingDisplayData = currentWorkspace
    ? isLoadingData // Use query loading state for workspace
    : createOrLoadTeamMutation.isPending; // Use mutation loading state initially for anonymous
  const velocityData = currentWorkspace
    ? teamData?.sprints || []
    : anonVelocityData;
  const averages = currentWorkspace ? teamData?.averages || null : anonAverages;

  // Effect to handle successful data fetch for workspace mode and clear form errors
  useEffect(() => {
    if (isDataSuccess && currentWorkspace) {
      // Only clear errors if query succeeded (workspace mode)
      setFormErrors({});
      // Set isTeamLoaded true when workspace data successfully loads
      setIsTeamLoaded(true);
    }
  }, [isDataSuccess, currentWorkspace]);

  // Effect to show toast on data loading error (for workspace query) and reset isTeamLoaded
  useEffect(() => {
    if (isDataError && dataError && currentWorkspace) {
      // Only handle query errors in workspace mode
      console.error("Error loading team data:", dataError);
      toast({
        title: "Error Loading Data",
        description: dataError.message || "Failed to load team data",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
      setIsTeamLoaded(false); // Reset isTeamLoaded on error
    }
  }, [isDataError, dataError, toast, currentWorkspace]);
  // --- End React Query for fetching data ---

  const validateTeamForm = (): boolean => {
    const errors: FormErrors = {};
    let isValid = true;

    if (!teamName.trim()) {
      errors.teamName = "Team name is required";
      isValid = false;
    } else if (teamName.length < 3) {
      errors.teamName = "Team name must be at least 3 characters";
      isValid = false;
    }

    if (!currentWorkspace) {
      if (!teamPassword.trim()) {
        errors.teamPassword = "Password is required";
        isValid = false;
      } else if (teamPassword.length < 6) {
        errors.teamPassword = "Password must be at least 6 characters";
        isValid = false;
      }
    }

    setFormErrors(errors);
    return isValid;
  };

  // handleCreateOrLoadTeam is now defined after the mutation
  const handleCreateOrLoadTeam = () => {
    if (!validateTeamForm()) return;
    if (currentWorkspace) return; // Should not happen if UI is correct

    createOrLoadTeamMutation.mutate({ name: teamName, password: teamPassword });
  };

  const handleChangeTeam = () => {
    setIsTeamLoaded(false);
    setTeamName("");
    setTeamPassword("");
    setFormErrors({});
    // Clear local state for anonymous data
    setAnonVelocityData([]);
    setAnonAverages(null);
    // Resetting query data is still good practice if switching back from workspace mode
    queryClient.resetQueries({ queryKey: teamVelocityQueryKey });
  };

  // --- React Query Mutation for adding a sprint ---
  interface AddSprintVariables {
    sprintName: string;
    startDate: string;
    endDate: string;
    committedPoints: string;
    completedPoints: string;
  }

  const addSprintMutation = useMutation<void, Error, AddSprintVariables>({
    mutationFn: async (variables) => {
      if (!effectiveTeamName) {
        throw new Error("Cannot add sprint without an effective team name.");
      }
      const endpoint = `/velocity/teams/${effectiveTeamName}/sprints`;
      const body = {
        sprintName: variables.sprintName,
        startDate: variables.startDate,
        endDate: variables.endDate,
        workspaceId: currentWorkspace?.id,
      };

      const sprintData = await apiRequest<{ id: string }>(endpoint, {
        method: "POST",
        body,
        ...(!currentWorkspace &&
          teamPassword && { queryParams: { password: teamPassword } }),
      });

      await apiRequest(`/velocity/sprints/${sprintData.id}/velocity`, {
        method: "PUT",
        body: {
          committedPoints: parseInt(variables.committedPoints),
          completedPoints: parseInt(variables.completedPoints),
        },
        ...(!currentWorkspace &&
          teamPassword && { queryParams: { password: teamPassword } }),
      });
    },
    onSuccess: () => {
      toast({ title: "Sprint data added", status: "success", duration: 2000 });
      // Invalidate the query to refetch data (important for workspace mode)
      queryClient.invalidateQueries({ queryKey: teamVelocityQueryKey });
      // Manually update local state for anonymous mode to avoid full page reload feel
      if (!currentWorkspace) {
        // Re-trigger the POST request to get updated data including the new sprint
        // This isn't ideal, better would be optimistic updates or the server returning all data on PUT
        createOrLoadTeamMutation.mutate({
          name: teamName,
          password: teamPassword,
        });
      }
      onAddSprintClose();
      setSprintName("");
      setStartDate("");
      setEndDate("");
      setCommittedPoints("");
      setCompletedPoints("");
    },
    onError: (error) => {
      toast({
        title: "Error Adding Sprint",
        description: error.message || "Unknown error",
        status: "error",
        duration: 3000,
      });
    },
  });

  const handleAddSprintSubmit = (data: AddSprintVariables) => {
    if (!isTeamLoaded || !effectiveTeamName) {
      toast({ title: "Error", description: "No team loaded", status: "error" });
      return;
    }
    addSprintMutation.mutate(data);
  };
  // --- End React Query Mutation ---

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Team Velocity Tracker",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Any",
    description: teamVelocitySeo.description,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    featureList: teamVelocitySeo.content.features,
  };

  // Loading state for initial auth/workspace check
  if (isAuthLoading || (isAuthenticated && isWorkspaceLoading)) {
    return (
      <Center h="200px">
        <Spinner size="xl" color="blue.500" />
      </Center>
    );
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

          {/* Conditional Rendering based on context */}
          {isAuthenticated && currentWorkspace ? (
            <WorkspaceTeamHeader
              currentWorkspace={currentWorkspace}
              workspaceMembers={workspaceMembers}
              isTeamLoaded={isTeamLoaded} // Still use isTeamLoaded for UI switch
              onAddSprintClick={onAddSprintOpen}
            />
          ) : (
            <TeamSetupForm
              teamName={teamName}
              teamPassword={teamPassword}
              isTeamLoaded={isTeamLoaded} // Use isTeamLoaded to hide form
              errors={formErrors}
              onNameChange={setTeamName}
              onPasswordChange={setTeamPassword}
              onSubmit={handleCreateOrLoadTeam}
              onChangeTeam={handleChangeTeam}
              onAddSprintClick={onAddSprintOpen}
              isLoading={createOrLoadTeamMutation.isPending} // Pass loading state to form button
            />
          )}

          {/* Display Area (Stats, Chart, No Data Message) */}
          {isTeamLoaded && (
            <>
              {/* Use combined loading state */}
              {isLoadingDisplayData ? (
                <Center h="100px">
                  <Spinner />
                </Center>
              ) : (
                <>
                  {averages && <VelocityStats averages={averages} />}
                  {velocityData.length > 0 && (
                    <VelocityChart velocityData={velocityData} />
                  )}
                  {/* Show no data message if not loading and no data */}
                  {velocityData.length === 0 && !isLoadingDisplayData && (
                    <Alert status="info" borderRadius="md">
                      <AlertIcon />
                      <AlertDescription>
                        No sprint data available. Add your first sprint to see
                        velocity metrics.
                      </AlertDescription>
                    </Alert>
                  )}
                </>
              )}
            </>
          )}

          <Divider my={8} />
          <SeoText sections={teamVelocitySeoSections} />
        </VStack>
      </Container>

      <AddSprintModal
        isOpen={isAddSprintOpen}
        onClose={onAddSprintClose}
        onSubmit={handleAddSprintSubmit}
        isSubmitting={addSprintMutation.isPending} // Pass mutation loading state
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
  );
};

export default TeamVelocity;
