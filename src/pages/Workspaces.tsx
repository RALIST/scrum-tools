import { FC, useState } from 'react';
import {
  Box,
  Heading,
  Text,
  Button,
  VStack,
  HStack,
  SimpleGrid,
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
  Textarea,
  useToast,
  Spinner,
  Center,
  Badge,
  useColorMode
} from '@chakra-ui/react';
import { AddIcon } from '@chakra-ui/icons';
import { Link as RouterLink } from 'react-router-dom';
import { useWorkspace } from '../contexts/WorkspaceContext';
import PageHelmet from '../components/PageHelmet';

const Workspaces: FC = () => {
  const { 
    workspaces, 
    createWorkspace, 
    isLoading, 
    setCurrentWorkspace 
  } = useWorkspace();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const toast = useToast();
  const { colorMode } = useColorMode();

  const handleCreateWorkspace = async () => {
    if (!name.trim()) {
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
      await createWorkspace(name, description);
      toast({
        title: 'Workspace created',
        description: 'Your new workspace has been created',
        status: 'success',
        duration: 3000,
      });
      setName('');
      setDescription('');
      onClose();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create workspace',
        status: 'error',
        duration: 5000,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectWorkspace = (workspace: any) => {
    setCurrentWorkspace(workspace);
  };

  return (
    <Box>
      <PageHelmet
        title="My Workspaces - Scrum Tools"
        description="Manage your Scrum workspaces and teams. Access your planning poker sessions, retro boards, and more."
        keywords="scrum workspaces, team management, agile workspaces, collaboration"
        canonicalUrl="/workspaces"
      />
      
      <HStack justify="space-between" mb={6}>
        <Heading size="xl">My Workspaces</Heading>
        <Button 
          leftIcon={<AddIcon />} 
          colorScheme="blue" 
          onClick={onOpen}
        >
          New Workspace
        </Button>
      </HStack>
      
      {isLoading || !workspaces ? (
        <Center h="200px">
          <Spinner size="xl" color="blue.500" />
        </Center>
      ) : workspaces.length === 0 ? (
        <Box 
          p={8} 
          textAlign="center" 
          borderWidth={1} 
          borderRadius="md"
          bg={colorMode === 'light' ? 'white' : 'gray.700'}
        >
          <Heading size="md" mb={4}>No workspaces yet</Heading>
          <Text mb={6}>Create your first workspace to start organizing your Scrum tools</Text>
          <Button 
            leftIcon={<AddIcon />} 
            colorScheme="blue" 
            onClick={onOpen}
          >
            Create Workspace
          </Button>
        </Box>
      ) : (
        <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={6}>
          {workspaces.map((workspace) => (
            <Box 
              key={workspace.id} 
              p={5} 
              borderWidth={1} 
              borderRadius="md" 
              bg={colorMode === 'light' ? 'white' : 'gray.700'}
              shadow="md"
              transition="all 0.2s"
              _hover={{ transform: 'translateY(-4px)', shadow: 'lg' }}
            >
              <VStack align="start" spacing={3}>
                <HStack>
                  <Heading size="md">{workspace.name}</Heading>
                  <Badge colorScheme={workspace.role === 'admin' ? 'green' : 'blue'}>
                    {workspace.role}
                  </Badge>
                </HStack>
                
                <Text noOfLines={2}>
                  {workspace.description || 'No description'}
                </Text>
                
                <HStack spacing={4} mt={2}>
                  <Button 
                    as={RouterLink} 
                    to={`/workspaces/${workspace.id}`}
                    colorScheme="blue" 
                    size="sm"
                    onClick={() => handleSelectWorkspace(workspace)}
                  >
                    Open
                  </Button>
                </HStack>
              </VStack>
            </Box>
          ))}
        </SimpleGrid>
      )}
      
      {/* Create Workspace Modal */}
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Create New Workspace</ModalHeader>
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
            <Button variant="ghost" mr={3} onClick={onClose}>
              Cancel
            </Button>
            <Button 
              colorScheme="blue" 
              onClick={handleCreateWorkspace}
              isLoading={isSubmitting}
            >
              Create
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default Workspaces;