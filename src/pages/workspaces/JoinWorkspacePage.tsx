import { FC, useEffect, useState } from "react";
import {
  useSearchParams,
  useNavigate,
  Link as RouterLink,
} from "react-router-dom";
import {
  Box,
  Heading,
  Text,
  Button,
  Center,
  Spinner,
  VStack,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  useToast,
  HStack, // Add HStack import
} from "@chakra-ui/react";
import { useAuth } from "../../contexts/AuthContext";
import { useWorkspace } from "../../contexts/WorkspaceContext";
import { apiRequest } from "../../utils/apiUtils";
import PageContainer from "../../components/PageContainer";

const JoinWorkspacePage: FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const { refreshWorkspaces } = useWorkspace(); // Get refresh function

  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [_joinedWorkspaceId, setJoinedWorkspaceId] = useState<string | null>(
    null
  );

  const token = searchParams.get("token");

  useEffect(() => {
    const acceptInvitation = async (inviteToken: string) => {
      setStatus("loading");
      setErrorMsg(null);
      try {
        const result = await apiRequest<{
          message: string;
          workspaceId: string;
        }>("/workspace-invitations/accept", {
          method: "POST",
          body: { token: inviteToken },
          // apiRequest handles auth token automatically
        });
        setStatus("success");
        setJoinedWorkspaceId(result.workspaceId);
        await refreshWorkspaces(); // Refresh the list of workspaces in context
        toast({
          title: "Invitation Accepted!",
          description: result.message || "Successfully joined the workspace.",
          status: "success",
          duration: 4000,
        });
        // Navigate after a short delay to allow user to see the success message
        setTimeout(() => {
          navigate(`/workspaces/${result.workspaceId}`);
        }, 1500);
      } catch (err: any) {
        console.error("Error accepting invitation:", err);
        const message =
          err.response?.data?.error ||
          err.message ||
          "Failed to accept invitation.";
        setErrorMsg(message);
        setStatus("error");
        toast({
          title: "Error Accepting Invitation",
          description: message,
          status: "error",
          duration: 5000,
        });
      }
    };

    if (!token) {
      setErrorMsg("No invitation token provided.");
      setStatus("error");
      return;
    }

    // Wait for auth check to complete
    if (isAuthLoading) {
      setStatus("loading"); // Show loading while checking auth
      return;
    }

    if (!isAuthenticated) {
      // User is not logged in
      setStatus("idle"); // Stay idle, show login/register prompt
      // Store token in sessionStorage to use after login/register
      sessionStorage.setItem("pendingInvitationToken", token);
    } else {
      // User is logged in, attempt to accept the invitation
      // Check if we already processed this token (e.g., after redirect from login)
      const processedToken = sessionStorage.getItem("processedInvitationToken");
      if (processedToken === token) {
        // Avoid reprocessing if already done after login redirect
        console.log("Invitation already processed, navigating...");
        // Maybe redirect to workspace or dashboard?
        // navigate('/workspaces'); // Or find the workspace ID if stored
        return;
      }
      acceptInvitation(token);
      // Mark as processed to avoid loops if user navigates back/forth
      sessionStorage.setItem("processedInvitationToken", token);
    }
  }, [
    token,
    isAuthenticated,
    isAuthLoading,
    navigate,
    toast,
    refreshWorkspaces,
  ]);

  // Clear processed token on unmount? Maybe not necessary.

  return (
    <PageContainer>
      <Center minH="60vh">
        <VStack spacing={6}>
          <Heading>Join Workspace</Heading>

          {status === "loading" && (
            <Box textAlign="center">
              <Spinner size="xl" color="blue.500" />
              <Text mt={4}>Processing invitation...</Text>
            </Box>
          )}

          {status === "idle" && !isAuthenticated && (
            <Alert
              status="info"
              variant="subtle"
              flexDirection="column"
              alignItems="center"
              justifyContent="center"
              textAlign="center"
              // height="200px" // Remove fixed height
              p={6} // Add padding
              borderRadius="md"
            >
              <AlertIcon boxSize="40px" mr={0} />
              <AlertTitle mt={4} mb={1} fontSize="lg">
                Authentication Required
              </AlertTitle>
              <AlertDescription maxWidth="sm">
                Please log in or register to accept the workspace invitation.
                The invitation will be applied automatically after you sign in.
              </AlertDescription>
              <HStack mt={4} spacing={4}>
                {" "}
                {/* Add spacing */}
                <Button as={RouterLink} to="/login" colorScheme="blue">
                  Login
                </Button>
                <Button
                  as={RouterLink}
                  to="/register"
                  variant="outline"
                  colorScheme="blue"
                >
                  {" "}
                  {/* Match colorScheme */}
                  Register
                </Button>
              </HStack>
            </Alert>
          )}

          {status === "success" && (
            <Alert
              status="success"
              variant="subtle"
              flexDirection="column"
              alignItems="center"
              justifyContent="center"
              textAlign="center"
              height="200px"
              borderRadius="md"
            >
              <AlertIcon boxSize="40px" mr={0} />
              <AlertTitle mt={4} mb={1} fontSize="lg">
                Success!
              </AlertTitle>
              <AlertDescription maxWidth="sm">
                You have successfully joined the workspace. Redirecting...
              </AlertDescription>
            </Alert>
          )}

          {status === "error" && (
            <Alert
              status="error"
              variant="subtle"
              flexDirection="column"
              alignItems="center"
              justifyContent="center"
              textAlign="center"
              height="200px"
              borderRadius="md"
            >
              <AlertIcon boxSize="40px" mr={0} />
              <AlertTitle mt={4} mb={1} fontSize="lg">
                Error
              </AlertTitle>
              <AlertDescription maxWidth="sm">
                {errorMsg || "Could not process the invitation."}
              </AlertDescription>
              <Button mt={4} as={RouterLink} to="/workspaces" variant="outline">
                Go to My Workspaces
              </Button>
            </Alert>
          )}
        </VStack>
      </Center>
    </PageContainer>
  );
};

export default JoinWorkspacePage;
