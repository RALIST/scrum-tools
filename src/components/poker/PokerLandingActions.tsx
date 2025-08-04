import { FC, memo } from 'react';
import { Button, VStack, Box, Text, HStack, Badge } from '@chakra-ui/react';
import { Room } from './RoomListTable';

interface PokerLandingActionsProps {
  isAuthenticated: boolean;
  currentWorkspace: { id: string; name: string; created_at: string } | null;
  rooms: Room[];
  onShowRoomList: () => void;
  onCreateModalOpen: () => void;
  onJoinRoom: (roomId: string) => void;
}

export const PokerLandingActions: FC<PokerLandingActionsProps> = memo(
  ({
    isAuthenticated,
    currentWorkspace,
    rooms, // Changed from workspaceRooms
    onShowRoomList,
    onCreateModalOpen,
    onJoinRoom,
  }) => {
    return (
      <VStack spacing={6} w={{ base: 'full', md: '500px' }}>
        {/* Quick Join for Workspace Rooms (now uses the filtered 'rooms' list) */}
        {isAuthenticated && currentWorkspace && rooms.length > 0 && (
          <Box w="full" mt={4}>
            <Text fontWeight="bold" mb={2}>
              Rooms in {currentWorkspace.name}:
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
              _dark={{ borderColor: 'gray.600' }}
              shadow="sm"
            >
              {/* Display rooms from the passed 'rooms' prop */}
              {rooms.slice(0, 3).map(room => (
                <HStack key={room.id} justify="space-between">
                  <HStack>
                    <Text fontWeight="medium">{room.name}</Text>
                    <Badge colorScheme="blue">{room.sequence}</Badge>
                  </HStack>
                  <Button size="sm" colorScheme="blue" onClick={() => onJoinRoom(room.id)}>
                    Join
                  </Button>
                </HStack>
              ))}
              {/* Link to see all rooms (now just toggles the main list view) */}
              {rooms.length > 3 && (
                <Button
                  size="sm"
                  variant="link"
                  colorScheme="blue"
                  alignSelf="flex-end"
                  onClick={onShowRoomList}
                >
                  See all rooms →
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
  }
);

PokerLandingActions.displayName = 'PokerLandingActions';
