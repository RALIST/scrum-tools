import { FC, useState, useEffect, useCallback } from "react";
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

  // State for displaying data
  const [velocityData, setVelocityData] = useState<SprintData[]>([]);
  const [averages, setAverages] = useState<TeamAverages | null>(null);
  const [isTeamLoaded, setIsTeamLoaded] = useState(false); // Indicates if data for a team (anon or workspace) is loaded
  const [isLoadingData, setIsLoadingData] = useState(false); // Loading state for team data fetch

  const {
    isOpen: isAddSprintOpen,
    onOpen: onAddSprintOpen,
    onClose: onAddSprintClose,
  } = useDisclosure();
  const toast = useToast();

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

  // Load team data function
  const loadTeamData = useCallback(
    async (name: string, password?: string) => {
      if (!name || (!password && !currentWorkspace)) {
        // Need password if anonymous
        console.warn(
          "Attempted to load team data without name/password or workspace context"
        );
        return;
      }

      setIsLoadingData(true);
      setVelocityData([]); // Clear previous data
      setAverages(null);

      try {
        let data;
        const endpoint = `/velocity/teams/${name}/velocity`;

        if (currentWorkspace) {
          // Use authenticated API with workspace ID in header (assuming API supports this)
          // Or adjust if API expects workspace ID differently
          data = await apiRequest<{
            sprints: SprintData[];
            averages: TeamAverages;
          }>(endpoint, {
            method: "GET",
            // Pass workspace ID in header for authenticated requests
            headers: { "workspace-id": currentWorkspace.id },
          });
        } else {
          // Anonymous lookup requires password in queryParams
          if (!password) {
            throw new Error("Password required for anonymous team lookup");
          }
          // Use apiRequest with queryParams
          data = await apiRequest<{
            sprints: SprintData[];
            averages: TeamAverages;
          }>(endpoint, {
            method: "GET",
            includeAuth: false, // Explicitly false for anonymous
            queryParams: { password },
          });
        }

        if (data && data.sprints) {
          setVelocityData(data.sprints);
          setAverages(data.averages || null);
          setIsTeamLoaded(true); // Mark team as loaded
          setFormErrors({}); // Clear form errors on successful load
        } else {
          throw new Error("Invalid data format received");
        }
      } catch (error) {
        console.error("Error loading team data:", error);
        const errorMessage =
          error instanceof Error ? error.message : "Failed to load team data";
        toast({
          title: "Error Loading Data",
          description: errorMessage,
          status: "error",
          duration: 3000,
        });
        setIsTeamLoaded(false); // Ensure team is marked as not loaded on error
      } finally {
        setIsLoadingData(false);
      }
    },
    [currentWorkspace, toast]
  ); // Removed name/password dependencies, pass them directly

  // Auto-load data if workspace is selected and team name is set
  useEffect(() => {
    if (isAuthenticated && currentWorkspace && !isTeamLoaded) {
      // Automatically load data for the workspace team
      loadTeamData(currentWorkspace.name);
    }
  }, [isAuthenticated, currentWorkspace, isTeamLoaded, loadTeamData]);

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

    // Password validation only needed if not in workspace context
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

  const handleCreateOrLoadTeam = async () => {
    if (!validateTeamForm()) return;

    // Don't proceed if in workspace mode (this button shouldn't be visible anyway)
    if (currentWorkspace) {
      console.warn(
        "handleCreateOrLoadTeam called unexpectedly in workspace mode."
      );
      return;
    }

    setIsLoadingData(true); // Show loading state during create/load attempt
    try {
      // Step 1: Call POST /teams to ensure the team exists or create it (anonymous mode)
      await apiRequest<{ success: boolean; team: any }>(`/velocity/teams`, {
        method: "POST",
        body: { name: teamName, password: teamPassword },
        includeAuth: false, // Explicitly anonymous
      });

      // Step 2: If POST is successful (team exists or was created), load its data
      toast({
        title: "Team Ready",
        description: "Team found or created successfully. Loading data...",
        status: "info",
        duration: 1500,
      });
      await loadTeamData(teamName, teamPassword); // Now load the actual velocity data
    } catch (error) {
      console.error("Error creating/loading team:", error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to create or load team";
      // Check for specific backend errors if possible, e.g., 401 for password mismatch
      // For now, show a generic error from the POST attempt
      toast({
        title: "Error Accessing Team",
        description: errorMessage,
        status: "error",
        duration: 3000,
      });
      setIsTeamLoaded(false); // Ensure team is marked as not loaded on error
      setIsLoadingData(false); // Hide loading indicator on error
    }
    // setIsLoadingData(false) is handled within loadTeamData's finally block if successful
  };

  const handleChangeTeam = () => {
    setIsTeamLoaded(false);
    setTeamName("");
    setTeamPassword("");
    setVelocityData([]);
    setAverages(null);
    setFormErrors({});
  };

  const handleAddSprint = async (data: {
    sprintName: string;
    startDate: string;
    endDate: string;
    committedPoints: string;
    completedPoints: string;
  }) => {
    if (!isTeamLoaded || !effectiveTeamName) {
      toast({ title: "Error", description: "No team loaded", status: "error" });
      return;
    }

    try {
      const endpoint = `/velocity/teams/${effectiveTeamName}/sprints`;
      const body = {
        sprintName: data.sprintName,
        startDate: data.startDate,
        endDate: data.endDate,
        workspaceId: currentWorkspace?.id, // Include workspaceId if available
      };

      // Create sprint (API handles auth based on token/workspaceId)
      const sprintData = await apiRequest<{ id: string }>(endpoint, {
        method: "POST",
        body,
        // Pass password in queryParams only if anonymous
        ...(!currentWorkspace &&
          teamPassword && { queryParams: { password: teamPassword } }),
      });

      // Update velocity points for the newly created sprint
      await apiRequest(`/velocity/sprints/${sprintData.id}/velocity`, {
        method: "PUT",
        body: {
          committedPoints: parseInt(data.committedPoints),
          completedPoints: parseInt(data.completedPoints),
        },
      });

      toast({ title: "Sprint data added", status: "success", duration: 2000 });
      loadTeamData(effectiveTeamName, teamPassword); // Reload data
      onAddSprintClose();

      // Reset modal form state
      setSprintName("");
      setStartDate("");
      setEndDate("");
      setCommittedPoints("");
      setCompletedPoints("");
    } catch (error) {
      toast({
        title: "Error Adding Sprint",
        description: error instanceof Error ? error.message : "Unknown error",
        status: "error",
        duration: 3000,
      });
    }
  };

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
              isTeamLoaded={isTeamLoaded}
              onAddSprintClick={onAddSprintOpen}
            />
          ) : (
            <TeamSetupForm
              teamName={teamName}
              teamPassword={teamPassword}
              isTeamLoaded={isTeamLoaded}
              errors={formErrors}
              onNameChange={setTeamName}
              onPasswordChange={setTeamPassword}
              onSubmit={handleCreateOrLoadTeam}
              onChangeTeam={handleChangeTeam}
              onAddSprintClick={onAddSprintOpen} // Pass the modal opener
            />
          )}

          {/* Display Area (Stats, Chart, No Data Message) */}
          {isTeamLoaded && (
            <>
              {isLoadingData ? (
                <Center h="100px">
                  <Spinner />
                </Center>
              ) : (
                <>
                  {averages && <VelocityStats averages={averages} />}
                  {velocityData.length > 0 && (
                    <VelocityChart velocityData={velocityData} />
                  )}
                  {velocityData.length === 0 && !isLoadingData && (
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
  );
};

export default TeamVelocity;
