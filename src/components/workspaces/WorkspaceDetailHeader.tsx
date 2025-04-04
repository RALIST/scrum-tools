import { FC } from 'react';
import {
  Heading,
  Text,
  Button,
  VStack,
  HStack,
  Badge,
  Icon,
} from '@chakra-ui/react';
import { FaEdit } from 'react-icons/fa';
import { Workspace } from '../../contexts/WorkspaceContext'; // Assuming Workspace type is exported

interface WorkspaceDetailHeaderProps {
  workspace: Workspace; // Pass the whole workspace object
  isAdmin: boolean;
  onEditOpen: () => void; // Callback to open the edit modal
}

const WorkspaceDetailHeader: FC<WorkspaceDetailHeaderProps> = ({
  workspace,
  isAdmin,
  onEditOpen,
}) => {
  return (
    <HStack justify="space-between" mb={6} flexWrap="wrap" align="start">
      <VStack align="start" spacing={1}>
        <HStack>
          <Heading size="xl">{workspace.name}</Heading>
          <Badge colorScheme={isAdmin ? 'green' : 'blue'}>
            {workspace.role}
          </Badge>
        </HStack>
        {workspace.description && (
          <Text color="gray.500" fontSize="md">
            {workspace.description}
          </Text>
        )}
      </VStack>

      {isAdmin && (
        <Button
          leftIcon={<Icon as={FaEdit} />}
          colorScheme="blue"
          variant="outline"
          onClick={onEditOpen}
          mt={{ base: 4, md: 0 }}
          alignSelf="start" // Align button to the top if wrapping occurs
        >
          Edit Workspace
        </Button>
      )}
    </HStack>
  );
};

export default WorkspaceDetailHeader;
