import { FC, useState } from "react";
import {
  Box,
  Heading,
  Text,
  Button,
  VStack,
  HStack,
  Spinner,
  Center,
  useDisclosure, // Keep for Add Member Modal
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
  const [isGeneratingInvite, setIsGeneratingInvite] = useState(false);

  // Function to generate invite link (copied from previous attempt)
  const handleGenerateInvite = async () => {
    if (!workspaceId) return;
    setIsGeneratingInvite(true);
    setInviteToken(null); // Clear previous token
    try {
      const result = await apiRequest<{ token: string }>(
        `/workspaces/${workspaceId}/invitations`,
        {
          method: "POST",
          // Optionally add roleToAssign or expiresInDays to body if needed
          // body: { roleToAssign: 'member' }
        }
      );
      setInviteToken(result.token);
      toast({
        title: "Invite Link Generated",
        description: "Copy the link below and share it.",
        status: "success",
        duration: 5000,
      });
    } catch (error) {
      console.error("Error generating invite link:", error);
      toast({
        title: "Error Generating Link",
        description:
          error instanceof Error
            ? error.message
            : "Failed to generate invite link.",
        status: "error",
        duration: 5000,
      });
    } finally {
      setIsGeneratingInvite(false);
    }
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
              onClick={handleGenerateInvite}
              isLoading={isGeneratingInvite}
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

export default WorkspaceMembersPanel;
