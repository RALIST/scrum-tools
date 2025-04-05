import { FC, useCallback, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  VStack,
  useToast,
  Spinner,
  Center,
  Text,
  useDisclosure,
} from "@chakra-ui/react";
import { JoinRetroBoardModal } from "../../components/modals";
import {
  useRetroSocket,
  RetroBoard as RetroBoardType, // Import type from hook
} from "../../hooks/useRetroSocket";
import { useRetroUser } from "../../hooks/useRetroUser";
import { useAuth } from "../../contexts/AuthContext";
import RetroBoardView from "../../components/retro/RetroBoardView";
import { apiRequest, AuthError } from "../../utils/apiUtils"; // Import apiRequest

const componentDebugLog = (message: string, data?: any) => {
  console.log(`[RetroBoard Component] ${message}`, data || "");
};

const RetroBoard: FC = () => {
  const { boardId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { userName, setUserNameAndStorage, isNameFixed } = useRetroUser();
  const { user, isAuthenticated } = useAuth();
  const {
    isOpen: isJoinModalOpen,
    onOpen: onJoinModalOpen,
    onClose: onJoinModalClose,
  } = useDisclosure();

  // State for initial board data loading (now done in component)
  const [initialBoardData, setInitialBoardData] =
    useState<RetroBoardType | null>(null);
  const [isLoadingInitialData, setIsLoadingInitialData] = useState(true);
  const [initialLoadError, setInitialLoadError] = useState<string | null>(null);

  // Callback for when board is successfully joined via socket
  const onBoardJoined = useCallback(() => {
    componentDebugLog("onBoardJoined triggered");
    toast({
      title: "Joined Board",
      status: "success",
      duration: 2000,
    });
    onJoinModalClose(); // Close modal on successful join
  }, [toast, onJoinModalClose]);

  // Callback for join errors from socket hook
  const onJoinError = useCallback(
    (message: string) => {
      toast({
        title: "Join Error",
        description: message,
        status: "error",
        duration: 3000,
        isClosable: true,
      });
      // Show modal again if join failed (e.g., wrong password)
      onJoinModalOpen();
    },
    [toast, onJoinModalOpen]
  );

  // Use the socket hook - it now primarily manages socket state and events
  const {
    board: socketBoard, // Board state updated by socket events
    isTimerRunning,
    timeLeft,
    hideCards,
    setHideCards,
    hasJoined,
    joinBoard, // Function to initiate joining via socket
    changeName,
    addCard,
    editCard,
    deleteCard,
    toggleVote,
    toggleTimer,
    updateSettings,
    isConnectingOrJoining, // Combined socket connecting/joining state
  } = useRetroSocket({
    boardId: boardId || null,
    onBoardJoined,
    onJoinError,
  });

  // Effect 1: Fetch initial board data when boardId changes
  useEffect(() => {
    if (!boardId) {
      setInitialBoardData(null);
      setIsLoadingInitialData(false);
      setInitialLoadError(null);
      return;
    }

    let isActive = true;
    setIsLoadingInitialData(true);
    setInitialLoadError(null);
    setInitialBoardData(null); // Clear previous data

    const fetchInitialData = async () => {
      componentDebugLog("Fetching initial board data", { boardId });
      try {
        const data = await apiRequest<RetroBoardType>(`/retro/${boardId}`, {
          includeAuth: false, // Fetch public info first
        });
        if (!isActive) return;
        componentDebugLog("Initial board data loaded", data);
        setInitialBoardData(data);
      } catch (error) {
        if (!isActive) return;
        console.error(
          "[RetroBoard Component] Error fetching initial board data",
          error
        );
        const description =
          error instanceof AuthError
            ? "Authentication error loading board."
            : error instanceof Error
            ? error.message
            : "Failed to load board";
        setInitialLoadError(description);
        toast({
          title: "Initialization Error",
          description,
          status: "error",
          duration: 3000,
          isClosable: true,
        });
      } finally {
        if (isActive) setIsLoadingInitialData(false);
      }
    };

    fetchInitialData();

    return () => {
      isActive = false;
    };
  }, [boardId, toast]);

  // Effect 2: Handle auto-join or modal display *after* initial data is loaded
  useEffect(() => {
    componentDebugLog("Running Auto-Join/Modal Effect", {
      isLoadingInitialData,
      initialBoardDataExists: !!initialBoardData,
      boardId,
      hasJoined,
      isConnectingOrJoining,
      isAuthenticated,
    });
    // Wait for initial data load and ensure boardId is valid
    if (isLoadingInitialData || !initialBoardData || !boardId) {
      return;
    }

    // If already joined (e.g., via socket reconnect), ensure modal is closed
    if (hasJoined) {
      if (isJoinModalOpen) {
        componentDebugLog(
          "Auto-Join/Modal Effect: Already joined, closing modal."
        );
        onJoinModalClose();
      }
      return;
    }

    // Determine if auto-join should happen
    const shouldAutoJoin =
      isAuthenticated && user?.name && !initialBoardData.hasPassword;

    if (shouldAutoJoin) {
      // Attempt auto-join only if not already connecting/joining via socket
      if (!isConnectingOrJoining) {
        componentDebugLog("Auto-Join/Modal Effect: Attempting auto-join", {
          userName: user.name,
        });
        joinBoard(user.name); // Call the hook's join function
      } else {
        componentDebugLog(
          "Auto-Join/Modal Effect: Skipping auto-join, already connecting/joining."
        );
      }
      // Ensure modal is closed during auto-join attempt
      if (isJoinModalOpen) {
        componentDebugLog(
          "Auto-Join/Modal Effect: Closing modal during auto-join attempt."
        );
        onJoinModalClose();
      }
    } else {
      // If auto-join conditions not met, show modal (if not already joined/connecting)
      if (!isConnectingOrJoining && !hasJoined) {
        if (!isJoinModalOpen) {
          componentDebugLog(
            "Auto-Join/Modal Effect: Conditions met for showing join modal (manual/password)"
          );
          onJoinModalOpen();
        }
      } else {
        // If connecting/joining or already joined, ensure modal is closed
        if (isJoinModalOpen) {
          componentDebugLog(
            "Auto-Join/Modal Effect: Closing modal because connecting/joining or already joined."
          );
          onJoinModalClose();
        }
      }
    }
  }, [
    initialBoardData,
    isLoadingInitialData,
    hasJoined,
    isConnectingOrJoining,
    isAuthenticated,
    user?.name,
    boardId,
    joinBoard, // Include joinBoard as it's called
    onJoinModalOpen,
    onJoinModalClose,
    isJoinModalOpen,
  ]);

  // Handler for joining the board (passed to JoinRetroBoardModal)
  const handleJoinBoard = useCallback(
    (name: string, password?: string) => {
      if (!boardId) return;
      // Set user name locally *before* calling joinBoard
      setUserNameAndStorage(name);
      joinBoard(name, password); // Call the hook's function
    },
    [boardId, joinBoard, setUserNameAndStorage]
  );

  // Handler for submitting name change (passed to RetroBoardView -> ChangeRetroBoardNameModal)
  const handleChangeNameSubmit = useCallback(
    (newName: string) => {
      if (!boardId) return;
      // Update local name first for immediate UI feedback if needed
      setUserNameAndStorage(newName);
      changeName(newName); // Call the hook's function
    },
    [boardId, changeName, setUserNameAndStorage]
  );

  // Handler for adding a card (passed to RetroBoardView -> RetroColumn)
  const handleAddCard = useCallback(
    (columnId: string, text: string) => {
      // Use the board state from the hook for checks
      if (!text.trim() || !isTimerRunning || !userName) return;
      const cardId = Math.random().toString(36).substring(7);
      addCard(cardId, columnId, text, userName);
    },
    [isTimerRunning, userName, addCard] // Depend on hook state/functions
  );

  // Memoized handler for toggling card visibility
  const handleToggleCards = useCallback(() => {
    setHideCards(!hideCards); // Call the hook's function
  }, [hideCards, setHideCards]);

  // --- Render Logic ---

  componentDebugLog("Rendering Check", {
    socketBoardExists: !!socketBoard, // Check socketBoard for rendering board view
    initialDataExists: !!initialBoardData, // Check initial data for modal password check
    hasJoined,
    isConnectingOrJoining,
    isJoinModalOpen,
    isLoadingInitialData,
  });

  // Loading State Check: Show spinner if initial data is loading OR if connecting/joining before being joined.
  if (isLoadingInitialData || (!hasJoined && isConnectingOrJoining)) {
    componentDebugLog("Render Decision: Loading Spinner");
    return (
      <Center minH="calc(100vh - 120px)">
        <VStack spacing={4}>
          <Spinner size="xl" />
          <Text>Loading board...</Text>
        </VStack>
      </Center>
    );
  }

  // Handle initial load error
  if (!initialBoardData && !isLoadingInitialData) {
    componentDebugLog("Render Decision: Initial Load Error");
    return (
      <Center minH="calc(100vh - 120px)">
        <Text color="red.500">
          Error loading board data: {initialLoadError || "Unknown error"}
        </Text>
      </Center>
    );
  }

  // Join Modal Check (using state managed by the effect)
  if (isJoinModalOpen && initialBoardData) {
    // Ensure initialBoardData exists before rendering modal
    componentDebugLog("Render Decision: Join Modal");
    return (
      <JoinRetroBoardModal
        isOpen={true}
        onClose={() => navigate("/retro")}
        onJoin={handleJoinBoard}
        hasPassword={initialBoardData.hasPassword} // Use initial data here
        initialName={isAuthenticated ? user?.name : userName}
        isNameDisabled={isAuthenticated}
      />
    );
  }

  // Board View Check: Show only if joined and socketBoard data exists
  if (hasJoined && socketBoard) {
    componentDebugLog("Render Decision: RetroBoardView");
    return (
      <RetroBoardView
        board={socketBoard} // Use data from socket hook
        userName={userName}
        isTimerRunning={isTimerRunning}
        timeLeft={timeLeft}
        hideCards={hideCards}
        onToggleCards={handleToggleCards}
        onToggleTimer={toggleTimer}
        onChangeNameSubmit={handleChangeNameSubmit}
        onAddCard={handleAddCard}
        onEditCard={editCard}
        onDeleteCard={deleteCard}
        onVoteCard={toggleVote}
        onUpdateSettings={updateSettings}
        isNameFixed={isNameFixed}
      />
    );
  }

  // Fallback Error State: If none of the above conditions are met
  componentDebugLog("Render Decision: Fallback Error Message");
  return (
    <Center minH="calc(100vh - 120px)">
      <Text>Error loading board or joining session.</Text>
    </Center>
  );
};

export default RetroBoard;
