import { FC } from "react";
import { Button, VStack, Box, Text, HStack, Badge } from "@chakra-ui/react";
import { Room } from "./RoomListTable"; // Assuming Room type is exported or defined here/imported

interface PokerLandingActionsProps {
  isAuthenticated: boolean;
  currentWorkspace?: { id: string; name: string } | null;
  workspaceRooms: Room[];
  onShowRoomList: () => void;
  onCreateModalOpen: () => void;
  onJoinRoom: (roomId: string) => void;
}

export const PokerLandingActions: FC<PokerLandingActionsProps> = ({
  isAuthenticated,
  currentWorkspace,
  workspaceRooms,
  onShowRoomList,
  onCreateModalOpen,
  onJoinRoom,
}) => {
  return (
    <VStack spacing={6} w={{ base: "full", md: "500px" }}>
      {/* Quick Join for Workspace Rooms */}
      {isAuthenticated && currentWorkspace && workspaceRooms.length > 0 && (
        <Box w="full" mt={4}>
          <Text fontWeight="bold" mb={2}>
            Your Workspace Rooms:
          </Text>
          <VStack
            spacing={2}
            align="stretch"
            // Use theme colors directly if needed, or rely on parent Box bg
            // bg={colorMode === 'light' ? 'white' : 'gray.700'}
            p={4}
            borderRadius="md"
            borderWidth={1} // Add border for visibility
            borderColor="gray.200" // Adjust color as needed
            _dark={{ borderColor: "gray.600" }}
            shadow="sm"
          >
            {workspaceRooms.slice(0, 3).map((room) => (
              <HStack key={room.id} justify="space-between">
                <HStack>
                  <Text fontWeight="medium">{room.name}</Text>
                  <Badge colorScheme="blue">{room.sequence}</Badge>
                </HStack>
                <Button
                  size="sm"
                  colorScheme="blue"
                  onClick={() => onJoinRoom(room.id)}
                >
                  Join
                </Button>
              </HStack>
            ))}
            {workspaceRooms.length > 3 && (
              <Button
                size="sm"
                variant="link"
                colorScheme="blue"
                alignSelf="flex-end"
                onClick={onShowRoomList}
              >
                See all workspace rooms →
              </Button>
            )}
          </VStack>
        </Box>
      )}
      {/* Main Actions */}
      <Button colorScheme="blue" size="lg" w="full" onClick={onCreateModalOpen}>
        Create New Room
      </Button>
      <Button colorScheme="green" size="lg" w="full" onClick={onShowRoomList}>
        Join Existing Room
      </Button>
    </VStack>
  );
};
