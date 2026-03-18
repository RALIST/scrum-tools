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
import { apiRequest } from "../../utils/apiUtils"; // Import apiRequest

const Register: FC = () => {
  const { register, isAuthenticated } = useAuth();
  const { refreshWorkspaces } = useWorkspace(); // Get refresh function
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; email?: string; password?: string; confirmPassword?: string }>({});
  const toast = useToast();
  const navigate = useNavigate();

  if (isAuthenticated) {
    return <Navigate to="/workspaces" />;
  }

  const validateForm = () => {
    const newErrors: { name?: string; email?: string; password?: string; confirmPassword?: string } = {};

    if (!name) {
      newErrors.name = "Name is required";
    }

    if (!email) {
      newErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = "Email is invalid";
    }

    if (!password) {
      newErrors.password = "Password is required";
    } else if (password.length < 6) {
      newErrors.password = "Password must be at least 6 characters";
    }

    if (password !== confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
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
      // Pass arguments as a single object matching RegisterVariables type
      await register({ email, password, name });
      toast({
        title: "Account created",
        description: "Your account has been created successfully",
        status: "success",
        duration: 5000,
        isClosable: true,
      });

      // After successful registration, check for pending invitation
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
            // Auth token is now set by register(), apiRequest will use it
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
            "Error accepting pending invitation after registration:",
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
      // Catch registration errors
      toast({
        title: "Registration failed",
        description:
          error instanceof Error ? error.message : "Something went wrong",
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
        title="Register - Scrum Tools"
        description="Create a new Scrum Tools account to access team workspaces and collaboration features."
        keywords="scrum tools, register, sign up, agile, team management"
        canonicalUrl="/register"
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
          Register
        </Heading>

        <form onSubmit={(e) => { void handleSubmit(e); }}>
          <VStack spacing={5}>
            <FormControl isInvalid={!!errors.name}>
              <FormLabel>Name</FormLabel>
              <Input
                size="lg"
                type="text"
                value={name}
                onChange={(e) => { setName(e.target.value); }}
                placeholder="Your name"
              />
              <FormErrorMessage>{errors.name}</FormErrorMessage>
            </FormControl>

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
                  placeholder="Create a password"
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

            <FormControl isInvalid={!!errors.confirmPassword}>
              <FormLabel>Confirm Password</FormLabel>
              <Input
                size="lg"
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); }}
                placeholder="Confirm your password"
              />
              <FormErrorMessage>{errors.confirmPassword}</FormErrorMessage>
            </FormControl>

            <Button
              type="submit"
              colorScheme="blue"
              size="lg"
              width="full"
              mt={4}
              isLoading={isSubmitting}
            >
              Register
            </Button>
          </VStack>
        </form>

        <Text textAlign="center">
          Already have an account?{" "}
          <Text as={RouterLink} to="/login" color="blue.500">
            Login
          </Text>
        </Text>
      </VStack>
    </Box>
  );
};

export default Register;
