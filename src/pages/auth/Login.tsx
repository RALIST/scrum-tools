import { ViewIcon, ViewOffIcon } from "@chakra-ui/icons";
import {
  Box,
  Button,
  FormControl,
  FormLabel,
  Input,
  VStack,
  Heading,
  Text,
  useToast,
  FormErrorMessage,
  InputGroup,
  InputRightElement,
  IconButton,
} from "@chakra-ui/react";
import { type FC, useState } from "react";
import { Link as RouterLink, Navigate, useNavigate } from "react-router-dom";
import PageHelmet from "../../components/PageHelmet";
import { useAuth } from "../../contexts/AuthContext";
import { useWorkspace } from "../../contexts/WorkspaceContext"; // Import useWorkspace
import { apiRequest } from "../../utils/apiUtils"; // Import apiRequest for accepting invite

const Login: FC = () => {
  const { login, isAuthenticated } = useAuth();
  const { refreshWorkspaces } = useWorkspace(); // Get refresh function
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const toast = useToast();
  const navigate = useNavigate();

  if (isAuthenticated) {
    return <Navigate to="/workspaces" />;
  }

  const validateForm = () => {
    const newErrors: { email?: string; password?: string } = {};

    if (!email) {
      newErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = "Email is invalid";
    }

    if (!password) {
      newErrors.password = "Password is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      // Pass arguments as a single object matching LoginVariables type
      await login({ email, password });

      // After successful login, check for pending invitation
      const pendingToken = sessionStorage.getItem("pendingInvitationToken");
      if (pendingToken) {
        toast({
          title: "Processing Invitation...",
          status: "info",
          duration: 2000,
        });
        try {
          const result = await apiRequest<{
            message: string;
            workspaceId: string;
          }>("/workspaces/invitations/accept", {
            // Corrected path
            method: "POST",
            body: { token: pendingToken },
            // Auth token is now set by login(), apiRequest will use it
          });
          sessionStorage.removeItem("pendingInvitationToken"); // Clear token
          sessionStorage.setItem("processedInvitationToken", pendingToken); // Mark as processed
          await refreshWorkspaces(); // Refresh workspace list
          toast({
            title: "Invitation Accepted!",
            description: result.message || "Successfully joined the workspace.",
            status: "success",
            duration: 3000,
          });
          navigate(`/workspaces/${result.workspaceId}`); // Navigate to the joined workspace
          return; // Stop further navigation
        } catch (inviteError: unknown) {
          sessionStorage.removeItem("pendingInvitationToken"); // Clear token even on error
          console.error(
            "Error accepting pending invitation after login:",
            inviteError
          );
          toast({
            title: "Failed to Accept Invitation",
            description:
              inviteError instanceof Error
                ? inviteError.message
                : "Could not apply pending invitation.",
            status: "error",
            duration: 5000,
          });
          // Continue to default navigation even if invite fails
        }
      }

      // Default navigation if no pending token or invite failed
      navigate("/workspaces");
    } catch (error) {
      // Catch login errors
      toast({
        title: "Login failed",
        description:
          error instanceof Error ? error.message : "Invalid email or password",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Box
      maxWidth="480px"
      width="100%"
      mx="auto"
      my={12}
      px={4}
    >
      <PageHelmet
        title="Login - Scrum Tools"
        description="Log in to your Scrum Tools account to access your workspaces and teams."
        keywords="scrum tools, login, agile, team management"
        canonicalUrl="/login"
      />

      <VStack
        spacing={6}
        align="stretch"
        bg="bg.surface"
        p={{ base: 6, sm: 10 }}
        borderRadius="lg"
        boxShadow="lg"
      >
        <Heading as="h1" size="xl" textAlign="center">
          Log In
        </Heading>

        <form onSubmit={(e) => { void handleSubmit(e); }}>
          <VStack spacing={5}>
            <FormControl isInvalid={!!errors.email}>
              <FormLabel>Email</FormLabel>
              <Input
                size="lg"
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); }}
                placeholder="Your email"
              />
              <FormErrorMessage>{errors.email}</FormErrorMessage>
            </FormControl>

            <FormControl isInvalid={!!errors.password}>
              <FormLabel>Password</FormLabel>
              <InputGroup size="lg">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); }}
                  placeholder="Your password"
                />
                <InputRightElement>
                  <IconButton
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                    icon={showPassword ? <ViewOffIcon /> : <ViewIcon />}
                    variant="ghost"
                    onClick={() => { setShowPassword(!showPassword); }}
                    size="sm"
                  />
                </InputRightElement>
              </InputGroup>
              <FormErrorMessage>{errors.password}</FormErrorMessage>
            </FormControl>

            <Button
              type="submit"
              colorScheme="blue"
              size="lg"
              width="full"
              mt={4}
              isLoading={isSubmitting}
            >
              Log In
            </Button>
          </VStack>
        </form>

        <Text textAlign="center">
          Don&apos;t have an account?{" "}
          <Text as={RouterLink} to="/register" color="blue.500">
            Register
          </Text>
        </Text>
      </VStack>
    </Box>
  );
};

export default Login;
