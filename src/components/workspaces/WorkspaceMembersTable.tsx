import { FC } from "react";
import {
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Badge,
  Button,
  Icon,
  Box,
} from "@chakra-ui/react";
import { FaUserMinus } from "react-icons/fa";

// Define Member type based on usage in WorkspaceDetail
interface Member {
  id: string;
  name: string;
  email: string;
  role: "admin" | "member" | string; // Allow string for flexibility if other roles exist
}

interface WorkspaceMembersTableProps {
  members: Member[];
  isAdmin: boolean;
  currentUserId?: string | null; // ID of the currently logged-in user
  onRemoveMember: (member: Member) => void; // Callback to open remove dialog
}

const WorkspaceMembersTable: FC<WorkspaceMembersTableProps> = ({
  members,
  isAdmin,
  currentUserId,
  onRemoveMember,
}) => {
  return (
    <Box overflowX="auto">
      <Table variant="simple">
        <Thead>
          <Tr>
            <Th>Name</Th>
            <Th>Email</Th>
            <Th>Role</Th>
            {isAdmin && <Th width="100px">Actions</Th>}
          </Tr>
        </Thead>
        <Tbody>
          {members.map((member) => (
            <Tr key={member.id}>
              <Td>{member.name}</Td>
              <Td>{member.email}</Td>
              <Td>
                <Badge colorScheme={member.role === "admin" ? "green" : "blue"}>
                  {member.role}
                </Badge>
              </Td>
              {isAdmin && (
                <Td>
                  {/* Prevent admin from removing themselves */}
                  {member.id !== currentUserId && (
                    <Button
                      size="sm"
                      colorScheme="red"
                      variant="ghost"
                      leftIcon={<Icon as={FaUserMinus} />}
                      onClick={() => onRemoveMember(member)}
                    >
                      Remove
                    </Button>
                  )}
                </Td>
              )}
            </Tr>
          ))}
        </Tbody>
      </Table>
    </Box>
  );
};

export default WorkspaceMembersTable;
