import React, { FC, useMemo, Suspense, lazy } from 'react';
import {
  Box,
  SimpleGrid,
  VStack,
  useColorMode,
  useDisclosure,
  Flex,
  Spinner,
  Center,
} from '@chakra-ui/react';
import { Helmet } from 'react-helmet-async';
import { RetroHeader, RetroColumn } from '.'; // Assuming index.ts exports these
// Import the correct type name 'RetroBoard' and also 'RetroCard'
import { RetroBoard, RetroCard } from '../../hooks/useRetroSocket';

// Lazy load modal components
const RetroBoardSettingsModal = lazy(() => import('../modals/RetroBoardSettingsModal'));
const ChangeRetroBoardNameModal = lazy(() => import('../modals/ChangeRetroBoardNameModal'));

// Modal loading component for retro
const RetroModalLoadingSpinner: FC = () => (
  <Center h="250px">
    <Spinner size="lg" color="green.500" />
  </Center>
);

// Define Column type locally or import
interface RetroColumnType {
  id: string;
  title: string;
  color: string;
}

const COLUMNS: RetroColumnType[] = [
  { id: 'good', title: 'What Went Well', color: 'green.500' },
  { id: 'improve', title: 'What Could Be Improved', color: 'orange.500' },
  { id: 'actions', title: 'Action Items', color: 'blue.500' },
];

interface RetroBoardViewProps {
  board: RetroBoard; // Use the correct type name
  userName: string | null;
  isTimerRunning: boolean;
  timeLeft: number;
  hideCards: boolean;
  onToggleCards: () => void;
  onToggleTimer: () => void;
  onChangeNameSubmit: (newName: string) => void; // Renamed for clarity
  onAddCard: (columnId: string, text: string) => void;
  onEditCard: (cardId: string, newText: string) => void;
  onDeleteCard: (cardId: string) => void;
  onVoteCard: (cardId: string) => void;
  onUpdateSettings: (settings: {
    defaultTimer: number;
    hideCardsByDefault: boolean;
    hideAuthorNames: boolean;
  }) => void;
  isNameFixed: boolean; // Add the new prop
}

const RetroBoardView: FC<RetroBoardViewProps> = ({
  board,
  userName,
  isTimerRunning,
  timeLeft,
  hideCards,
  onToggleCards,
  onToggleTimer,
  onChangeNameSubmit,
  onAddCard,
  onEditCard,
  onDeleteCard,
  onVoteCard,
  onUpdateSettings,
  isNameFixed, // Destructure the new prop
}) => {
  const { colorMode } = useColorMode();
  const {
    isOpen: isSettingsOpen,
    onOpen: onSettingsOpen,
    onClose: onSettingsClose,
  } = useDisclosure();
  const {
    isOpen: isChangeNameOpen,
    onOpen: onChangeNameOpen,
    onClose: onChangeNameClose,
  } = useDisclosure();

  // Memoize column cards calculation
  const columnCards = useMemo(() => {
    return COLUMNS.reduce(
      (acc, column) => {
        // Add explicit type for 'card' using the imported RetroCard type
        acc[column.id] = board.cards.filter((card: RetroCard) => card.column_id === column.id);
        return acc;
      },
      {} as { [key: string]: typeof board.cards }
    );
  }, [board.cards]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <Helmet>
        {/* Use board name from props */}
        <title>{board.name} - Retro Board</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <Box
        bg={colorMode === 'light' ? 'gray.50' : 'gray.900'}
        borderRadius="lg"
        display="flex"
        flexDirection="column"
        flex="1"
        p={4} // Add some padding to the container
      >
        <VStack spacing={6} align="stretch" flex={1}>
          {' '}
          {/* Reduced spacing */}
          <RetroHeader
            boardName={board.name}
            userName={userName || 'User'} // Provide a fallback for null userName
            boardId={board.id}
            isTimerRunning={isTimerRunning}
            timeLeft={timeLeft}
            hideCards={hideCards}
            onToggleCards={onToggleCards}
            onToggleTimer={onToggleTimer}
            onOpenSettings={onSettingsOpen} // Use local disclosure handler
            onChangeName={onChangeNameOpen} // Use local disclosure handler
            isNameFixed={isNameFixed} // Pass the flag down to the header
          />
          <Flex flex={1} minH={0} overflowX="auto">
            {' '}
            {/* Allow horizontal scroll if needed */}
            <SimpleGrid
              columns={{ base: 1, md: 3 }}
              spacing={6} // Reduced spacing
              w="full"
              minW={COLUMNS.length * 320} // Ensure minimum width for columns
              alignItems="flex-start" // Align columns to top
            >
              {COLUMNS.map(column => (
                <RetroColumn
                  key={column.id}
                  title={column.title}
                  color={column.color}
                  cards={columnCards[column.id] || []}
                  hideCards={hideCards}
                  hideAuthorNames={board.hide_author_names}
                  userName={userName || ''} // Provide fallback for null userName
                  isTimerRunning={isTimerRunning}
                  onAddCard={text => onAddCard(column.id, text)} // Pass columnId
                  onDeleteCard={onDeleteCard}
                  onVoteCard={onVoteCard}
                  onEditCard={onEditCard}
                />
              ))}
            </SimpleGrid>
          </Flex>
        </VStack>

        {/* Settings Modal */}
        <Suspense fallback={<RetroModalLoadingSpinner />}>
          <RetroBoardSettingsModal
            isOpen={isSettingsOpen}
            onClose={onSettingsClose}
            settings={{
              defaultTimer: board.default_timer,
              hideCardsByDefault: board.hide_cards_by_default,
              hideAuthorNames: board.hide_author_names,
            }}
            onSave={onUpdateSettings}
          />
        </Suspense>

        {/* Change Name Modal - Conditionally render based on isNameFixed */}
        {!isNameFixed && (
          <Suspense fallback={<RetroModalLoadingSpinner />}>
            <ChangeRetroBoardNameModal
              isOpen={isChangeNameOpen}
              onClose={onChangeNameClose}
              currentName={userName || ''} // Pass current name
              onChangeName={onChangeNameSubmit} // Pass handler from props
            />
          </Suspense>
        )}
      </Box>
    </>
  );
};

// Memoize the view component
export default React.memo(RetroBoardView);
