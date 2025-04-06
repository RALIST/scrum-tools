import { FC } from "react";
import {
  Box,
  Heading,
  Text,
  Button,
  VStack,
  HStack,
  SimpleGrid,
  Spinner,
  Center,
  useColorMode,
} from "@chakra-ui/react";
import { Link as RouterLink } from "react-router-dom";
import { WorkspaceToolsPanelProps } from "../../hooks/useWorkspaceTools";

const WorkspaceToolsPanel: FC<WorkspaceToolsPanelProps> = ({
  pokerRooms,
  retroBoards,
  velocityTeams,
  isLoadingTools,
}) => {
  const { colorMode } = useColorMode();

  if (isLoadingTools) {
    return (
      <Center h="100px">
        <Spinner />
      </Center>
    );
  }

  return (
    <VStack spacing={8} align="stretch" mt={4}>
      {/* Poker Rooms Section */}
      <Box>
        <HStack justify="space-between" mb={4}>
          <Heading size="md">Planning Poker Rooms</Heading>
          <Button
            as={RouterLink}
            to="/planning-poker"
            size="sm"
            colorScheme="blue"
          >
            Create/View Rooms
          </Button>
        </HStack>
        {pokerRooms.length > 0 ? (
          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
            {pokerRooms.map((room) => (
              <Box
                key={room.id}
                p={4}
                borderWidth={1}
                borderRadius="md"
                bg={colorMode === "light" ? "white" : "gray.700"}
              >
                <HStack justify="space-between">
                  <Text fontWeight="medium">{room.name || room.id}</Text>{" "}
                  {/* Fallback to ID if name is empty */}
                  <Button
                    as={RouterLink}
                    to={`/planning-poker/${room.id}`}
                    size="xs"
                    colorScheme="blue"
                  >
                    Open
                  </Button>
                </HStack>
                <Text fontSize="sm" color="gray.500">
                  Participants: {room.participantCount}
                </Text>
                {/* Display sequence key directly */}
                <Text fontSize="sm" color="gray.500">
                  Sequence: {room.sequence}
                </Text>
              </Box>
            ))}
          </SimpleGrid>
        ) : (
          <Text>No Planning Poker rooms found in this workspace.</Text>
        )}
      </Box>

      {/* Retro Boards Section */}
      <Box>
        <HStack justify="space-between" mb={4}>
          <Heading size="md">Retrospective Boards</Heading>
          <Button as={RouterLink} to="/retro" size="sm" colorScheme="green">
            Create/View Boards
          </Button>
        </HStack>
        {retroBoards.length > 0 ? (
          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
            {retroBoards.map((board) => (
              <Box
                key={board.id}
                p={4}
                borderWidth={1}
                borderRadius="md"
                bg={colorMode === "light" ? "white" : "gray.700"}
              >
                <HStack justify="space-between">
                  <Text fontWeight="medium">{board.name}</Text>
                  <Button
                    as={RouterLink}
                    to={`/retro/${board.id}`}
                    size="xs"
                    colorScheme="green"
                  >
                    Open
                  </Button>
                </HStack>
                <Text fontSize="sm" color="gray.500">
                  Cards: {board.cardCount}
                </Text>
              </Box>
            ))}
          </SimpleGrid>
        ) : (
          <Text>No Retrospective boards found in this workspace.</Text>
        )}
      </Box>

      {/* Velocity Teams Section */}
      <Box>
        <HStack justify="space-between" mb={4}>
          <Heading size="md">Velocity Teams</Heading>
          <Button as={RouterLink} to="/velocity" size="sm" colorScheme="purple">
            View/Manage
          </Button>
        </HStack>
        {velocityTeams.length > 0 ? (
          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
            {velocityTeams.map((team) => (
              <Box
                key={team.id}
                p={4}
                borderWidth={1}
                borderRadius="md"
                bg={colorMode === "light" ? "white" : "gray.700"}
              >
                <HStack justify="space-between">
                  <Text fontWeight="medium">{team.name}</Text>
                  {/* Maybe link to velocity page with team pre-selected? Needs more logic */}
                  {/* <Button as={RouterLink} to={`/velocity?team=${team.id}`} size="xs" colorScheme="purple">View</Button> */}
                </HStack>
                <Text fontSize="sm" color="gray.500">
                  Avg Velocity: {team.avgVelocityPreview ?? "N/A"}
                </Text>
              </Box>
            ))}
          </SimpleGrid>
        ) : (
          <Text>
            No Velocity teams found in this workspace. Go to the{" "}
            <RouterLink to="/velocity">
              <Text
                as="span"
                color="blue.500"
                _hover={{ textDecoration: "underline" }}
              >
                Velocity page
              </Text>
            </RouterLink>{" "}
            to get started.
          </Text>
        )}
      </Box>
    </VStack>
  );
};

export default WorkspaceToolsPanel;
