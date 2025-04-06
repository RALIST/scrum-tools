import { FC, useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
// Removed useQuery import
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
import { ParticipantsTable } from "../../components/poker/ParticipantsTable";
import {
  JoinRoomModal,
  ChangeNameModal,
  RoomSettingsModal,
} from "../../components/modals";
import {
  usePokerSocket,
  Participant, // Import Participant type from hook
  RoomSettings, // Import RoomSettings type from hook
} from "../../hooks/usePokerSocket";
import { useAuth } from "../../contexts/AuthContext";
import { apiRequest } from "../../utils/apiUtils"; // Keep apiRequest for original /info call
import { SequenceType } from "../../constants/poker"; // Re-added SequenceType

const LOCAL_STORAGE_USERNAME_KEY = "planningPokerUsername";

// Removed PokerRoomDetailsFrontend interface

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
  const {
    isOpen: isJoinModalOpen,
    onOpen: onJoinModalOpen,
    onClose: onJoinModalClose,
  } = useDisclosure();
  // Re-added states for original /info fetch logic
  const [isPasswordProtected, setIsPasswordProtected] = useState(false);
  const [isLoadingRoomInfo, setIsLoadingRoomInfo] = useState(true);
  const [roomExists, setRoomExists] = useState<boolean | null>(null);

  // --- Callbacks for the socket hook ---
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

  // Determine initial username for auto-join attempt using original states
  const initialJoinName = useMemo(() => {
    if (
      isAuthenticated &&
      user?.name &&
      roomExists === true && // Use state variable
      !isPasswordProtected // Use state variable
    ) {
      return user.name;
    }
    return null;
  }, [isAuthenticated, user?.name, roomExists, isPasswordProtected]); // Depend on state variables

  // --- Socket Hook ---
  const {
    socket,
    participants,
    settings, // Hook now manages settings state based on key
    isRevealed,
    isJoined,
    joinRoom,
    changeName,
    vote,
    revealVotes,
    resetVotes,
    updateSettings: updateRoomSettings,
    isConnectingOrJoining,
  } = usePokerSocket({
    roomId: roomExists === true ? roomId || "" : "", // Only connect if room exists
    initialUserName: initialJoinName,
    onRoomJoined,
    onJoinError: handleJoinError,
  });

  // --- Effects ---

  // Effect 1: Set initial user name state
  useEffect(() => {
    if (isAuthenticated && user?.name) {
      setUserName(user.name);
    } else {
      const savedName = localStorage.getItem(LOCAL_STORAGE_USERNAME_KEY);
      setUserName(savedName || "");
    }
  }, [isAuthenticated, user?.name]);

  // Effect 2: Check room existence and password status (Reverted to original /info call)
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

    apiRequest<{ id: string; hasPassword: boolean }>( // Expecting minimal info again
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

  // Effect 3: Decide whether to show the join modal (Reverted logic)
  useEffect(() => {
    if (
      isLoadingRoomInfo ||
      isConnectingOrJoining ||
      isJoined ||
      roomExists !== true
    ) {
      if (isJoinModalOpen) onJoinModalClose();
      return;
    }

    if (!isConnectingOrJoining && (!isAuthenticated || isPasswordProtected)) {
      console.log("[PlanningPokerRoom] Conditions met for showing join modal.");
      if (!isJoinModalOpen) onJoinModalOpen();
    } else {
      if (isJoinModalOpen) onJoinModalClose();
    }
  }, [
    roomExists,
    isJoined,
    isConnectingOrJoining,
    isAuthenticated,
    isPasswordProtected, // Use state variable
    onJoinModalOpen,
    onJoinModalClose,
    isLoadingRoomInfo,
    isJoinModalOpen,
  ]);

  // --- Callbacks ---

  // Called when user clicks "Join" in the modal
  const handleManualJoin = useCallback(
    (name: string, password?: string) => {
      if (!name) {
        toast({
          title: "Error",
          description: "Please enter your name",
          status: "error",
        });
        return;
      }
      if (isPasswordProtected && !password) {
        // Use state variable
        toast({
          title: "Error",
          description: "Please enter the room password",
          status: "error",
        });
        return;
      }
      if (!isAuthenticated) {
        setUserName(name);
        localStorage.setItem(LOCAL_STORAGE_USERNAME_KEY, name);
      }
      joinRoom(name, password);
    },
    [isPasswordProtected, joinRoom, toast, isAuthenticated] // Use state variable
  );

  // Handle name change
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
      setUserName(newName);
      changeName(newName);
      onChangeNameClose();
      toast({ title: "Name Updated", status: "success", duration: 2000 });
    },
    [changeName, onChangeNameClose, toast, isAuthenticated]
  );

  // Handle settings update (Reverted to expect SequenceType key)
  const handleUpdateSettings = useCallback(
    (settingsToSave: { sequence?: SequenceType; password?: string }) => {
      updateRoomSettings(settingsToSave);
      onSettingsClose();
    },
    [updateRoomSettings, onSettingsClose]
  );

  // Handle card selection
  const handleCardSelect = useCallback(
    (value: string) => {
      setSelectedCard(value);
      vote(value);
    },
    [vote]
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

  // Handle other query errors (Removed as useQuery is removed)

  // If query succeeded but data is somehow null/undefined (Removed)

  // At this point, roomExists === true
  // Show connection/joining spinner overlay if applicable
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
          initialUserName={userName}
          isPasswordProtected={isPasswordProtected} // Use state variable
          onClose={onJoinModalClose}
          onJoin={handleManualJoin}
          isNameDisabled={isAuthenticated}
        />

        {/* Main Room Content */}
        <VStack spacing={{ base: 4, md: 8 }}>
          {/* Use RoomHeader Component - Reverted roomName prop */}
          <RoomHeader
            roomId={roomId}
            // roomName={roomData.name} // Removed, RoomHeader doesn't need it now
            isJoined={isJoined}
            userName={userName}
            isAuthenticated={isAuthenticated}
            onSettingsOpen={onSettingsOpen}
            onChangeNameOpen={() => {
              onChangeNameOpen();
            }}
            participants={participants}
            socketId={socket?.id}
          />

          {/* Show spinner overlay if connecting/joining */}
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
                {/* Use VotingArea Component - Pass sequence key */}
                <VotingArea
                  sequence={settings.sequence} // Pass key from hook state
                  selectedCard={selectedCard}
                  isRevealed={isRevealed}
                  onCardSelect={handleCardSelect}
                  onRevealVotes={revealVotes}
                  onResetVotes={resetVotes}
                />

                {/* Use ParticipantsTable Component - Pass sequence key */}
                <ParticipantsTable
                  participants={participants}
                  isRevealed={isRevealed}
                  settings={settings} // Pass settings object (contains key)
                />
              </VStack>
            </Box>
          )}
        </VStack>

        {/* Change Name Modal */}
        {!isAuthenticated && (
          <ChangeNameModal
            isOpen={isChangeNameOpen}
            initialUserName={userName}
            onClose={onChangeNameClose}
            onSave={handleChangeName}
          />
        )}

        {/* Settings Modal - Pass sequence key */}
        {settings && (
          <RoomSettingsModal
            isOpen={isSettingsOpen}
            onClose={onSettingsClose}
            currentSequence={settings.sequence} // Pass key from hook state
            onSave={handleUpdateSettings} // Callback expects key
          />
        )}
      </Box>
    </PageContainer>
  );
};

export default PlanningPokerRoom;
