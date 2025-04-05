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
  const { user, isAuthenticated } = useAuth();
  const [userName, setUserName] = useState(""); // For modal input prefill/display
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
  const [roomPassword, setRoomPassword] = useState<string>(""); // For modal input
  const [showPassword, setShowPassword] = useState(false);
  const [newSettings, setNewSettings] = useState<{
    sequence?: SequenceType;
    password?: string;
  }>({});
  const [isPasswordProtected, setIsPasswordProtected] = useState(false);
  const [isLoadingRoomInfo, setIsLoadingRoomInfo] = useState(true);
  const [roomExists, setRoomExists] = useState<boolean | null>(null);
  // State to control modal visibility explicitly
  const {
    isOpen: isJoinModalOpen,
    onOpen: onJoinModalOpen,
    onClose: onJoinModalClose,
  } = useDisclosure();

  // --- Callbacks for the hook ---
  const onRoomJoined = useCallback(() => {
    console.log("[PlanningPokerRoom] onRoomJoined callback triggered.");
    toast({ title: "Joined Room", status: "success", duration: 2000 });
    onJoinModalClose(); // Close modal on successful join
  }, [toast, onJoinModalClose]);

  const handleJoinError = useCallback(
    (message: string) => {
      console.log(
        "[PlanningPokerRoom] handleJoinError callback triggered:",
        message
      );
      toast({
        title: "Join Error",
        description: message || "Failed to join the room.",
        status: "error",
        duration: 4000,
        isClosable: true,
      });
      // Re-open modal if the error requires user input (e.g., wrong password or missing name)
      if (message.toLowerCase().includes("password") || !isAuthenticated) {
        onJoinModalOpen();
      }
    },
    [toast, onJoinModalOpen, isAuthenticated]
  );

  // Determine initial username for auto-join attempt (only if applicable)
  const initialJoinName = useMemo(() => {
    // Auto-join only if authenticated, room exists, and is NOT password protected
    if (
      isAuthenticated &&
      user?.name &&
      roomExists === true &&
      !isPasswordProtected
    ) {
      return user.name;
    }
    return null;
  }, [isAuthenticated, user?.name, roomExists, isPasswordProtected]);

  // --- Socket Hook ---
  const {
    socket, // Destructure socket here
    participants,
    settings,
    isRevealed,
    isJoined,
    joinRoom, // Function provided by the hook to initiate join
    changeName,
    vote,
    revealVotes,
    resetVotes,
    updateSettings: updateRoomSettings,
    isConnectingOrJoining, // Tracks connection OR join attempt
  } = usePokerSocket({
    roomId: roomExists === true ? roomId || "" : "", // Only connect if room exists
    initialUserName: initialJoinName, // Pass name for potential auto-join
    onRoomJoined,
    onJoinError: handleJoinError,
  });

  // --- Effects ---

  // Effect 1: Set initial user name state (for display or modal prefill)
  useEffect(() => {
    if (isAuthenticated && user?.name) {
      setUserName(user.name);
    } else {
      const savedName = localStorage.getItem(LOCAL_STORAGE_USERNAME_KEY);
      setUserName(savedName || "");
    }
  }, [isAuthenticated, user?.name]);

  // Effect 2: Check room existence and password status
  useEffect(() => {
    if (!roomId) {
      navigate("/planning-poker");
      return;
    }
    console.log(
      `[PlanningPokerRoom] Checking room existence for roomId: ${roomId}`
    );
    let isActive = true;
    setRoomExists(null);
    setIsLoadingRoomInfo(true);

    apiRequest<{ id: string; hasPassword: boolean }>(
      `/poker/rooms/${roomId}/info`
    )
      .then((roomInfo) => {
        if (!isActive) return;
        console.log(`[PlanningPokerRoom] API /info returned:`, roomInfo);
        setIsPasswordProtected(roomInfo.hasPassword);
        setRoomExists(true);
      })
      .catch((err: any) => {
        if (!isActive) return;
        console.error(`[PlanningPokerRoom] Error fetching room info:`, err);
        setRoomExists(false);
        if (err.message?.includes("404")) {
          toast({ title: "Room not found", status: "error", duration: 3000 });
        } else {
          toast({
            title: "Error checking room",
            status: "error",
            duration: 3000,
          });
        }
      })
      .finally(() => {
        if (isActive) setIsLoadingRoomInfo(false);
      });

    return () => {
      isActive = false;
    };
  }, [roomId, navigate, toast]);

  // Effect 3: Decide whether to show the join modal AFTER room check is done
  // AND after initial connection attempt (isConnectingOrJoining becomes false)
  useEffect(() => {
    // Don't show modal while initial room info is loading, or connecting/joining, or already joined
    if (
      isLoadingRoomInfo ||
      isConnectingOrJoining ||
      isJoined ||
      roomExists !== true
    ) {
      if (isJoinModalOpen) onJoinModalClose(); // Ensure closed if conditions not met
      return;
    }

    // Conditions to show modal: Room exists, not joined, not connecting, AND (unauthenticated OR password needed)
    if (!isAuthenticated || isPasswordProtected) {
      console.log("[PlanningPokerRoom] Conditions met for showing join modal.");
      onJoinModalOpen();
    } else {
      // Should have auto-joined, close modal if it was somehow open
      if (isJoinModalOpen) onJoinModalClose();
    }
  }, [
    roomExists,
    isJoined,
    isConnectingOrJoining,
    isAuthenticated,
    isPasswordProtected,
    onJoinModalOpen,
    onJoinModalClose,
    isLoadingRoomInfo,
  ]);

  // --- Callbacks ---

  // Called when user clicks "Join" in the modal
  const handleManualJoin = useCallback(() => {
    // Use state `userName` if unauthenticated, otherwise use context `user.name`
    const nameToJoin =
      isAuthenticated && user?.name ? user.name : userName.trim();
    if (!nameToJoin) {
      toast({
        title: "Error",
        description: "Please enter your name",
        status: "error",
      });
      return;
    }
    // Password required only if the room is protected
    if (isPasswordProtected && !roomPassword.trim()) {
      toast({
        title: "Error",
        description: "Please enter the room password",
        status: "error",
      });
      return;
    }
    // Save name only if not authenticated
    if (!isAuthenticated) {
      localStorage.setItem(LOCAL_STORAGE_USERNAME_KEY, nameToJoin);
    }
    // Call the hook's joinRoom function
    joinRoom(nameToJoin, isPasswordProtected ? roomPassword : undefined);
    // Don't close modal here, let onRoomJoined handle it on success
  }, [
    userName,
    roomPassword,
    isPasswordProtected,
    joinRoom,
    toast,
    isAuthenticated,
    user?.name,
  ]);

  const handleChangeName = useCallback(() => {
    if (isAuthenticated) return;
    if (!newUserName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a valid name",
        status: "error",
      });
      return;
    }
    localStorage.setItem(LOCAL_STORAGE_USERNAME_KEY, newUserName);
    setUserName(newUserName); // Update local state as well
    changeName(newUserName); // Call hook function
    onChangeNameClose();
    toast({ title: "Name Updated", status: "success", duration: 2000 });
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
      if (maxDiff === 0) return "green.500";
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

  // --- Render Logic ---

  // Show main loading spinner only during initial room info check
  if (isLoadingRoomInfo || roomExists === null) {
    return (
      <Center minH="calc(100vh - 60px)">
        <Spinner size="xl" />
      </Center>
    );
  }

  // Handle room not found
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

  // At this point, roomExists === true
  // Show connection/joining spinner overlay if applicable (but not initial room check)
  const showConnectingSpinner = !isJoined && isConnectingOrJoining;

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
        {/* Join Modal - controlled by isJoinModalOpen state */}
        <JoinRoomModal
          isOpen={isJoinModalOpen}
          userName={userName} // Use state for prefill/input
          roomPassword={roomPassword}
          showPassword={showPassword}
          isPasswordProtected={isPasswordProtected}
          onUserNameChange={setUserName} // Update state on input change
          onPasswordChange={setRoomPassword}
          onTogglePassword={() => setShowPassword(!showPassword)}
          onJoin={handleManualJoin} // Use the manual join handler
          // Removed isLoading prop as it's not expected by JoinRoomModalProps
        />

        {/* Main Room Content - Render structure always if room exists */}
        <VStack spacing={{ base: 4, md: 8 }}>
          {/* Header */}
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
                        onCopy();
                        toast({
                          title: "Link copied",
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
                    {/* Display name from participants list if possible, fallback to state */}
                    Playing as: {/* Use the destructured 'socket' variable */}
                    {participants?.find((p) => p.id === socket?.id)?.name ||
                      userName}
                  </Text>
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

          {/* Show spinner overlay if connecting/joining AFTER initial room check */}
          {showConnectingSpinner && (
            <Center
              position="absolute"
              top="50%"
              left="50%"
              transform="translate(-50%, -50%)"
              zIndex="overlay"
            >
              <Spinner size="xl" />
            </Center>
          )}

          {/* Main Content Area - Render only if joined */}
          {isJoined && participants && settings && (
            <Box
              w="full"
              p={{ base: 4, md: 8 }}
              borderRadius="lg"
              bg={colorMode === "light" ? "white" : "gray.700"}
              shadow="md"
            >
              <VStack spacing={{ base: 4, md: 8 }}>
                {/* Cards */}
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
                {/* Buttons */}
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
                {/* Table */}
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

        {/* Change Name Modal */}
        {!isAuthenticated && (
          <ChangeNameModal
            isOpen={isChangeNameOpen}
            newUserName={newUserName}
            onClose={onChangeNameClose}
            onNameChange={setNewUserName}
            onSave={handleChangeName}
          />
        )}

        {/* Settings Modal */}
        {settings && ( // Ensure settings exist before rendering
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
