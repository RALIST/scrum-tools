import { FC, useCallback } from "react";
import {
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Badge,
  Text,
  TableContainer,
  Box,
} from "@chakra-ui/react";
import { SEQUENCES, SequenceType } from "../../constants/poker"; // Import necessary types/constants

// Define Participant type based on usage in PlanningPokerRoom
interface Participant {
  id: string;
  name: string;
  vote: string | null;
}

// Define Settings type based on usage
interface RoomSettings {
  sequence: SequenceType;
  // Add other settings if needed by calculation logic
}

interface ParticipantsTableProps {
  participants: Participant[] | null;
  isRevealed: boolean;
  settings: RoomSettings | null; // Pass settings for calculations
}

export const ParticipantsTable: FC<ParticipantsTableProps> = ({
  participants,
  isRevealed,
  settings,
}) => {
  const calculateAverage = useCallback(() => {
    if (!participants) return 0;
    const numericVotes = participants
      .map((p) => p.vote)
      .filter((v) => v && v !== "?" && !isNaN(Number(v)))
      .map(Number);
    if (numericVotes.length === 0) return 0;
    return numericVotes.reduce((a, b) => a + b, 0) / numericVotes.length;
  }, [participants]);

  const getVoteColor = useCallback(
    (vote: string | null) => {
      if (!vote || vote === "?" || !isRevealed || !settings) return undefined;
      const voteNum = Number(vote);
      const average = calculateAverage();
      if (isNaN(voteNum)) return undefined;
      const sequenceValues = SEQUENCES[settings.sequence] || [];
      const maxDiff = Math.max(
        ...sequenceValues
          .filter((v) => v !== "?" && !isNaN(Number(v)))
          .map((v) => Math.abs(Number(v) - average))
      );
      if (maxDiff === 0) return "green.500"; // All votes are the same number
      const diff = Math.abs(voteNum - average);
      const percentage = diff / maxDiff;
      if (percentage <= 0.2) return "green.500";
      if (percentage <= 0.4) return "green.300";
      if (percentage <= 0.6) return "yellow.400";
      if (percentage <= 0.8) return "orange.400";
      return "red.500";
    },
    [isRevealed, settings, calculateAverage]
  );

  if (!participants || !settings) {
    return null; // Or a loading/empty state
  }

  return (
    <Box w="full" overflowX="auto">
      <TableContainer>
        <Table variant="simple" size={{ base: "sm", md: "md" }}>
          <Thead>
            <Tr>
              <Th>Participant</Th>
              <Th>Status</Th>
              {isRevealed && <Th>Vote</Th>}
            </Tr>
          </Thead>
          <Tbody>
            {participants.map((participant) => (
              <Tr key={participant.id}>
                <Td>{participant.name}</Td>
                <Td>
                  <Badge colorScheme={participant.vote ? "green" : "yellow"}>
                    {participant.vote ? "Voted" : "Not Voted"}
                  </Badge>
                </Td>
                {isRevealed && (
                  <Td>
                    <Text
                      color={getVoteColor(participant.vote)}
                      fontWeight="bold"
                    >
                      {participant.vote || "No vote"}
                    </Text>
                  </Td>
                )}
              </Tr>
            ))}
          </Tbody>
        </Table>
      </TableContainer>
      {isRevealed && (
        <Text
          mt={4}
          fontWeight="bold"
          textAlign={{ base: "center", md: "left" }}
        >
          Average (excluding '?'): {calculateAverage().toFixed(1)}
        </Text>
      )}
    </Box>
  );
};
