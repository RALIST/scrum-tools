import { FC, useCallback, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query"; // Import useQuery
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

  // Remove old state for initial data loading
  // const [initialBoardData, setInitialBoardData] = useState<RetroBoardType | null>(null);
  // const [isLoadingInitialData, setIsLoadingInitialData] = useState(true);
  // const [initialLoadError, setInitialLoadError] = useState<string | null>(null);

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

  // --- React Query for initial board data ---
  const initialBoardQueryKey = ["retroBoard", boardId];

  const fetchInitialBoardData = async (): Promise<RetroBoardType> => {
    if (!boardId) {
      throw new Error("Board ID is required");
    }
    componentDebugLog("Fetching initial board data via React Query", {
      boardId,
    });
    // Fetch public info first, auth handled by apiRequest if needed later
    return await apiRequest<RetroBoardType>(`/retro/${boardId}`, {
      includeAuth: false,
    });
  };

  const {
    data: initialBoardData, // Data from the query
    isLoading: isLoadingInitialData, // Loading state from the query
    isError: isInitialError, // Error state from the query
    error: initialLoadError, // Error object from the query
  } = useQuery<RetroBoardType, Error>({
    // Specify types
    queryKey: initialBoardQueryKey,
    queryFn: fetchInitialBoardData,
    enabled: !!boardId, // Only run query if boardId exists
    retry: 1, // Retry once on error
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
  });

  // Effect to show toast on initial load error
  useEffect(() => {
    if (isInitialError && initialLoadError) {
      const description =
        initialLoadError instanceof AuthError
          ? "Authentication error loading board."
          : initialLoadError instanceof Error
          ? initialLoadError.message
          : "Failed to load board";
      toast({
        title: "Initialization Error",
        description,
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    }
  }, [isInitialError, initialLoadError, toast]);
  // --- End React Query ---

  // Remove old useEffect for fetching initial data

  // Effect 2: Handle auto-join or modal display *after* initial data is loaded (or query finishes)
  useEffect(() => {
    componentDebugLog("Running Auto-Join/Modal Effect", {
      isLoadingInitialData, // Use loading state from useQuery
      initialBoardDataExists: !!initialBoardData, // Use data from useQuery
      boardId,
      hasJoined,
      isConnectingOrJoining,
      isAuthenticated,
    });
    // Wait for query to finish and ensure boardId is valid
    // Also check for error state from the query
    if (
      isLoadingInitialData ||
      isInitialError ||
      !initialBoardData ||
      !boardId
    ) {
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
    initialBoardData, // Use data from useQuery
    isLoadingInitialData, // Use loading state from useQuery
    isInitialError, // Add error state dependency
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
      // Determine the author name to use, falling back to localStorage if state is null/empty
      let authorNameToUse = userName;
      if (!authorNameToUse) {
        try {
          authorNameToUse = localStorage.getItem("retroUserName");
        } catch (e) {
          console.error(
            "[RetroBoard Component] Error reading username from localStorage in handleAddCard",
            e
          );
        }
      }

      // Check conditions with the potentially updated authorNameToUse
      if (!text.trim() || !isTimerRunning || !authorNameToUse) {
        console.warn("[RetroBoard Component] handleAddCard blocked:", {
          text: text.trim(),
          isTimerRunning,
          authorNameToUse,
        });
        return;
      }

      const cardId = Math.random().toString(36).substring(7);
      // Pass the determined name (client-side check passed). Server uses its own name mapping anyway.
      addCard(cardId, columnId, text, authorNameToUse);
    },
    [isTimerRunning, userName, addCard] // Keep userName dependency so callback updates if state changes
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
    isLoadingInitialData, // Use loading state from useQuery
  });

  // Loading State Check: Show spinner if initial data query is loading OR if connecting/joining before being joined.
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

  // Handle initial load error (using state from useQuery)
  if (isInitialError && !isLoadingInitialData) {
    componentDebugLog("Render Decision: Initial Load Error");
    const errorMessage =
      initialLoadError instanceof Error
        ? initialLoadError.message
        : "Unknown error";
    return (
      <Center minH="calc(100vh - 120px)">
        <Text color="red.500">Error loading board data: {errorMessage}</Text>
      </Center>
    );
  }

  // Join Modal Check (using state managed by the effect and data from useQuery)
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

    // Determine the name to display, falling back to localStorage if state is null/empty
    // This ensures the header shows the name immediately after joining.
    let nameToDisplay = userName;
    if (!nameToDisplay) {
      try {
        nameToDisplay = localStorage.getItem("retroUserName");
      } catch (e) {
        console.error(
          "[RetroBoard Component] Error reading username from localStorage for display",
          e
        );
      }
    }
    // Default to empty string if still null after checking localStorage
    nameToDisplay = nameToDisplay || "";

    return (
      <RetroBoardView
        board={socketBoard} // Use data from socket hook
        userName={nameToDisplay} // Pass the potentially corrected name
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
