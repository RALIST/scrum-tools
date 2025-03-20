import { FC, useState } from 'react';
import {
  Box,
  Heading,
  Text,
  Button,
  VStack,
  HStack,
  FormControl,
  FormLabel,
  Input,
  FormErrorMessage,
  useToast,
  useColorMode,
  Card,
  CardHeader,
  CardBody,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
  useDisclosure
} from '@chakra-ui/react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import PageHelmet from '../components/PageHelmet';
import React from 'react';

const Profile: FC = () => {
  const { user, logout } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [nameError, setNameError] = useState('');
  const toast = useToast();
  const navigate = useNavigate();
  const { colorMode } = useColorMode();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const cancelRef = React.useRef(null);

  const handleUpdateProfile = async () => {
    if (!name.trim()) {
      setNameError('Name is required');
      return;
    }
    
    setIsSubmitting(true);
    
    // Profile update would be implemented here
    // For now, just show a success message
    
    setTimeout(() => {
      toast({
        title: 'Profile updated',
        description: 'Your profile has been updated successfully',
        status: 'success',
        duration: 3000,
      });
      setIsSubmitting(false);
    }, 1000);
  };

  const handleLogout = () => {
    logout();
    navigate('/');
    toast({
      title: 'Logged out',
      description: 'You have been logged out successfully',
      status: 'info',
      duration: 3000,
    });
  };

  return (
    <Box maxWidth="800px" mx="auto">
      <PageHelmet
        title="My Profile - Scrum Tools"
        description="Manage your Scrum Tools profile and account settings"
        keywords="scrum profile, account settings, user profile"
        canonicalUrl="/profile"
      />
      
      <Heading size="xl" mb={6}>My Profile</Heading>
      
      <Card bg={colorMode === 'light' ? 'white' : 'gray.700'} shadow="md" mb={6}>
        <CardHeader pb={0}>
          <Heading size="md">Account Information</Heading>
        </CardHeader>
        <CardBody>
          <VStack spacing={6} align="stretch">
            <HStack justify="space-between">
              <Text fontWeight="bold">Email:</Text>
              <Text>{user?.email}</Text>
            </HStack>
            
            <FormControl isInvalid={!!nameError}>
              <FormLabel>Name</FormLabel>
              <Input 
                value={name} 
                onChange={(e) => {
                  setName(e.target.value);
                  setNameError('');
                }} 
                placeholder="Your name"
              />
              <FormErrorMessage>{nameError}</FormErrorMessage>
            </FormControl>
            
            <Button 
              colorScheme="blue" 
              alignSelf="flex-end"
              onClick={handleUpdateProfile}
              isLoading={isSubmitting}
            >
              Update Profile
            </Button>
          </VStack>
        </CardBody>
      </Card>
      
      <Card bg={colorMode === 'light' ? 'white' : 'gray.700'} shadow="md">
        <CardHeader pb={0}>
          <Heading size="md">Account Actions</Heading>
        </CardHeader>
        <CardBody>
          <VStack spacing={4} align="stretch">
            <Button 
              colorScheme="red" 
              variant="outline"
              onClick={onOpen}
            >
              Log Out
            </Button>
          </VStack>
        </CardBody>
      </Card>
      
      {/* Logout Confirmation */}
      <AlertDialog
        isOpen={isOpen}
        leastDestructiveRef={cancelRef}
        onClose={onClose}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Log Out
            </AlertDialogHeader>

            <AlertDialogBody>
              Are you sure you want to log out of your account?
            </AlertDialogBody>

            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={onClose}>
                Cancel
              </Button>
              <Button colorScheme="red" onClick={handleLogout} ml={3}>
                Log Out
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </Box>
  );
};

export default Profile;