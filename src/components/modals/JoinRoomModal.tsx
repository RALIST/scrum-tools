import { FC, useState, useEffect } from "react"; // Import useState, useEffect
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
  VStack,
  InputGroup,
  InputRightElement,
  IconButton,
} from "@chakra-ui/react";
import { ViewIcon, ViewOffIcon } from "@chakra-ui/icons";

interface JoinRoomModalProps {
  isOpen: boolean;
  initialUserName: string; // Use initial value
  isPasswordProtected: boolean;
  onClose: () => void; // Add onClose prop
  onJoin: (name: string, password?: string) => void; // Updated signature
  isNameDisabled?: boolean;
}

const JoinRoomModal: FC<JoinRoomModalProps> = ({
  isOpen,
  initialUserName,
  isPasswordProtected,
  onClose, // Use onClose
  onJoin,
  isNameDisabled = false,
}) => {
  const [internalUserName, setInternalUserName] = useState(initialUserName);
  const [internalRoomPassword, setInternalRoomPassword] = useState("");
  const [internalShowPassword, setInternalShowPassword] = useState(false);

  // Reset internal state when modal opens
  useEffect(() => {
    if (isOpen) {
      setInternalUserName(initialUserName);
      setInternalRoomPassword("");
      setInternalShowPassword(false);
    }
  }, [isOpen, initialUserName]);

  const handleJoin = () => {
    onJoin(
      internalUserName.trim(),
      isPasswordProtected ? internalRoomPassword : undefined
    );
  };

  return (
    // Pass onClose to Modal, allow overlay click to close
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalOverlay />
      <ModalContent mx={4}>
        <ModalHeader>Join Planning Poker</ModalHeader>
        <ModalBody>
          <VStack spacing={4}>
            <Input
              placeholder="Enter your name"
              value={internalUserName} // Use internal state
              onChange={(e) => setInternalUserName(e.target.value)} // Update internal state
              isDisabled={isNameDisabled}
            />
            {isPasswordProtected && (
              <InputGroup>
                <Input
                  type={internalShowPassword ? "text" : "password"} // Use internal state
                  placeholder="Enter room password"
                  value={internalRoomPassword} // Use internal state
                  onChange={(e) => setInternalRoomPassword(e.target.value)} // Update internal state
                />
                <InputRightElement>
                  <IconButton
                    aria-label={
                      internalShowPassword ? "Hide password" : "Show password"
                    }
                    icon={internalShowPassword ? <ViewOffIcon /> : <ViewIcon />} // Use internal state
                    onClick={() =>
                      setInternalShowPassword(!internalShowPassword)
                    } // Update internal state
                    size="sm"
                    variant="ghost"
                  />
                </InputRightElement>
              </InputGroup>
            )}
          </VStack>
        </ModalBody>
        <ModalFooter>
          <Button colorScheme="blue" onClick={handleJoin} w="full">
            {" "}
            {/* Call internal handler */}
            Join Room
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default JoinRoomModal;
