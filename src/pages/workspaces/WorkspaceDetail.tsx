import {
  Box,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  useDisclosure,
  Spinner,
  Center,
  Icon,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
} from '@chakra-ui/react';
import { type FC, useState, useCallback, Suspense, lazy } from 'react';
import { FaUsers, FaThLarge } from 'react-icons/fa';
import { useParams } from 'react-router-dom';
import PageHelmet from '../../components/PageHelmet';
import WorkspaceDetailHeader from '../../components/workspaces/WorkspaceDetailHeader';
import WorkspaceMembersPanel from '../../components/workspaces/WorkspaceMembersPanel';
import WorkspaceToolsPanel from '../../components/workspaces/WorkspaceToolsPanel';
import config from '../../config';
import { useAuth } from '../../contexts/AuthContext';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { useWorkspaceData } from '../../hooks/useWorkspaceData';
import { useWorkspaceMembers } from '../../hooks/useWorkspaceMembers';
import { useWorkspaceTools } from '../../hooks/useWorkspaceTools';

// Import components

// Lazy load modal components for better code splitting
const EditWorkspaceModal = lazy(
  async () => import('../../components/workspaces/modals/EditWorkspaceModal')
);
const AddMemberModal = lazy(async () => import('../../components/workspaces/modals/AddMemberModal'));
const RemoveMemberDialog = lazy(
  async () => import('../../components/workspaces/modals/RemoveMemberDialog')
);

// Modal loading component
const ModalLoadingSpinner: FC = () => (
  <Center h="200px">
    <Spinner size="lg" color="blue.500" />
  </Center>
);

// Define Member type (or import if shared)
interface Member {
  id: string;
  name: string;
  email: string;
  role: string;
}

const WorkspaceDetail: FC = () => {
  const { id: workspaceId } = useParams<{ id: string }>();
  const { user } = useAuth();
  const {
    updateWorkspace, // Function to update workspace (from context)
    addWorkspaceMember, // Function to add member (from context)
    removeWorkspaceMember, // Function to remove member (from context)
  } = useWorkspace();

  // --- Data Fetching using Custom Hooks ---
  const {
    workspace,
    isAdmin,
    isLoading: isLoadingWorkspace,
    error: workspaceError,
  } = useWorkspaceData(workspaceId);

  const {
    members,
    isLoading: isLoadingMembers,
    error: membersError,
    refreshMembers, // Get refresh function
  } = useWorkspaceMembers(workspaceId);

  const {
    pokerRooms,
    retroBoards,
    velocityTeams,
    isLoading: isLoadingTools,
    error: toolsError,
    // refreshTools, // Can get refresh function if needed
  } = useWorkspaceTools(workspaceId);

  // --- Modal/Dialog States ---
  const { isOpen: isEditOpen, onOpen: onEditOpen, onClose: onEditClose } = useDisclosure();
  const {
    isOpen: isAddMemberOpen,
    onOpen: onAddMemberOpen,
    onClose: onAddMemberClose,
  } = useDisclosure();
  const { isOpen: isRemoveOpen, onOpen: onRemoveOpen, onClose: onRemoveClose } = useDisclosure();
  const [memberToRemove, setMemberToRemove] = useState<Member | null>(null);

  // --- Callback Handlers ---
  // Callback to open remove dialog (memoized)
  const openRemoveMemberDialog = useCallback(
    (member: Member) => {
      setMemberToRemove(member);
      onRemoveOpen();
    },
    [onRemoveOpen]
  );

  // Callback for AddMemberModal (memoized)
  // Refreshes members list on success
  const handleAddMember = useCallback(
    async (id: string, email: string) => {
      await addWorkspaceMember(id, email);
      await refreshMembers(); // Refresh members list after adding
    },
    [addWorkspaceMember, refreshMembers]
  );

  // Callback for RemoveMemberDialog (memoized)
  // Refreshes members list on success
  const handleRemoveMember = useCallback(
    async (id: string, memberId: string) => {
      await removeWorkspaceMember(id, memberId);
      await refreshMembers(); // Refresh members list after removing
      // No need to filter locally, refreshMembers handles it
    },
    [removeWorkspaceMember, refreshMembers]
  );

  // --- Loading and Error States ---
  if (isLoadingWorkspace) {
    return (
      <Center h="200px">
        <Spinner size="xl" color="blue.500" />
      </Center>
    );
  }

  if (workspaceError || !workspace) {
    // Error is handled by the hook (toast + navigation)
    // Render a fallback or null if navigation hasn't happened yet
    return (
      <Center h="200px">
        <Alert status="error">
          <AlertIcon />
          <AlertTitle>Error Loading Workspace</AlertTitle>
          <AlertDescription>
            {workspaceError?.message ?? 'Could not load workspace data.'}
          </AlertDescription>
        </Alert>
      </Center>
    );
  }

  // --- Render Logic ---
  return (
    <Box>
      <PageHelmet
        title={`${workspace.name} - Workspace | Scrum Tools`}
        description={`Manage your "${workspace.name}" workspace, team members, and Scrum tools.`}
        keywords="scrum workspace, team management, agile teams, collaboration"
        canonicalUrl={`${config.siteUrl}/workspaces/${workspaceId ?? ''}`}
        robots="noindex, nofollow"
      />

      <WorkspaceDetailHeader
        workspace={workspace}
        isAdmin={isAdmin}
        onEditOpen={onEditOpen} // Pass modal opener
      />

      <Tabs colorScheme="blue" mt={6} isLazy>
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
            {toolsError ? <Alert status="warning" mb={4}>
                <AlertIcon />
                Could not load workspace tools.
              </Alert> : null}
            <WorkspaceToolsPanel
              pokerRooms={pokerRooms}
              retroBoards={retroBoards}
              velocityTeams={velocityTeams}
              isLoadingTools={isLoadingTools}
            />
          </TabPanel>

          {/* Members Panel */}
          <TabPanel px={0} py={4}>
            {membersError ? <Alert status="warning" mb={4}>
                <AlertIcon />
                Could not load workspace members.
              </Alert> : null}
            <WorkspaceMembersPanel
              workspaceId={workspaceId ?? ''}
              members={members}
              isLoadingMembers={isLoadingMembers}
              isAdmin={isAdmin}
              currentUserId={user?.id}
              onAddMemberOpen={onAddMemberOpen}
              onRemoveMember={openRemoveMemberDialog} // Pass memoized callback
            />
          </TabPanel>
        </TabPanels>
      </Tabs>

      {/* Modals and Dialogs */}
      <Suspense fallback={<ModalLoadingSpinner />}>
        <EditWorkspaceModal
          isOpen={isEditOpen}
          onClose={onEditClose}
          workspace={workspace}
          onUpdateWorkspace={updateWorkspace} // Pass context function directly
        />
      </Suspense>

      <Suspense fallback={<ModalLoadingSpinner />}>
        <AddMemberModal
          isOpen={isAddMemberOpen}
          onClose={onAddMemberClose}
          workspaceId={workspaceId}
          onAddMember={handleAddMember} // Pass memoized handler
        />
      </Suspense>

      <Suspense fallback={<ModalLoadingSpinner />}>
        <RemoveMemberDialog
          isOpen={isRemoveOpen}
          onClose={onRemoveClose}
          memberToRemove={memberToRemove}
          workspaceId={workspaceId}
          onRemoveMember={handleRemoveMember} // Pass memoized handler
        />
      </Suspense>
    </Box>
  );
};

export default WorkspaceDetail;
