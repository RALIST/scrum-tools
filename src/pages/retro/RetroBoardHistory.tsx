import { FC, useState, useEffect } from "react";
import {
  Box,
  Heading,
  Text,
  Button,
  VStack,
  HStack,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  SimpleGrid,
  Card,
  CardHeader,
  CardBody,
  Badge,
  Spinner,
  Center,
  Flex,
  useToast,
  useColorMode,
} from "@chakra-ui/react";
import { useParams, Link as RouterLink } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import config from "../../config";
import PageHelmet from "../../components/PageHelmet";
// We'll use a manual date formatter since date-fns might not be available
const formatDate = (dateString: string) => {
  try {
    const date = new Date(dateString);
    return date.toLocaleString();
  } catch (error) {
    return dateString;
  }
};

interface HistorySnapshot {
  id: string;
  board_id: string;
  snapshot: {
    cards: any[];
    board: any;
  };
  created_at: string;
}

const RetroBoardHistory: FC = () => {
  const { boardId } = useParams<{ boardId: string }>();
  const { token } = useAuth();
  const [history, setHistory] = useState<HistorySnapshot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSnapshot, setSelectedSnapshot] =
    useState<HistorySnapshot | null>(null);
  const [boardName, setBoardName] = useState("");
  const toast = useToast();
  const { colorMode } = useColorMode();

  useEffect(() => {
    const fetchHistory = async () => {
      if (!boardId || !token) return;

      setIsLoading(true);
      try {
        const response = await fetch(
          `${config.apiUrl}/history/retro/${boardId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error("Failed to fetch history");
        }

        const data = await response.json();
        setHistory(data);

        if (data.length > 0) {
          setBoardName(data[0].snapshot.board.name || "Retro Board");
          setSelectedSnapshot(data[0]);
        }
      } catch (error) {
        console.error("Error fetching history:", error);
        toast({
          title: "Error",
          description: "Failed to load board history",
          status: "error",
          duration: 5000,
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchHistory();
  }, [boardId, token, toast]);

  // We're now using the formatDate function defined at the top of the file

  const getCardsForColumn = (columnId: string) => {
    if (!selectedSnapshot) return [];
    return selectedSnapshot.snapshot.cards.filter(
      (card) => card.column_id === columnId
    );
  };

  if (isLoading) {
    return (
      <Center h="200px">
        <Spinner size="xl" color="blue.500" />
      </Center>
    );
  }

  if (history.length === 0) {
    return (
      <Box textAlign="center" p={8}>
        <PageHelmet
          title="Board History - Scrum Tools"
          description="View the history of your retrospective board"
          keywords="scrum history, retro board history, retrospective timeline"
          canonicalUrl={`/retro/${boardId}/history`}
        />
        <Heading size="lg" mb={4}>
          No History Available
        </Heading>
        <Text mb={6}>
          This board doesn't have any saved history snapshots yet.
        </Text>
        <Button as={RouterLink} to={`/retro/${boardId}`} colorScheme="blue">
          Return to Board
        </Button>
      </Box>
    );
  }

  return (
    <Box>
      <PageHelmet
        title={`${boardName} History - Scrum Tools`}
        description="View the history and previous states of your retrospective board"
        keywords="scrum history, retro board history, retrospective timeline, board snapshots"
        canonicalUrl={`/retro/${boardId}/history`}
      />

      <HStack justifyContent="space-between" mb={6} flexWrap="wrap">
        <VStack align="start" spacing={1}>
          <Heading size="xl">{boardName} - History</Heading>
          <Text color="gray.500">View previous board states</Text>
        </VStack>

        <Button
          as={RouterLink}
          to={`/retro/${boardId}`}
          colorScheme="blue"
          variant="outline"
          mt={{ base: 4, md: 0 }}
        >
          Return to Active Board
        </Button>
      </HStack>

      <Flex direction={{ base: "column", lg: "row" }} gap={6}>
        {/* History Timeline */}
        <Box
          flex="1"
          maxW={{ base: "100%", lg: "300px" }}
          bg={colorMode === "light" ? "white" : "gray.700"}
          p={4}
          borderRadius="md"
          shadow="md"
          minH="400px"
        >
          <Heading size="md" mb={4}>
            Snapshots
          </Heading>

          <Accordion allowToggle defaultIndex={[0]}>
            {history.map((snapshot, index) => (
              <AccordionItem key={snapshot.id}>
                <h2>
                  <AccordionButton
                    _expanded={{ bg: "blue.50", color: "blue.800" }}
                    onClick={() => setSelectedSnapshot(snapshot)}
                  >
                    <Box flex="1" textAlign="left">
                      <Text fontWeight="bold">
                        Snapshot {history.length - index}
                      </Text>
                      <Text fontSize="sm" color="gray.500">
                        {formatDate(snapshot.created_at)}
                      </Text>
                    </Box>
                    <AccordionIcon />
                  </AccordionButton>
                </h2>
                <AccordionPanel pb={4}>
                  <Text fontSize="sm">
                    Cards: {snapshot.snapshot.cards.length}
                  </Text>
                  <Button
                    size="sm"
                    colorScheme="blue"
                    variant="ghost"
                    mt={2}
                    onClick={() => setSelectedSnapshot(snapshot)}
                  >
                    View Snapshot
                  </Button>
                </AccordionPanel>
              </AccordionItem>
            ))}
          </Accordion>
        </Box>

        {/* Snapshot Content */}
        <Box flex="3">
          {selectedSnapshot ? (
            <VStack align="stretch" spacing={6}>
              <HStack justify="space-between">
                <Heading size="md">
                  Snapshot from {formatDate(selectedSnapshot.created_at)}
                </Heading>
              </HStack>

              <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
                {/* What Went Well Column */}
                <Box>
                  <Heading
                    size="sm"
                    mb={3}
                    p={2}
                    bg="green.100"
                    color="green.800"
                    borderRadius="md"
                  >
                    What Went Well
                  </Heading>
                  <VStack align="stretch" spacing={3}>
                    {getCardsForColumn("went-well").map((card) => (
                      <Card key={card.id} size="sm" variant="outline">
                        <CardHeader pb={0}>
                          <Badge fontSize="xs" colorScheme="green">
                            {card.author_name}
                          </Badge>
                        </CardHeader>
                        <CardBody pt={2}>
                          <Text fontSize="sm">{card.text}</Text>
                        </CardBody>
                      </Card>
                    ))}
                    {getCardsForColumn("went-well").length === 0 && (
                      <Text
                        fontSize="sm"
                        color="gray.500"
                        textAlign="center"
                        p={2}
                      >
                        No cards in this column
                      </Text>
                    )}
                  </VStack>
                </Box>

                {/* Needs Improvement Column */}
                <Box>
                  <Heading
                    size="sm"
                    mb={3}
                    p={2}
                    bg="red.100"
                    color="red.800"
                    borderRadius="md"
                  >
                    Needs Improvement
                  </Heading>
                  <VStack align="stretch" spacing={3}>
                    {getCardsForColumn("to-improve").map((card) => (
                      <Card key={card.id} size="sm" variant="outline">
                        <CardHeader pb={0}>
                          <Badge fontSize="xs" colorScheme="red">
                            {card.author_name}
                          </Badge>
                        </CardHeader>
                        <CardBody pt={2}>
                          <Text fontSize="sm">{card.text}</Text>
                        </CardBody>
                      </Card>
                    ))}
                    {getCardsForColumn("to-improve").length === 0 && (
                      <Text
                        fontSize="sm"
                        color="gray.500"
                        textAlign="center"
                        p={2}
                      >
                        No cards in this column
                      </Text>
                    )}
                  </VStack>
                </Box>

                {/* Action Items Column */}
                <Box>
                  <Heading
                    size="sm"
                    mb={3}
                    p={2}
                    bg="blue.100"
                    color="blue.800"
                    borderRadius="md"
                  >
                    Action Items
                  </Heading>
                  <VStack align="stretch" spacing={3}>
                    {getCardsForColumn("action-items").map((card) => (
                      <Card key={card.id} size="sm" variant="outline">
                        <CardHeader pb={0}>
                          <Badge fontSize="xs" colorScheme="blue">
                            {card.author_name}
                          </Badge>
                        </CardHeader>
                        <CardBody pt={2}>
                          <Text fontSize="sm">{card.text}</Text>
                        </CardBody>
                      </Card>
                    ))}
                    {getCardsForColumn("action-items").length === 0 && (
                      <Text
                        fontSize="sm"
                        color="gray.500"
                        textAlign="center"
                        p={2}
                      >
                        No cards in this column
                      </Text>
                    )}
                  </VStack>
                </Box>
              </SimpleGrid>
            </VStack>
          ) : (
            <Center h="400px">
              <Text>Select a snapshot to view</Text>
            </Center>
          )}
        </Box>
      </Flex>
    </Box>
  );
};

export default RetroBoardHistory;
