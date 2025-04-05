import { FC } from "react";
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
  userName: string;
  roomPassword: string;
  showPassword: boolean;
  isPasswordProtected: boolean;
  onUserNameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onTogglePassword: () => void;
  onJoin: () => void;
  isNameDisabled?: boolean; // Add optional prop
}

const JoinRoomModal: FC<JoinRoomModalProps> = ({
  isOpen,
  userName,
  roomPassword,
  showPassword,
  isPasswordProtected,
  onUserNameChange,
  onPasswordChange,
  onTogglePassword,
  onJoin,
  isNameDisabled = false, // Default to false
}) => {
  return (
    <Modal isOpen={isOpen} onClose={() => {}} closeOnOverlayClick={false}>
      <ModalOverlay />
      <ModalContent mx={4}>
        <ModalHeader>Join Planning Poker</ModalHeader>
        <ModalBody>
          <VStack spacing={4}>
            <Input
              placeholder="Enter your name"
              value={userName}
              onChange={(e) => onUserNameChange(e.target.value)}
              isDisabled={isNameDisabled} // Disable input if needed
            />
            {isPasswordProtected && (
              <InputGroup>
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter room password"
                  value={roomPassword}
                  onChange={(e) => onPasswordChange(e.target.value)}
                />
                <InputRightElement>
                  <IconButton
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                    icon={showPassword ? <ViewOffIcon /> : <ViewIcon />}
                    onClick={onTogglePassword}
                    size="sm"
                    variant="ghost"
                  />
                </InputRightElement>
              </InputGroup>
            )}
          </VStack>
        </ModalBody>
        <ModalFooter>
          <Button colorScheme="blue" onClick={onJoin} w="full">
            Join Room
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default JoinRoomModal;
