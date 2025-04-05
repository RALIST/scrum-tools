import React, { FC, useState } from "react";
import { useMutation } from "@tanstack/react-query"; // Import useMutation
import {
  Box,
  Heading,
  Text,
  Button,
  VStack,
  HStack,
  Spinner,
  Center,
  Icon,
  Input, // For invite link display
  useToast, // For copy feedback
  useColorMode, // For invite link background
} from "@chakra-ui/react";
import { FaUserPlus } from "react-icons/fa";
import WorkspaceMembersTable from "./WorkspaceMembersTable"; // Import the table component
import { apiRequest } from "../../utils/apiUtils"; // For invite generation

// Define Member type again or import if shared
interface Member {
  id: string;
  name: string;
  email: string;
  role: "admin" | "member" | string;
}

interface WorkspaceMembersPanelProps {
  workspaceId: string;
  members: Member[];
  isLoadingMembers: boolean;
  isAdmin: boolean;
  currentUserId?: string | null;
  onAddMemberOpen: () => void; // Callback to open Add Member modal (by email)
  onRemoveMember: (member: Member) => void; // Callback to open Remove Member dialog
}

const WorkspaceMembersPanel: FC<WorkspaceMembersPanelProps> = ({
  workspaceId,
  members,
  isLoadingMembers,
  isAdmin,
  currentUserId,
  onAddMemberOpen,
  onRemoveMember,
}) => {
  const toast = useToast();
  const { colorMode } = useColorMode();
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  // Remove isGeneratingInvite state, use mutation state
  // const [isGeneratingInvite, setIsGeneratingInvite] = useState(false);

  // --- React Query Mutation for generating invite link ---
  const generateInviteMutation = useMutation<
    { token: string }, // Type of the data returned by the mutation function
    Error, // Type of the error
    void // Type of the variables passed to the mutation function (none needed)
  >({
    mutationFn: async () => {
      if (!workspaceId) {
        throw new Error("Workspace ID is required to generate an invite.");
      }
      return await apiRequest<{ token: string }>(
        `/workspaces/${workspaceId}/invitations`,
        {
          method: "POST",
          // body: { roleToAssign: 'member' } // Optional body
        }
      );
    },
    onSuccess: (data) => {
      setInviteToken(data.token);
      toast({
        title: "Invite Link Generated",
        description: "Copy the link below and share it.",
        status: "success",
        duration: 5000,
      });
    },
    onError: (error) => {
      console.error("Error generating invite link:", error);
      setInviteToken(null); // Clear any previous token on error
      toast({
        title: "Error Generating Link",
        description: error.message || "Failed to generate invite link.",
        status: "error",
        duration: 5000,
      });
    },
    onMutate: () => {
      // Clear previous token immediately when mutation starts
      setInviteToken(null);
    },
  });
  // --- End React Query Mutation ---

  // Wrapper function to call the mutation
  const handleGenerateInviteClick = () => {
    generateInviteMutation.mutate();
  };

  return (
    <VStack spacing={6} align="stretch">
      {/* Invite Section (Only for Admins) */}
      {isAdmin && (
        <Box p={4} borderWidth={1} borderRadius="md">
          <Heading size="sm" mb={3}>
            Invite New Members
          </Heading>
          <HStack spacing={4} flexWrap="wrap">
            <Button
              leftIcon={<Icon as={FaUserPlus} />}
              colorScheme="teal"
              size="sm"
              onClick={handleGenerateInviteClick} // Use the wrapper function
              isLoading={generateInviteMutation.isPending} // Use mutation loading state
            >
              Generate Invite Link
            </Button>
            <Button
              leftIcon={<Icon as={FaUserPlus} />}
              colorScheme="blue"
              size="sm"
              onClick={onAddMemberOpen}
              // ml="auto" // Push Add by Email button to the right if needed
            >
              Add by Email
            </Button>
          </HStack>
          {inviteToken && (
            <Box
              mt={4}
              p={3}
              bg={colorMode === "light" ? "gray.100" : "gray.600"}
              borderRadius="md"
            >
              <Text fontSize="sm" mb={1}>
                Share this link (expires in 7 days):
              </Text>
              <HStack>
                <Input
                  isReadOnly
                  value={`${window.location.origin}/join-workspace?token=${inviteToken}`}
                  size="sm"
                />
                <Button
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(
                      `${window.location.origin}/join-workspace?token=${inviteToken}`
                    );
                    toast({
                      title: "Link Copied!",
                      status: "info",
                      duration: 1500,
                    });
                  }}
                >
                  Copy
                </Button>
              </HStack>
            </Box>
          )}
        </Box>
      )}

      {/* Members Table Section */}
      <Box>
        <Heading size="md" mb={4}>
          Workspace Members
        </Heading>
        {isLoadingMembers ? (
          <Center h="100px">
            <Spinner />
          </Center>
        ) : members.length === 0 ? (
          <Box p={4} borderWidth={1} borderRadius="md" textAlign="center">
            <Text>No members found in this workspace.</Text>
          </Box>
        ) : (
          <WorkspaceMembersTable
            members={members}
            isAdmin={isAdmin}
            currentUserId={currentUserId}
            onRemoveMember={onRemoveMember}
          />
        )}
      </Box>
    </VStack>
  );
};

// Memoize the component
export default React.memo(WorkspaceMembersPanel);
