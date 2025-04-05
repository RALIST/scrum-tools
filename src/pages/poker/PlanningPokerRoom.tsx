import { FC, useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Box,
  Heading,
  Button,
  Text,
  VStack,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Badge,
  IconButton,
  useColorMode,
  useToast,
  Stack,
  TableContainer,
  Wrap,
  WrapItem,
  useClipboard,
  useDisclosure,
  Tooltip,
  Divider,
  Spinner, // Import Spinner
  Center, // Import Center
} from "@chakra-ui/react";
import { CopyIcon, CheckIcon, SettingsIcon, EditIcon } from "@chakra-ui/icons";
import PageContainer from "../../components/PageContainer";
import { Helmet } from "react-helmet-async";
import { SEQUENCES, SequenceType } from "../../constants/poker";
import {
  JoinRoomModal,
  ChangeNameModal,
  RoomSettingsModal,
} from "../../components/modals";
import { usePokerSocket } from "../../hooks/usePokerSocket";
import { useAuth } from "../../contexts/AuthContext"; // Import useAuth
import { apiRequest } from "../../utils/apiUtils"; // Import apiRequest
import config from "../../config";

const LOCAL_STORAGE_USERNAME_KEY = "planningPokerUsername";

interface CardProps {
  value: string;
  isSelected: boolean;
  onClick: () => void;
  disabled?: boolean;
}

const Card: FC<CardProps> = ({ value, isSelected, onClick, disabled }) => {
  const { colorMode } = useColorMode();

  return (
    <Button
      h={{ base: "100px", md: "120px" }}
      w={{ base: "70px", md: "80px" }}
      fontSize={{ base: "xl", md: "2xl" }}
      variant="outline"
      colorScheme={isSelected ? "blue" : "gray"}
      bg={
        isSelected
          ? colorMode === "light"
            ? "blue.50"
            : "blue.900"
          : "transparent"
      }
      onClick={onClick}
      disabled={disabled}
      _hover={{
        transform: disabled ? "none" : "translateY(-4px)",
        transition: "transform 0.2s",
      }}
    >
      {value}
    </Button>
  );
};

const PlanningPokerRoom: FC = () => {
  const { colorMode } = useColorMode();
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const { user, isAuthenticated } = useAuth(); // Get auth state
  const [userName, setUserName] = useState(""); // Initialize empty, set in useEffect
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const shareableLink = useMemo(
    () => `${config.siteUrl}/planning-poker/${roomId}`,
    [roomId]
  );
  const { hasCopied, onCopy } = useClipboard(shareableLink);
  const {
    isOpen: isChangeNameOpen,
    onOpen: onChangeNameOpen,
    onClose: onChangeNameClose,
  } = useDisclosure();
  const {
    isOpen: isSettingsOpen,
    onOpen: onSettingsOpen,
    onClose: onSettingsClose,
  } = useDisclosure();
  const [newUserName, setNewUserName] = useState<string>("");
  const [roomPassword, setRoomPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState(false);
  const [newSettings, setNewSettings] = useState<{
    sequence?: SequenceType;
    password?: string;
  }>({});
  const [isPasswordProtected, setIsPasswordProtected] = useState(false);
  const [isLoadingRoomInfo, setIsLoadingRoomInfo] = useState(true);
  const [roomExists, setRoomExists] = useState<boolean | null>(null); // null: unknown, true: exists, false: not found

  const onRoomJoined = useCallback(() => {
    toast({
      title: "Joined Room",
      status: "success",
      duration: 2000,
    });
    // No need for showJoinModal state anymore
  }, [toast]); // Add toast dependency back

  // Conditionally call the socket hook only if the room is known to exist
  const socketData = usePokerSocket({
    // Pass roomId only if roomExists is true, otherwise pass empty string to disable hook internally
    roomId: roomExists === true ? roomId || "" : "",
    onRoomJoined,
  });

  // Destructure later, only when roomExists is true
  const {
    participants,
    settings,
    isRevealed,
    isJoined,
    joinRoom,
    changeName,
    vote,
    revealVotes,
    resetVotes,
    updateSettings: updateRoomSettings,
    isConnectingOrJoining,
  } = socketData;

  // Check room password protection and set initial username
  useEffect(() => {
    // Set initial username from auth or localStorage
    console.log("[PlanningPokerRoom] useEffect: Setting initial username.");
    if (isAuthenticated && user?.name) {
      setUserName(user.name);
    } else {
      const savedName = localStorage.getItem(LOCAL_STORAGE_USERNAME_KEY);
      if (savedName) {
        setUserName(savedName);
      } else {
        setUserName(""); // Ensure it's empty if nothing found
      }
    }

    // Check password protection
    if (!roomId) {
      console.log(
        "[PlanningPokerRoom] useEffect: No roomId found, navigating back."
      );
      navigate("/planning-poker");
      return;
    }
    console.log(
      `[PlanningPokerRoom] useEffect: Checking room existence for roomId: ${roomId}`
    );

    let isActive = true;
    setRoomExists(null); // Reset existence state on new roomId check
    setIsLoadingRoomInfo(true);
    console.log(
      "[PlanningPokerRoom] useEffect: Set isLoadingRoomInfo=true, roomExists=null"
    );

    // Use the new specific endpoint to check room existence and password status
    apiRequest<{ id: string; hasPassword: boolean }>(
      `/poker/rooms/${roomId}/info`,
      {
        method: "GET",
        includeAuth: false, // No auth needed just to check existence/password status
      }
    )
      .then((roomInfo) => {
        // The endpoint returns the room info directly if found, or 404 if not
        if (!isActive) {
          console.log(
            "[PlanningPokerRoom] useEffect: API returned but component inactive."
          );
          return;
        }
        console.log(
          `[PlanningPokerRoom] useEffect: API /poker/rooms/${roomId}/info returned:`,
          roomInfo
        );
        // If we get here, the room exists (no 404 was thrown by apiRequest)
        setIsPasswordProtected(roomInfo.hasPassword);
        setRoomExists(true);
        console.log(
          "[PlanningPokerRoom] useEffect: Set roomExists=true, isPasswordProtected=",
          roomInfo.hasPassword
        );
      })
      .catch((err: any) => {
        // Catch specific errors
        if (!isActive) return;
        console.error(
          `[PlanningPokerRoom] useEffect: Error fetching room info for ${roomId}:`,
          err
        );
        setRoomExists(false); // Assume room doesn't exist on error

        // Check if it was a 404 error specifically
        if (err.message && err.message.includes("404")) {
          console.log(
            "[PlanningPokerRoom] useEffect: Set roomExists=false (404 Not Found from API)"
          );
          toast({ title: "Room not found", status: "error", duration: 3000 });
        } else {
          // Generic error for other issues (network, server error, etc.)
          console.log(
            "[PlanningPokerRoom] useEffect: Set roomExists=false due to other API error"
          );
          toast({
            title: "Error checking room",
            status: "error",
            duration: 3000,
          });
        }
      })
      .finally(() => {
        if (isActive) {
          setIsLoadingRoomInfo(false);
          console.log(
            "[PlanningPokerRoom] useEffect: Set isLoadingRoomInfo=false"
          );
        }
      });

    return () => {
      console.log(
        `[PlanningPokerRoom] useEffect: Cleanup for roomId: ${roomId}`
      );
      isActive = false;
    };
    // Only re-fetch if roomId changes.
  }, [roomId, navigate, toast]);

  // Effect for automatic joining when authenticated and applicable
  useEffect(() => {
    // Trigger only if room exists, user is authenticated, room doesn't require password, and not already joined/joining
    if (
      roomExists === true &&
      isAuthenticated &&
      user?.name &&
      !isPasswordProtected &&
      !isJoined &&
      !isConnectingOrJoining
    ) {
      // Use console.log instead of debugLog which is not defined here
      console.log("[PlanningPokerRoom] Auto-joining authenticated user:", {
        userName: user.name,
      });
      // We need access to the joinRoom function from the hook here.
      // Ensure socketData is destructured or accessed correctly.
      // Let's assume socketData.joinRoom is available.
      socketData.joinRoom(user.name); // Automatically join with user's name
    }
    // Dependencies: run when room existence is confirmed, auth state changes, password status known, or join status changes
  }, [
    roomExists,
    isAuthenticated,
    user?.name,
    isPasswordProtected,
    isJoined,
    isConnectingOrJoining,
    socketData.joinRoom, // Added socketData.joinRoom dependency
  ]);

  const handleJoinRoom = useCallback(() => {
    if (!userName.trim()) {
      toast({
        title: "Error",
        description: "Please enter your name",
        status: "error",
        duration: 2000,
      });
      return;
    }

    if (isPasswordProtected && !roomPassword.trim()) {
      toast({
        title: "Error",
        description: "Please enter the room password",
        status: "error",
        duration: 2000,
      });
      return;
    }
    // Save name to localStorage only if user is NOT authenticated
    if (!isAuthenticated) {
      localStorage.setItem(LOCAL_STORAGE_USERNAME_KEY, userName);
    }
    joinRoom(userName, roomPassword);
  }, [
    userName,
    roomPassword,
    isPasswordProtected,
    joinRoom,
    toast,
    isAuthenticated,
  ]);

  const handleChangeName = useCallback(() => {
    // Should not be callable if authenticated, but add check just in case
    if (isAuthenticated) return;

    if (!newUserName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a valid name",
        status: "error",
        duration: 2000,
      });
      return;
    }

    localStorage.setItem(LOCAL_STORAGE_USERNAME_KEY, newUserName);
    setUserName(newUserName);
    changeName(newUserName);
    onChangeNameClose();
    toast({
      title: "Name Updated",
      status: "success",
      duration: 2000,
    });
  }, [newUserName, changeName, onChangeNameClose, toast, isAuthenticated]);

  const handleUpdateSettings = useCallback(() => {
    updateRoomSettings(newSettings);
    onSettingsClose();
    setNewSettings({});
  }, [newSettings, updateRoomSettings, onSettingsClose]);

  const handleCardSelect = useCallback(
    (value: string) => {
      setSelectedCard(value);
      vote(value);
      toast({
        title: "Vote Recorded",
        description: `You selected ${value} points`,
        status: "success",
        duration: 2000,
      });
    },
    [vote, toast]
  );

  const calculateAverage = useCallback(() => {
    // Ensure participants is available before calculating
    if (!participants) return 0;
    const numericVotes = participants
      .map((p) => p.vote)
      .filter((vote) => vote && vote !== "?" && !isNaN(Number(vote)))
      .map(Number);

    if (numericVotes.length === 0) return 0;
    const avg = numericVotes.reduce((a, b) => a + b, 0) / numericVotes.length;
    return avg;
  }, [participants]);

  const getVoteColor = useCallback(
    (vote: string | null) => {
      // Ensure settings is available
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

      // Avoid division by zero if maxDiff is 0
      if (maxDiff === 0) return "green.500";

      const diff = Math.abs(voteNum - average);
      const percentage = diff / maxDiff;

      if (percentage <= 0.2) return "green.500";
      if (percentage <= 0.4) return "green.300";
      if (percentage <= 0.6) return "yellow.400";
      if (percentage <= 0.8) return "orange.400";
      return "red.500";
    },
    [isRevealed, settings, calculateAverage] // Added settings dependency
  );

  // --- Loading and Room Existence Handling ---

  // Show loading spinner while checking room info OR connecting socket *if* room existence is not yet determined or is true
  const showLoadingSpinner =
    isLoadingRoomInfo || (roomExists !== false && isConnectingOrJoining);

  if (showLoadingSpinner) {
    return (
      <Center minH="calc(100vh - 60px)">
        <Spinner size="xl" />
      </Center>
    );
  }

  // Handle case where room explicitly does not exist after checking
  if (roomExists === false) {
    return (
      <Center minH="calc(100vh - 60px)">
        <VStack spacing={4}>
          <Heading size="md">Room Not Found</Heading>
          <Text>The requested poker room does not exist.</Text>
          <Button onClick={() => navigate("/planning-poker")}>
            Back to Poker Rooms
          </Button>
        </VStack>
      </Center>
    );
  }

  // Determine if the join modal should be open
  // Show if: room exists, not currently joining/connecting, not already joined, AND (user is unauthenticated OR room needs a password)
  const shouldShowJoinModal =
    roomExists === true &&
    !isConnectingOrJoining && // Don't show modal while attempting auto-join or connecting
    !isJoined &&
    (!isAuthenticated || isPasswordProtected);

  // Render room content OR the modal (only if roomExists is true)
  // Render the main structure always, conditionally render modal and room content details
  return (
    <PageContainer>
      <Helmet>
        <title>Planning Poker Room {roomId}</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <Box
        bg={colorMode === "light" ? "gray.50" : "gray.900"}
        minH="calc(100vh - 60px)"
      >
        {/* Render Join Modal conditionally */}
        <JoinRoomModal
          isOpen={shouldShowJoinModal} // Use the calculated state
          userName={userName}
          roomPassword={roomPassword}
          showPassword={showPassword}
          isPasswordProtected={isPasswordProtected}
          onUserNameChange={setUserName}
          onPasswordChange={setRoomPassword}
          onTogglePassword={() => setShowPassword(!showPassword)}
          onJoin={handleJoinRoom}
        />

        {/* Render room content structure only if room exists */}
        {roomExists === true && (
          <VStack spacing={{ base: 4, md: 8 }}>
            {/* Header Section - Render basic info always */}
            <Box textAlign="center" w="full">
              <Heading
                size={{ base: "lg", md: "xl" }}
                mb={4}
                textAlign={"center"}
              >
                <Stack
                  direction={{ base: "column", md: "row" }}
                  spacing={2}
                  align="center"
                >
                  <Text>Room {roomId}</Text>
                  <Stack direction={"row"} spacing={2}>
                    <Tooltip label={"Copy link to room"}>
                      <IconButton
                        title="Copy link"
                        aria-label="Copy link"
                        icon={hasCopied ? <CheckIcon /> : <CopyIcon />}
                        onClick={() => {
                          onCopy(); // Correctly call onCopy
                          toast({
                            title: "Link to room copied",
                            status: "success",
                            duration: 2000,
                          });
                        }}
                        size="sm"
                      />
                    </Tooltip>
                    <Tooltip label={"Change room settings"}>
                      <IconButton
                        aria-label="Room Settings"
                        icon={<SettingsIcon />}
                        size="sm"
                        onClick={onSettingsOpen}
                      />
                    </Tooltip>
                  </Stack>
                </Stack>
              </Heading>
              <Divider my={2} />
              {/* Show user name only if joined */}
              {isJoined && (
                <VStack spacing={2}>
                  <Stack direction="row" spacing={2}>
                    <Text
                      fontSize={{ base: "md", md: "lg" }}
                      color={colorMode === "light" ? "gray.600" : "gray.300"}
                    >
                      Playing as: {userName}
                    </Text>
                    {/* Hide change name button if authenticated */}
                    {!isAuthenticated && (
                      <IconButton
                        aria-label="Change name"
                        icon={<EditIcon />}
                        size="xs"
                        onClick={() => {
                          setNewUserName(userName);
                          onChangeNameOpen();
                        }}
                      />
                    )}
                  </Stack>
                </VStack>
              )}
            </Box>

            {/* Main Content (Cards, Table, Buttons) - Only if joined AND data is available */}
            {isJoined && participants && settings && (
              <Box
                w="full"
                p={{ base: 4, md: 8 }}
                borderRadius="lg"
                bg={colorMode === "light" ? "white" : "gray.700"}
                shadow="md"
              >
                <VStack spacing={{ base: 4, md: 8 }}>
                  <Wrap spacing={4} justify="center">
                    {(SEQUENCES[settings.sequence] || []).map((value) => (
                      <WrapItem key={value}>
                        <Card
                          value={value}
                          isSelected={selectedCard === value}
                          onClick={() => handleCardSelect(value)}
                          disabled={isRevealed}
                        />
                      </WrapItem>
                    ))}
                  </Wrap>

                  <Stack
                    direction={{ base: "column", md: "row" }}
                    spacing={4}
                    justify="center"
                    w="full"
                  >
                    <Button
                      colorScheme="blue"
                      onClick={revealVotes}
                      disabled={isRevealed}
                      w={{ base: "full", md: "auto" }}
                    >
                      Reveal Votes
                    </Button>
                    <Button
                      colorScheme="orange"
                      onClick={resetVotes}
                      w={{ base: "full", md: "auto" }}
                    >
                      New Round
                    </Button>
                  </Stack>

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
                                <Badge
                                  colorScheme={
                                    participant.vote ? "green" : "yellow"
                                  }
                                >
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
                </VStack>
              </Box>
            )}
          </VStack>
        )}

        {/* Conditionally render ChangeNameModal (ensure room exists and user is not authenticated) */}
        {roomExists === true && !isAuthenticated && (
          <ChangeNameModal
            isOpen={isChangeNameOpen}
            newUserName={newUserName}
            onClose={onChangeNameClose}
            onNameChange={setNewUserName}
            onSave={handleChangeName}
          />
        )}

        {/* Render Settings Modal (ensure room exists and settings are loaded) */}
        {roomExists === true && settings && (
          <RoomSettingsModal
            isOpen={isSettingsOpen}
            onClose={onSettingsClose}
            currentSequence={settings.sequence}
            newSettings={newSettings}
            showPassword={showPassword}
            onTogglePassword={() => setShowPassword(!showPassword)}
            onSettingsChange={setNewSettings}
            onSave={handleUpdateSettings}
          />
        )}
      </Box>
    </PageContainer>
  );
};

export default PlanningPokerRoom;
