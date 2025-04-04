import { FC, useState, useEffect } from 'react';
import {
  Box,
  Heading,
  Text,
  Button,
  VStack,
  HStack,
  SimpleGrid,
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
  useToast,
  Spinner,
  Center,
  Badge,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
  useColorMode
} from '@chakra-ui/react';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useAuth } from '../contexts/AuthContext';
import PageHelmet from '../components/PageHelmet';
import { Icon } from '@chakra-ui/react';
import { FaUsers, FaUserPlus, FaUserMinus, FaEdit, FaThLarge } from 'react-icons/fa';
import { MdGridView, MdInsertChart, MdOutlineGames } from 'react-icons/md';
import React from 'react';

const WorkspaceDetail: FC = () => {
  const { id } = useParams<{ id: string }>();
  const { 
    setCurrentWorkspace, 
    workspaces, 
    updateWorkspace,
    addWorkspaceMember,
    removeWorkspaceMember,
    getWorkspaceMembers,
    isLoading,
  } = useWorkspace();
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const { colorMode } = useColorMode();

  // State for workspace data
  const [workspace, setWorkspace] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [members, setMembers] = useState<any[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  
  // Modal state for edit workspace
  const { 
    isOpen: isEditOpen, 
    onOpen: onEditOpen, 
    onClose: onEditClose 
  } = useDisclosure();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Modal state for add member
  const { 
    isOpen: isAddMemberOpen, 
    onOpen: onAddMemberOpen, 
    onClose: onAddMemberClose 
  } = useDisclosure();
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [isAddingMember, setIsAddingMember] = useState(false);
  
  // Alert dialog for remove member
  const [memberToRemove, setMemberToRemove] = useState<any>(null);
  const { 
    isOpen: isRemoveOpen, 
    onOpen: onRemoveOpen, 
    onClose: onRemoveClose 
  } = useDisclosure();
  const cancelRef = React.useRef(null);

  // Load workspace data
  useEffect(() => {
    if (!id || isLoading || !workspaces) return;
    
    const findWorkspace = workspaces?.find(w => w.id === id);
    if (findWorkspace) {
      setWorkspace(findWorkspace);
      setCurrentWorkspace(findWorkspace);
      setName(findWorkspace.name);
      setDescription(findWorkspace.description || '');
      setIsAdmin(findWorkspace.role === 'admin');
    } else {
      navigate('/workspaces');
      toast({
        title: 'Workspace not found',
        description: 'The workspace you requested does not exist or you do not have access',
        status: 'error',
        duration: 5000,
      });
    }
  }, [workspaces]);

  // Load workspace members
  useEffect(() => {
    const loadMembers = async () => {
      if (!id) return;
      
      setIsLoadingMembers(true);
      try {
        const membersList = await getWorkspaceMembers(id);
        setMembers(membersList);
      } catch (error) {
        console.error('Error loading members:', error);
        toast({
          title: 'Error',
          description: 'Failed to load workspace members',
          status: 'error',
          duration: 5000,
        });
      } finally {
        setIsLoadingMembers(false);
      }
    };
    
    if (workspace) {
      loadMembers();
    }
  }, [isLoadingMembers]);

  const handleUpdateWorkspace = async () => {
    if (!name.trim() || !id) {
      toast({
        title: 'Name required',
        description: 'Please enter a workspace name',
        status: 'error',
        duration: 3000,
      });
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const updated = await updateWorkspace(id, name, description);
      setWorkspace({...workspace, ...updated});
      toast({
        title: 'Workspace updated',
        description: 'Workspace details have been updated',
        status: 'success',
        duration: 3000,
      });
      onEditClose();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update workspace',
        status: 'error',
        duration: 5000,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddMember = async () => {
    if (!newMemberEmail.trim() || !id) {
      toast({
        title: 'Email required',
        description: 'Please enter a valid email address',
        status: 'error',
        duration: 3000,
      });
      return;
    }
    
    setIsAddingMember(true);
    
    try {
      await addWorkspaceMember(id, newMemberEmail);
      const updatedMembers = await getWorkspaceMembers(id);
      setMembers(updatedMembers);
      setNewMemberEmail('');
      toast({
        title: 'Member added',
        description: 'The user has been added to the workspace',
        status: 'success',
        duration: 3000,
      });
      onAddMemberClose();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to add member',
        status: 'error',
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
      setMembers(members.filter(m => m.id !== memberToRemove.id));
      toast({
        title: 'Member removed',
        description: 'The user has been removed from the workspace',
        status: 'success',
        duration: 3000,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to remove member',
        status: 'error',
        duration: 5000,
      });
    } finally {
      onRemoveClose();
      setMemberToRemove(null);
    }
  };

  if (isLoading || !workspace) {
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
      
      <HStack justify="space-between" mb={6} flexWrap="wrap">
        <VStack align="start" spacing={1}>
          <HStack>
            <Heading size="xl">{workspace.name}</Heading>
            <Badge colorScheme={isAdmin ? 'green' : 'blue'}>
              {workspace.role}
            </Badge>
          </HStack>
          {workspace.description && (
            <Text color="gray.500" fontSize="md">{workspace.description}</Text>
          )}
        </VStack>
        
        {isAdmin && (
          <Button 
            leftIcon={<Icon as={FaEdit} />} 
            colorScheme="blue" 
            variant="outline"
            onClick={onEditOpen}
            mt={{ base: 4, md: 0 }}
          >
            Edit Workspace
          </Button>
        )}
      </HStack>
      
      <Tabs colorScheme="blue" mt={6}>
        <TabList>
          <Tab><Icon as={FaThLarge} mr={2} />Tools</Tab>
          <Tab><Icon as={FaUsers} mr={2} />Members</Tab>
        </TabList>
        
        <TabPanels>
          {/* Tools Panel */}
          <TabPanel>
            <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={6} mt={4}>
              {/* Planning Poker Card */}
              <Box 
                p={5} 
                borderWidth={1} 
                borderRadius="md" 
                bg={colorMode === 'light' ? 'white' : 'gray.700'}
                _hover={{ transform: 'translateY(-4px)', shadow: 'lg' }}
                transition="all 0.2s"
              >
                <VStack align="start" spacing={3}>
                  <Icon as={MdOutlineGames} boxSize={8} color="blue.500" />
                  <Heading size="md">Planning Poker</Heading>
                  <Text>Estimate user stories with your team in real-time</Text>
                  <Button 
                    as={RouterLink} 
                    to="/planning-poker"
                    colorScheme="blue" 
                    size="sm"
                    mt={2}
                    width="full"
                  >
                    View Poker Rooms
                  </Button>
                </VStack>
              </Box>
              
              {/* Retro Board Card */}
              <Box 
                p={5} 
                borderWidth={1} 
                borderRadius="md" 
                bg={colorMode === 'light' ? 'white' : 'gray.700'}
                _hover={{ transform: 'translateY(-4px)', shadow: 'lg' }}
                transition="all 0.2s"
              >
                <VStack align="start" spacing={3}>
                  <Icon as={MdGridView} boxSize={8} color="green.500" />
                  <Heading size="md">Retro Boards</Heading>
                  <Text>Collaborate on retrospectives with your team</Text>
                  <Button 
                    as={RouterLink} 
                    to="/retro"
                    colorScheme="green" 
                    size="sm"
                    mt={2}
                    width="full"
                  >
                    View Retro Boards
                  </Button>
                </VStack>
              </Box>
              
              {/* Team Velocity Card */}
              <Box 
                p={5} 
                borderWidth={1} 
                borderRadius="md" 
                bg={colorMode === 'light' ? 'white' : 'gray.700'}
                _hover={{ transform: 'translateY(-4px)', shadow: 'lg' }}
                transition="all 0.2s"
              >
                <VStack align="start" spacing={3}>
                  <Icon as={MdInsertChart} boxSize={8} color="purple.500" />
                  <Heading size="md">Team Velocity</Heading>
                  <Text>Track your team's velocity across sprints</Text>
                  <Button 
                    as={RouterLink} 
                    to="/velocity"
                    colorScheme="purple" 
                    size="sm"
                    mt={2}
                    width="full"
                  >
                    View Velocity
                  </Button>
                </VStack>
              </Box>
            </SimpleGrid>
          </TabPanel>
          
          {/* Members Panel */}
          <TabPanel>
            <HStack justifyContent="space-between" mb={4}>
              <Heading size="md">Workspace Members</Heading>
              {isAdmin && (
                <Button 
                  leftIcon={<Icon as={FaUserPlus} />}
                  colorScheme="blue" 
                  size="sm"
                  onClick={onAddMemberOpen}
                >
                  Add Member
                </Button>
              )}
            </HStack>
            
            {isLoadingMembers ? (
              <Center h="100px">
                <Spinner />
              </Center>
            ) : members.length === 0 ? (
              <Box p={4} borderWidth={1} borderRadius="md" textAlign="center">
                <Text>No members found</Text>
              </Box>
            ) : (
              <Box overflowX="auto">
                <Table variant="simple">
                  <Thead>
                    <Tr>
                      <Th>Name</Th>
                      <Th>Email</Th>
                      <Th>Role</Th>
                      {isAdmin && <Th width="100px">Actions</Th>}
                    </Tr>
                  </Thead>
                  <Tbody>
                    {members.map((member) => (
                      <Tr key={member.id}>
                        <Td>{member.name}</Td>
                        <Td>{member.email}</Td>
                        <Td>
                          <Badge colorScheme={member.role === 'admin' ? 'green' : 'blue'}>
                            {member.role}
                          </Badge>
                        </Td>
                        {isAdmin && (
                          <Td>
                            {member.id !== user?.id && (
                              <Button
                                size="sm"
                                colorScheme="red"
                                variant="ghost"
                                leftIcon={<Icon as={FaUserMinus} />}
                                onClick={() => openRemoveMemberDialog(member)}
                              >
                                Remove
                              </Button>
                            )}
                          </Td>
                        )}
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </Box>
            )}
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
                <Input 
                  value={description} 
                  onChange={(e) => setDescription(e.target.value)} 
                  placeholder="Enter workspace description"
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
              Are you sure you want to remove {memberToRemove?.name} from this workspace?
              This action cannot be undone.
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