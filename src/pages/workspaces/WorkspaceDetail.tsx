import { FC, useState, useEffect, useCallback } from "react"; // Added useCallback
import {
  Box,
  Button,
  VStack,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  useDisclosure,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  FormControl,
  FormLabel,
  Input,
  Textarea, // Added Textarea back for edit modal
  useToast,
  Spinner,
  Center,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
} from "@chakra-ui/react";
import { useParams, useNavigate } from "react-router-dom";
import { useWorkspace, Workspace } from "../../contexts/WorkspaceContext"; // Import Workspace type
import { useAuth } from "../../contexts/AuthContext";
import PageHelmet from "../../components/PageHelmet";
import { Icon } from "@chakra-ui/react";
import { apiRequest } from "../../utils/apiUtils"; // Import apiRequest
import { FaUsers, FaThLarge } from "react-icons/fa";
import React from "react";
import WorkspaceDetailHeader from "../../components/workspaces/WorkspaceDetailHeader";
import WorkspaceToolsPanel from "../../components/workspaces/WorkspaceToolsPanel";
import WorkspaceMembersPanel from "../../components/workspaces/WorkspaceMembersPanel";

// Define interfaces for the fetched tool data (keep them here or move to a types file)
interface WorkspacePokerRoom {
  id: string;
  name: string;
  participantCount: number;
  createdAt: string;
  hasPassword?: boolean;
  sequence?: string;
}

interface WorkspaceRetroBoard {
  id: string;
  name: string;
  cardCount: number;
  createdAt: string;
  hasPassword?: boolean;
}

interface WorkspaceVelocityTeam {
  id: string;
  name: string;
  createdAt: string;
  avgVelocityPreview?: number | null;
}

const WorkspaceDetail: FC = () => {
  const { id } = useParams<{ id: string }>();
  const {
    setCurrentWorkspace,
    workspaces,
    updateWorkspace,
    addWorkspaceMember,
    removeWorkspaceMember,
    getWorkspaceMembers,
    isLoading: isWorkspaceContextLoading, // Rename to avoid conflict
  } = useWorkspace();
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  // State for workspace data
  const [workspace, setWorkspace] = useState<Workspace | null>(null); // Use imported Workspace type
  const [isAdmin, setIsAdmin] = useState(false);
  const [members, setMembers] = useState<any[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  // State for tool lists
  const [pokerRooms, setPokerRooms] = useState<WorkspacePokerRoom[]>([]);
  const [retroBoards, setRetroBoards] = useState<WorkspaceRetroBoard[]>([]);
  const [velocityTeams, setVelocityTeams] = useState<WorkspaceVelocityTeam[]>(
    []
  );
  const [isLoadingTools, setIsLoadingTools] = useState(false);

  // Modal state for edit workspace
  const {
    isOpen: isEditOpen,
    onOpen: onEditOpen,
    onClose: onEditClose,
  } = useDisclosure();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal state for add member
  const {
    isOpen: isAddMemberOpen,
    onOpen: onAddMemberOpen,
    onClose: onAddMemberClose,
  } = useDisclosure();
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [isAddingMember, setIsAddingMember] = useState(false);

  // Alert dialog for remove member
  const [memberToRemove, setMemberToRemove] = useState<any>(null);
  const {
    isOpen: isRemoveOpen,
    onOpen: onRemoveOpen,
    onClose: onRemoveClose,
  } = useDisclosure();
  const cancelRef = React.useRef(null);

  // Function to load associated tools (wrapped in useCallback)
  const loadTools = useCallback(async () => {
    if (!id) return;
    setIsLoadingTools(true);
    try {
      const [roomsData, boardsData, teamsData] = await Promise.all([
        apiRequest<WorkspacePokerRoom[]>(`/workspaces/${id}/rooms`),
        apiRequest<WorkspaceRetroBoard[]>(`/workspaces/${id}/retros`),
        apiRequest<WorkspaceVelocityTeam[]>(`/workspaces/${id}/velocity-teams`),
      ]);
      setPokerRooms(roomsData || []);
      setRetroBoards(boardsData || []);
      setVelocityTeams(teamsData || []);
    } catch (error) {
      console.error("Error loading workspace tools:", error);
      toast({
        title: "Error Loading Tools",
        description: "Failed to load tools associated with this workspace.",
        status: "error",
        duration: 5000,
      });
    } finally {
      setIsLoadingTools(false);
    }
  }, [id, toast]); // Added dependencies

  // Load workspace data from context
  useEffect(() => {
    if (!id || isWorkspaceContextLoading || !workspaces) return;

    const findWorkspace = workspaces?.find((w: Workspace) => w.id === id);
    if (findWorkspace) {
      setWorkspace(findWorkspace);
      setCurrentWorkspace(findWorkspace); // Set context here
      setName(findWorkspace.name);
      setDescription(findWorkspace.description || "");
      setIsAdmin(findWorkspace.role === "admin");
    } else {
      // Only navigate away if workspaces have loaded but the specific one wasn't found
      if (!isWorkspaceContextLoading) {
        navigate("/workspaces");
        toast({
          title: "Workspace not found",
          description:
            "The workspace you requested does not exist or you do not have access",
          status: "error",
          duration: 5000,
        });
      }
    }
  }, [
    id,
    workspaces,
    isWorkspaceContextLoading,
    navigate,
    toast,
    setCurrentWorkspace,
  ]); // Added dependencies

  // Load workspace members and tools when workspace is set
  useEffect(() => {
    const loadMembers = async () => {
      if (!id) return;
      setIsLoadingMembers(true);
      try {
        const membersList = await getWorkspaceMembers(id);
        setMembers(membersList);
      } catch (error) {
        console.error("Error loading members:", error);
        toast({
          title: "Error",
          description: "Failed to load workspace members",
          status: "error",
          duration: 5000,
        });
      } finally {
        setIsLoadingMembers(false);
      }
    };

    if (workspace) {
      loadMembers();
      loadTools(); // Load tools when workspace is set
    }
  }, [workspace, id, getWorkspaceMembers, loadTools, toast]); // Added dependencies

  const handleUpdateWorkspace = async () => {
    if (!name.trim() || !id) {
      toast({
        title: "Name required",
        description: "Please enter a workspace name",
        status: "error",
        duration: 3000,
      });
      return;
    }
    setIsSubmitting(true);
    try {
      // Use the updateWorkspace function from context
      const updated = await updateWorkspace(id, name, description);
      // Update local state as well, though context refresh might handle it
      setWorkspace(updated);
      toast({
        title: "Workspace updated",
        description: "Workspace details have been updated",
        status: "success",
        duration: 3000,
      });
      onEditClose();
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to update workspace",
        status: "error",
        duration: 5000,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddMember = async () => {
    if (!newMemberEmail.trim() || !id) {
      toast({
        title: "Email required",
        description: "Please enter a valid email address",
        status: "error",
        duration: 3000,
      });
      return;
    }
    setIsAddingMember(true);
    try {
      await addWorkspaceMember(id, newMemberEmail);
      // Reload members after adding
      const updatedMembers = await getWorkspaceMembers(id);
      setMembers(updatedMembers);
      setNewMemberEmail("");
      toast({
        title: "Member added",
        description: "The user has been added to the workspace",
        status: "success",
        duration: 3000,
      });
      onAddMemberClose();
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to add member",
        status: "error",
        duration: 5000,
      });
    } finally {
      setIsAddingMember(false);
    }
  };

  const openRemoveMemberDialog = (member: any) => {
    setMemberToRemove(member);
    onRemoveOpen();
  };

  const handleRemoveMember = async () => {
    if (!memberToRemove || !id) return;
    try {
      await removeWorkspaceMember(id, memberToRemove.id);
      // Optimistically update UI or reload members
      setMembers(members.filter((m) => m.id !== memberToRemove.id));
      toast({
        title: "Member removed",
        description: "The user has been removed from the workspace",
        status: "success",
        duration: 3000,
      });
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to remove member",
        status: "error",
        duration: 5000,
      });
    } finally {
      onRemoveClose();
      setMemberToRemove(null);
    }
  };

  // Show main loading spinner if workspace context is loading or workspace data hasn't been set yet
  if (isWorkspaceContextLoading || !workspace) {
    return (
      <Center h="200px">
        <Spinner size="xl" color="blue.500" />
      </Center>
    );
  }

  return (
    <Box>
      <PageHelmet
        title={`${workspace.name} - Workspace | Scrum Tools`}
        description={`Manage your "${workspace.name}" workspace, team members, and Scrum tools.`}
        keywords="scrum workspace, team management, agile teams, collaboration"
        canonicalUrl={`/workspaces/${id}`}
      />

      {/* Use the Header Component */}
      <WorkspaceDetailHeader
        workspace={workspace}
        isAdmin={isAdmin}
        onEditOpen={onEditOpen}
      />

      <Tabs colorScheme="blue" mt={6} isLazy>
        {" "}
        {/* Added isLazy for performance */}
        <TabList>
          <Tab>
            <Icon as={FaThLarge} mr={2} />
            Tools
          </Tab>
          <Tab>
            <Icon as={FaUsers} mr={2} />
            Members
          </Tab>
        </TabList>
        <TabPanels>
          {/* Tools Panel */}
          <TabPanel px={0} py={4}>
            {" "}
            {/* Adjust padding if needed */}
            <WorkspaceToolsPanel
              pokerRooms={pokerRooms}
              retroBoards={retroBoards}
              velocityTeams={velocityTeams}
              isLoadingTools={isLoadingTools}
            />
          </TabPanel>

          {/* Members Panel */}
          <TabPanel px={0} py={4}>
            {" "}
            {/* Adjust padding if needed */}
            <WorkspaceMembersPanel
              workspaceId={id || ""} // Pass workspaceId
              members={members}
              isLoadingMembers={isLoadingMembers}
              isAdmin={isAdmin}
              currentUserId={user?.id}
              onAddMemberOpen={onAddMemberOpen} // Pass modal opener
              onRemoveMember={openRemoveMemberDialog} // Pass dialog opener
            />
          </TabPanel>
        </TabPanels>
      </Tabs>

      {/* Edit Workspace Modal */}
      <Modal isOpen={isEditOpen} onClose={onEditClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Edit Workspace</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4}>
              <FormControl isRequired>
                <FormLabel>Workspace Name</FormLabel>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter workspace name"
                />
              </FormControl>

              <FormControl>
                <FormLabel>Description</FormLabel>
                {/* Changed back to Textarea */}
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Enter workspace description"
                  resize="vertical"
                  rows={3}
                />
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onEditClose}>
              Cancel
            </Button>
            <Button
              colorScheme="blue"
              onClick={handleUpdateWorkspace}
              isLoading={isSubmitting}
            >
              Save Changes
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Add Member Modal */}
      <Modal isOpen={isAddMemberOpen} onClose={onAddMemberClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Add Member</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4}>
              <FormControl isRequired>
                <FormLabel>Member Email</FormLabel>
                <Input
                  value={newMemberEmail}
                  onChange={(e) => setNewMemberEmail(e.target.value)}
                  placeholder="Enter member email"
                  type="email"
                />
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onAddMemberClose}>
              Cancel
            </Button>
            <Button
              colorScheme="blue"
              onClick={handleAddMember}
              isLoading={isAddingMember}
            >
              Add Member
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Remove Member Alert */}
      <AlertDialog
        isOpen={isRemoveOpen}
        leastDestructiveRef={cancelRef}
        onClose={onRemoveClose}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Remove Member
            </AlertDialogHeader>

            <AlertDialogBody>
              Are you sure you want to remove {memberToRemove?.name} from this
              workspace? This action cannot be undone.
            </AlertDialogBody>

            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={onRemoveClose}>
                Cancel
              </Button>
              <Button colorScheme="red" onClick={handleRemoveMember} ml={3}>
                Remove
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </Box>
  );
};

export default WorkspaceDetail;
