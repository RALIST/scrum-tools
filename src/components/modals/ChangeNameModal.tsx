import { FC, useState, useEffect } from "react"; // Import useState and useEffect
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
} from "@chakra-ui/react";

interface ChangeNameModalProps {
  isOpen: boolean;
  initialUserName: string; // Renamed from newUserName, used for initial value
  onClose: () => void;
  // Removed onNameChange
  onSave: (newName: string) => void; // onSave now accepts the new name
}

const ChangeNameModal: FC<ChangeNameModalProps> = ({
  isOpen,
  initialUserName, // Use initialUserName
  onClose,
  // Removed onNameChange
  onSave,
}) => {
  const [internalUserName, setInternalUserName] = useState(initialUserName);

  // Reset internal state when modal opens with a new initial value
  useEffect(() => {
    if (isOpen) {
      setInternalUserName(initialUserName);
    }
  }, [isOpen, initialUserName]);

  const handleSave = () => {
    onSave(internalUserName.trim()); // Pass the internal state on save
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalOverlay />
      <ModalContent mx={4}>
        <ModalHeader>Change Name</ModalHeader>
        <ModalBody>
          <Input
            placeholder="Enter new name"
            value={internalUserName} // Use internal state
            onChange={(e) => setInternalUserName(e.target.value)} // Update internal state
          />
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={onClose}>
            Cancel
          </Button>
          <Button colorScheme="blue" onClick={handleSave}>
            {" "}
            {/* Call internal handler */}
            Save
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default ChangeNameModal;
