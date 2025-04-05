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
  FormControl,
  FormLabel,
  Select,
  InputGroup,
  InputRightElement,
  IconButton,
} from "@chakra-ui/react";
import { ViewIcon, ViewOffIcon } from "@chakra-ui/icons";
import { SEQUENCE_LABELS, SequenceType } from "../../constants/poker";

interface RoomSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSequence: SequenceType; // Keep current sequence for initial value
  // Removed newSettings, showPassword, onTogglePassword, onSettingsChange
  onSave: (settings: { sequence?: SequenceType; password?: string }) => void; // Updated signature
}

const RoomSettingsModal: FC<RoomSettingsModalProps> = ({
  isOpen,
  onClose,
  currentSequence,
  onSave,
}) => {
  const [internalSettings, setInternalSettings] = useState<{
    sequence?: SequenceType;
    password?: string;
  }>({ sequence: currentSequence });
  const [internalShowPassword, setInternalShowPassword] = useState(false);

  // Reset internal state when modal opens or currentSequence changes
  useEffect(() => {
    if (isOpen) {
      setInternalSettings({ sequence: currentSequence, password: "" }); // Reset password field
      setInternalShowPassword(false);
    }
  }, [isOpen, currentSequence]);

  const handleSettingsChange = (
    key: "sequence" | "password",
    value: string | undefined
  ) => {
    setInternalSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSave = () => {
    // Only include password if it's not empty
    const settingsToSave = { ...internalSettings };
    if (!settingsToSave.password) {
      delete settingsToSave.password;
    }
    onSave(settingsToSave);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalOverlay />
      <ModalContent mx={4}>
        <ModalHeader>Room Settings</ModalHeader>
        <ModalBody>
          <VStack spacing={4}>
            <FormControl>
              <FormLabel>Estimation Sequence</FormLabel>
              <Select
                value={internalSettings.sequence || currentSequence} // Use internal state
                onChange={(e) =>
                  handleSettingsChange(
                    "sequence",
                    e.target.value as SequenceType
                  )
                }
              >
                {Object.entries(SEQUENCE_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </Select>
            </FormControl>
            <FormControl>
              <FormLabel>Change Room Password</FormLabel>
              <InputGroup>
                <Input
                  type={internalShowPassword ? "text" : "password"} // Use internal state
                  placeholder="Leave empty to keep current or remove"
                  value={internalSettings.password || ""} // Use internal state
                  onChange={(e) =>
                    handleSettingsChange(
                      "password",
                      e.target.value || undefined
                    )
                  }
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
            </FormControl>
          </VStack>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={onClose}>
            Cancel
          </Button>
          <Button colorScheme="blue" onClick={handleSave}>
            {" "}
            {/* Call internal handler */}
            Save Changes
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default RoomSettingsModal;
