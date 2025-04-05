import React, { FC, useRef } from "react";
import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
  Button,
  useToast,
} from "@chakra-ui/react";

// Assuming Member type is defined elsewhere or passed explicitly
interface Member {
  id: string;
  name: string;
  // Add other relevant fields if needed
}

interface RemoveMemberDialogProps {
  isOpen: boolean;
  onClose: () => void;
  memberToRemove: Member | null;
  workspaceId: string | undefined;
  onRemoveMember: (workspaceId: string, memberId: string) => Promise<void>;
}

const RemoveMemberDialog: FC<RemoveMemberDialogProps> = ({
  isOpen,
  onClose,
  memberToRemove,
  workspaceId,
  onRemoveMember,
}) => {
  const cancelRef = useRef(null);
  const toast = useToast();
  const [isRemoving, setIsRemoving] = React.useState(false); // Add loading state

  const handleRemove = async () => {
    if (!memberToRemove || !workspaceId) return;
    setIsRemoving(true);
    try {
      await onRemoveMember(workspaceId, memberToRemove.id);
      toast({
        title: "Member removed",
        description: `Successfully removed ${memberToRemove.name}.`,
        status: "success",
        duration: 3000,
      });
      onClose(); // Close dialog on success
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to remove member",
        status: "error",
        duration: 5000,
      });
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <AlertDialog
      isOpen={isOpen}
      leastDestructiveRef={cancelRef}
      onClose={onClose}
    >
      <AlertDialogOverlay>
        <AlertDialogContent>
          <AlertDialogHeader fontSize="lg" fontWeight="bold">
            Remove Member
          </AlertDialogHeader>

          <AlertDialogBody>
            Are you sure you want to remove {memberToRemove?.name} from this
            workspace? This action cannot be undone.
          </AlertDialogBody>

          <AlertDialogFooter>
            <Button ref={cancelRef} onClick={onClose} isDisabled={isRemoving}>
              Cancel
            </Button>
            <Button
              colorScheme="red"
              onClick={handleRemove}
              ml={3}
              isLoading={isRemoving}
            >
              Remove
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialogOverlay>
    </AlertDialog>
  );
};

export default RemoveMemberDialog;
