import { FC, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { VStack, useToast, Spinner, Center, Text } from "@chakra-ui/react";
import { JoinRetroBoardModal } from "../../components/modals"; // Only need Join modal here
import { useRetroSocket } from "../../hooks/useRetroSocket";
import { useRetroUser } from "../../hooks/useRetroUser";
import RetroBoardView from "../../components/retro/RetroBoardView"; // Import the new view component

const RetroBoard: FC = () => {
  const { boardId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { userName, setUserNameAndStorage } = useRetroUser();

  // Callback for when board is successfully joined
  const onBoardJoined = useCallback(() => {
    toast({
      title: "Joined Board",
      status: "success",
      duration: 2000,
    });
  }, [toast]);

  // Use the socket hook to manage board state and actions
  const {
    board,
    isTimerRunning,
    timeLeft,
    hideCards,
    setHideCards, // Note: This is now requestHideCards from the hook
    hasJoined,
    joinBoard,
    changeName,
    addCard,
    editCard,
    deleteCard,
    toggleVote,
    toggleTimer,
    updateSettings,
  } = useRetroSocket({
    boardId: boardId || "",
    onBoardJoined,
  });

  // Handler for joining the board (passed to JoinRetroBoardModal)
  const handleJoinBoard = useCallback(
    (name: string, password?: string) => {
      if (!boardId) return;
      setUserNameAndStorage(name);
      joinBoard(name, password);
    },
    [boardId, joinBoard, setUserNameAndStorage]
  );

  // Handler for submitting name change (passed to RetroBoardView -> ChangeRetroBoardNameModal)
  const handleChangeNameSubmit = useCallback(
    (newName: string) => {
      if (!boardId) return;
      changeName(newName);
      setUserNameAndStorage(newName);
      // Closing the modal is handled within RetroBoardView now
    },
    [boardId, changeName, setUserNameAndStorage]
  );

  // Handler for adding a card (passed to RetroBoardView -> RetroColumn)
  const handleAddCard = useCallback(
    (columnId: string, text: string) => {
      if (!text.trim() || !isTimerRunning || !userName) return;
      const cardId = Math.random().toString(36).substring(7); // Consider more robust ID generation
      addCard(cardId, columnId, text, userName);
    },
    [isTimerRunning, userName, addCard]
  );

  // Memoized handler for toggling card visibility
  const handleToggleCards = useCallback(() => {
    setHideCards(!hideCards); // Call the function from the hook
  }, [hideCards, setHideCards]); // Depend on current state and the setter function

  // Show loading state while board data is being fetched
  if (!board) {
    return (
      <Center minH="calc(100vh - 120px)">
        <VStack spacing={4}>
          <Spinner size="xl" />
          <Text>Loading board...</Text>
        </VStack>
      </Center>
    );
  }

  // Show join modal if the user hasn't joined yet
  if (!hasJoined) {
    return (
      <JoinRetroBoardModal
        isOpen={true}
        onClose={() => navigate("/retro")} // Navigate back if modal is closed
        onJoin={handleJoinBoard}
        hasPassword={board?.hasPassword} // Pass password requirement info
      />
    );
  }

  // Render the main board view component
  return (
    <RetroBoardView
      board={board}
      userName={userName}
      isTimerRunning={isTimerRunning}
      timeLeft={timeLeft}
      hideCards={hideCards}
      onToggleCards={handleToggleCards} // Pass the memoized handler
      onToggleTimer={toggleTimer}
      onChangeNameSubmit={handleChangeNameSubmit}
      onAddCard={handleAddCard}
      onEditCard={editCard}
      onDeleteCard={deleteCard}
      onVoteCard={toggleVote}
      onUpdateSettings={updateSettings}
    />
  );
};

export default RetroBoard;
