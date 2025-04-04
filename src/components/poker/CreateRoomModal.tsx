import { FC } from "react";
import {
  Button,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Input,
  Select,
  FormControl,
  FormLabel,
  VStack,
  Text,
} from "@chakra-ui/react";
import { SEQUENCE_LABELS, SequenceType } from "../../constants/poker";
import { useAuth } from "../../contexts/AuthContext";
import { Workspace } from "../../contexts/WorkspaceContext"; // Assuming Workspace type is exported

interface CreateRoomSettings {
  password?: string;
  sequence: SequenceType;
  roomName: string;
  workspaceId?: string;
}

interface CreateRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: () => void;
  settings: CreateRoomSettings;
  onSettingsChange: (newSettings: Partial<CreateRoomSettings>) => void;
  workspaces: Workspace[] | null; // Pass workspaces list
  isLoading: boolean;
}

export const CreateRoomModal: FC<CreateRoomModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  settings,
  onSettingsChange,
  workspaces,
  isLoading,
}) => {
  const { isAuthenticated } = useAuth();
  const currentWorkspaceId = settings.workspaceId; // Get current selection from settings

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalOverlay />
      <ModalContent mx={4}>
        <ModalHeader>Create Planning Poker Room</ModalHeader>
        <ModalBody>
          <VStack spacing={4}>
            {/* Room Name is required only if authenticated and linked to a workspace */}
            <FormControl isRequired={isAuthenticated && !!currentWorkspaceId}>
              <FormLabel>Room Name</FormLabel>
              <Input
                placeholder="Enter room name (optional for public rooms)"
                value={settings.roomName}
                onChange={(e) => onSettingsChange({ roomName: e.target.value })}
              />
            </FormControl>

            {/* Workspace selection only shown if authenticated */}
            {isAuthenticated && workspaces && workspaces.length > 0 && (
              <FormControl>
                <FormLabel>Workspace (Optional)</FormLabel>
                <Select
                  name="workspaceId"
                  value={settings.workspaceId || ""}
                  onChange={(e) =>
                    onSettingsChange({
                      workspaceId: e.target.value || undefined,
                    })
                  }
                >
                  <option value="">No Workspace (Public Room)</option>
                  {workspaces.map((workspace) => (
                    <option key={workspace.id} value={workspace.id}>
                      {workspace.name}
                    </option>
                  ))}
                </Select>
                <Text fontSize="sm" color="gray.500" mt={1}>
                  Workspace rooms are only visible to workspace members.
                </Text>
              </FormControl>
            )}

            <FormControl>
              <FormLabel>Estimation Sequence</FormLabel>
              <Select
                value={settings.sequence}
                onChange={(e) =>
                  onSettingsChange({ sequence: e.target.value as SequenceType })
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
              <FormLabel>Room Password (Optional)</FormLabel>
              <Input
                type="password"
                placeholder="Leave empty for no password"
                value={settings.password || ""}
                onChange={(e) =>
                  onSettingsChange({ password: e.target.value || undefined })
                }
              />
            </FormControl>
          </VStack>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={onClose}>
            Cancel
          </Button>
          <Button colorScheme="blue" onClick={onSubmit} isDisabled={isLoading}>
            Create Room
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
