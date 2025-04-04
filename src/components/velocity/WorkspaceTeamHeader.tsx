import { FC } from "react";
import {
  VStack,
  Button,
  Grid,
  GridItem,
  Card,
  CardBody,
  Text,
  Badge,
  Flex,
  Spacer,
  Spinner,
  Box,
  Heading,
} from "@chakra-ui/react";
import { Workspace } from "../../contexts/WorkspaceContext"; // Assuming Workspace type is exported

// Assuming WorkspaceMember type is defined elsewhere or here
interface WorkspaceMember {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface WorkspaceTeamHeaderProps {
  currentWorkspace: Workspace | null;
  workspaceMembers: WorkspaceMember[];
  isTeamLoaded: boolean; // To potentially show spinner on button
  onAddSprintClick: () => void;
}

export const WorkspaceTeamHeader: FC<WorkspaceTeamHeaderProps> = ({
  currentWorkspace,
  workspaceMembers,
  isTeamLoaded,
  onAddSprintClick,
}) => {
  if (!currentWorkspace) return null; // Should not happen if called correctly

  return (
    <Card w="full">
      <CardBody>
        <VStack spacing={4} align="stretch">
          <Flex width="100%" alignItems="center" wrap="wrap" gap={2}>
            <Heading size="md">Workspace: {currentWorkspace.name}</Heading>
            <Spacer />
            {isTeamLoaded ? (
              <Button colorScheme="green" onClick={onAddSprintClick} size="sm">
                Add Sprint Data
              </Button>
            ) : (
              <Spinner size="sm" />
            )}
          </Flex>

          {workspaceMembers.length > 0 && (
            <Box width="100%">
              <Text fontWeight="bold" mb={2}>
                Team Members:
              </Text>
              <Grid
                templateColumns="repeat(auto-fill, minmax(180px, 1fr))"
                gap={3}
              >
                {workspaceMembers.map((member) => (
                  <GridItem key={member.id}>
                    <Badge colorScheme="purple" px={2} py={1} variant="outline">
                      {member.name} ({member.role})
                    </Badge>
                  </GridItem>
                ))}
              </Grid>
            </Box>
          )}
        </VStack>
      </CardBody>
    </Card>
  );
};
