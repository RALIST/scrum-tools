import {
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Button,
  TableContainer,
  Box,
  Heading,
  HStack,
  Badge,
  Text,
} from "@chakra-ui/react";
import type { FC } from "react";

export interface Room {
  id: string;
  name: string;
  participantCount: number;
  createdAt: string;
  hasPassword: boolean;
  sequence: string; // Changed back to string (key)
  workspace_id?: string;
  created_by?: string;
}

interface RoomListTableProps {
  title: string; // e.g., "Public Rooms" or "Workspace Rooms"
  rooms: Room[];
  onJoinRoom: (roomId: string) => void;
  showWorkspaceInfo?: boolean; // To show workspace badge if needed
  workspaceName?: string; // Name of the workspace
}

export const RoomListTable: FC<RoomListTableProps> = ({
  title,
  rooms,
  onJoinRoom,
  showWorkspaceInfo = false,
  workspaceName,
}) => {
  if (rooms.length === 0) {
    return (
      <Box w="full">
        <HStack mb={3}>
          <Heading size="sm">{title}</Heading>
          {showWorkspaceInfo && workspaceName ? <Badge colorScheme="blue">{workspaceName}</Badge> : null}
        </HStack>
        <Text>No active rooms found.</Text>
      </Box>
    );
  }

  return (
    <Box w="full">
      <HStack mb={3}>
        <Heading size="sm">{title}</Heading>
        {showWorkspaceInfo && workspaceName ? <Badge colorScheme="blue">{workspaceName}</Badge> : null}
      </HStack>
      <Box w="full" overflowX="auto">
        <TableContainer>
          <Table variant="simple" size={{ base: "sm", md: "md" }}>
            <Thead>
              <Tr>
                {showWorkspaceInfo ? <Th>Room Name</Th> : null}
                <Th>Room ID</Th>
                <Th>Participants</Th>
                <Th>Sequence</Th>
                <Th>Protected</Th>
                <Th>Action</Th>
              </Tr>
            </Thead>
            <Tbody>
              {rooms.map((room) => (
                <Tr key={room.id}>
                  {showWorkspaceInfo ? <Td fontWeight="medium">{room.name}</Td> : null}
                  <Td>{room.id}</Td>
                  <Td>{room.participantCount}</Td>
                  {/* Display sequence key directly */}
                  <Td>{room.sequence}</Td>
                  <Td>{room.hasPassword ? "Yes" : "No"}</Td>
                  <Td>
                    <Button
                      size="sm"
                      colorScheme="blue"
                      onClick={() => { onJoinRoom(room.id); }}
                    >
                      Join
                    </Button>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </TableContainer>
      </Box>
    </Box>
  );
};
