import { FC, useState } from "react";
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  FormControl,
  FormLabel,
  Input,
  useToast,
} from "@chakra-ui/react";

interface ChangeRetroBoardNameModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentName: string;
  onChangeName: (newName: string) => void;
}

const ChangeRetroBoardNameModal: FC<ChangeRetroBoardNameModalProps> = ({
  isOpen,
  onClose,
  currentName,
  onChangeName,
}) => {
  const [newName, setNewName] = useState(currentName);
  const toast = useToast();

  const handleChangeName = () => {
    if (!newName.trim()) {
      toast({
        title: "Error",
        description: "Please enter your name",
        status: "error",
        duration: 2000,
      });
      return;
    }

    // localStorage logic is now handled by useRetroUser hook via onChangeName
    // localStorage.setItem('retroUserName', newName.trim());
    onChangeName(newName.trim());
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalOverlay />
      <ModalContent mx={4}>
        <ModalHeader>Change Your Name</ModalHeader>
        <ModalBody>
          <FormControl isRequired>
            <FormLabel>Your Name</FormLabel>
            <Input
              placeholder="Enter your name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === "Enter") {
                  handleChangeName();
                }
              }}
            />
          </FormControl>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={onClose}>
            Cancel
          </Button>
          <Button colorScheme="blue" onClick={handleChangeName}>
            Change Name
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default ChangeRetroBoardNameModal;
