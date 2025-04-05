import { FC, useState } from "react";
import {
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
  Button,
  VStack,
  useToast,
} from "@chakra-ui/react";

interface AddMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string | undefined; // Workspace ID is needed to add member
  onAddMember: (workspaceId: string, email: string) => Promise<void>;
}

const AddMemberModal: FC<AddMemberModalProps> = ({
  isOpen,
  onClose,
  workspaceId,
  onAddMember,
}) => {
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [isAddingMember, setIsAddingMember] = useState(false);
  const toast = useToast();

  const handleAdd = async () => {
    if (!newMemberEmail.trim() || !workspaceId) {
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
      await onAddMember(workspaceId, newMemberEmail);
      setNewMemberEmail(""); // Clear input on success
      toast({
        title: "Member added",
        description: "The user has been added to the workspace",
        status: "success",
        duration: 3000,
      });
      onClose(); // Close modal on success
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

  // Reset state when modal closes
  const handleClose = () => {
    setNewMemberEmail("");
    setIsAddingMember(false);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Add Member by Email</ModalHeader>
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
          <Button variant="ghost" mr={3} onClick={handleClose}>
            Cancel
          </Button>
          <Button
            colorScheme="blue"
            onClick={handleAdd}
            isLoading={isAddingMember}
          >
            Add Member
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default AddMemberModal;
