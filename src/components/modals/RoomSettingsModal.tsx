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
  Select, // Re-added
  InputGroup,
  InputRightElement,
  IconButton,
  // Text, // Removed
} from "@chakra-ui/react";
import { ViewIcon, ViewOffIcon } from "@chakra-ui/icons";
import { SEQUENCE_LABELS, SequenceType } from "../../constants/poker"; // Re-added

interface RoomSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSequence: SequenceType; // Changed back to key type
  // Reverted onSave signature
  onSave: (settings: { sequence?: SequenceType; password?: string }) => void;
}

const RoomSettingsModal: FC<RoomSettingsModalProps> = ({
  isOpen,
  onClose,
  currentSequence,
  onSave,
}) => {
  // Re-added internal state for sequence
  const [internalSettings, setInternalSettings] = useState<{
    sequence?: SequenceType;
    password?: string;
  }>({ sequence: currentSequence });
  const [internalShowPassword, setInternalShowPassword] = useState(false);

  // Reset internal state when modal opens or currentSequence changes
  useEffect(() => {
    if (isOpen) {
      // Reset internal state to current props
      setInternalSettings({ sequence: currentSequence, password: "" });
      setInternalShowPassword(false);
    }
  }, [isOpen, currentSequence]);

  // Reverted handleSettingsChange
  const handleSettingsChange = (
    key: "sequence" | "password",
    value: string | undefined
  ) => {
    setInternalSettings((prev) => ({
      ...prev,
      // Cast sequence value back to SequenceType if needed
      [key]: key === "sequence" ? (value as SequenceType) : value,
    }));
  };

  // Reverted handleSave
  const handleSave = () => {
    // Only include password if it's not empty
    const settingsToSave = { ...internalSettings };
    // Adjust password handling: send undefined if empty to keep current, null to remove
    if (settingsToSave.password === "") {
      settingsToSave.password = undefined; // Treat empty as "no change" unless explicitly set to null elsewhere
    }
    // If user wants to remove password, they should explicitly clear it and backend should handle null
    // For now, empty string means no change from modal perspective

    onSave(settingsToSave);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalOverlay />
      <ModalContent mx={4}>
        <ModalHeader>Room Settings</ModalHeader>
        <ModalBody>
          <VStack spacing={4}>
            {/* Re-added Sequence Selection Dropdown */}
            <FormControl>
              <FormLabel>Estimation Sequence</FormLabel>
              <Select
                value={internalSettings.sequence || currentSequence} // Use internal state
                onChange={(e) =>
                  handleSettingsChange(
                    "sequence",
                    e.target.value as SequenceType // Cast is okay here
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
                  type={internalShowPassword ? "text" : "password"}
                  placeholder="Leave empty to keep current" // Changed placeholder
                  value={internalSettings.password || ""} // Use internal state
                  onChange={(e) =>
                    handleSettingsChange(
                      "password",
                      e.target.value // Send empty string if cleared
                    )
                  }
                />
                <InputRightElement>
                  <IconButton
                    aria-label={
                      internalShowPassword ? "Hide password" : "Show password"
                    }
                    icon={internalShowPassword ? <ViewOffIcon /> : <ViewIcon />}
                    onClick={() =>
                      setInternalShowPassword(!internalShowPassword)
                    }
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
            Save Changes
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default RoomSettingsModal;
