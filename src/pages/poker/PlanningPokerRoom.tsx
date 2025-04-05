import { FC, useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Box,
  Heading,
  Button,
  Text,
  VStack,
  useColorMode,
  useToast,
  useDisclosure,
  Spinner,
  Center,
} from "@chakra-ui/react";
import PageContainer from "../../components/PageContainer";
import { Helmet } from "react-helmet-async";
import { RoomHeader } from "../../components/poker/RoomHeader";
import { VotingArea } from "../../components/poker/VotingArea";
import { ParticipantsTable } from "../../components/poker/ParticipantsTable"; // Import the new table component
import {
  JoinRoomModal,
  ChangeNameModal,
  RoomSettingsModal,
} from "../../components/modals";
import { usePokerSocket } from "../../hooks/usePokerSocket";
import { useAuth } from "../../contexts/AuthContext"; // Import useAuth
import { apiRequest } from "../../utils/apiUtils"; // Import apiRequest
import { SequenceType } from "../../constants/poker";

const LOCAL_STORAGE_USERNAME_KEY = "planningPokerUsername";

const PlanningPokerRoom: FC = () => {
  const { colorMode } = useColorMode();
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const { user, isAuthenticated } = useAuth();
  const [userName, setUserName] = useState("");
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
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
  // Removed newUserName state
  // Removed roomPassword and showPassword states
  // Removed newSettings state
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

    // Conditions to show modal: Room exists, not joined, not currently connecting/joining, AND (unauthenticated OR password needed)
    if (!isConnectingOrJoining && (!isAuthenticated || isPasswordProtected)) {
      console.log("[PlanningPokerRoom] Conditions met for showing join modal.");
      onJoinModalOpen();
    } else {
      // Should have auto-joined via initialUserName in the hook, close modal if it was somehow open
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

  // Called when user clicks "Join" in the modal - updated signature
  const handleManualJoin = useCallback(
    (name: string, password?: string) => {
      // Name validation (already trimmed in modal)
      if (!name) {
        toast({
          title: "Error",
          description: "Please enter your name",
          status: "error",
        });
        return;
      }
      // Password validation (only if needed)
      if (isPasswordProtected && !password) {
        toast({
          title: "Error",
          description: "Please enter the room password",
          status: "error",
        });
        return;
      }
      // Save name only if not authenticated
      if (!isAuthenticated) {
        // Update local state userName as well, since it's used for display
        setUserName(name);
        localStorage.setItem(LOCAL_STORAGE_USERNAME_KEY, name);
      }
      // Call the hook's joinRoom function with data from modal
      joinRoom(name, password);
      // Don't close modal here, let onRoomJoined handle it on success
    },
    [isPasswordProtected, joinRoom, toast, isAuthenticated] // Removed userName, roomPassword dependencies
  );

  // Updated handleChangeName to accept newName argument
  const handleChangeName = useCallback(
    (newName: string) => {
      if (isAuthenticated) return;
      if (!newName.trim()) {
        toast({
          title: "Error",
          description: "Please enter a valid name",
          status: "error",
        });
        return;
      }
      localStorage.setItem(LOCAL_STORAGE_USERNAME_KEY, newName);
      setUserName(newName); // Update local state as well
      changeName(newName); // Call hook function
      onChangeNameClose();
      toast({ title: "Name Updated", status: "success", duration: 2000 });
    },
    [changeName, onChangeNameClose, toast, isAuthenticated] // Removed newUserName dependency
  );

  // Updated handleUpdateSettings to accept settings argument
  const handleUpdateSettings = useCallback(
    (settingsToSave: { sequence?: SequenceType; password?: string }) => {
      updateRoomSettings(settingsToSave);
      onSettingsClose();
      // No need to reset newSettings state as it's removed
    },
    [updateRoomSettings, onSettingsClose] // Removed newSettings dependency
  );

  const handleCardSelect = useCallback(
    (value: string) => {
      setSelectedCard(value);
      vote(value);
      // Toast is now handled inside VotingArea component
    },
    [vote] // Removed toast dependency
  );

  // Removed calculateAverage and getVoteColor functions, they are now in ParticipantsTable

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
          initialUserName={userName} // Pass current userName as initial value
          isPasswordProtected={isPasswordProtected}
          onClose={onJoinModalClose} // Pass the close handler
          onJoin={handleManualJoin} // Pass the updated handler
          isNameDisabled={isAuthenticated} // Disable name input if authenticated
        />

        {/* Main Room Content - Render structure always if room exists */}
        <VStack spacing={{ base: 4, md: 8 }}>
          {/* Use RoomHeader Component */}
          <RoomHeader
            roomId={roomId}
            isJoined={isJoined}
            userName={userName} // Pass the state userName as fallback
            isAuthenticated={isAuthenticated}
            onSettingsOpen={onSettingsOpen}
            onChangeNameOpen={() => {
              // setNewUserName(userName); // No longer needed, modal handles its state
              onChangeNameOpen();
            }}
            participants={participants}
            socketId={socket?.id} // Pass socket id from the hook
          />

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
                {/* Use VotingArea Component */}
                <VotingArea
                  sequence={settings.sequence}
                  selectedCard={selectedCard}
                  isRevealed={isRevealed}
                  onCardSelect={handleCardSelect} // Pass the updated handler (without toast)
                  onRevealVotes={revealVotes}
                  onResetVotes={resetVotes}
                />

                {/* Use ParticipantsTable Component */}
                <ParticipantsTable
                  participants={participants}
                  isRevealed={isRevealed}
                  settings={settings}
                />
              </VStack>
            </Box>
          )}
        </VStack>

        {/* Change Name Modal */}
        {!isAuthenticated && (
          <ChangeNameModal
            isOpen={isChangeNameOpen}
            initialUserName={userName} // Pass current userName as initial value
            onClose={onChangeNameClose}
            // Removed onNameChange prop
            onSave={handleChangeName} // Pass the updated handler
          />
        )}

        {/* Settings Modal */}
        {settings && ( // Ensure settings exist before rendering
          <RoomSettingsModal
            isOpen={isSettingsOpen}
            onClose={onSettingsClose}
            currentSequence={settings.sequence}
            // Removed newSettings, showPassword, onTogglePassword, onSettingsChange props
            onSave={handleUpdateSettings} // Pass the updated handler
          />
        )}
      </Box>
    </PageContainer>
  );
};

export default PlanningPokerRoom;
