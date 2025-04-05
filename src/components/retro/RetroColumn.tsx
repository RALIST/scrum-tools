import React, { FC, useState } from "react"; // Import React for memo
import { VStack, Heading, Box, useColorMode } from "@chakra-ui/react";
import RetroCard from "./RetroCard";
import RetroCardInput from "./RetroCardInput";
import { RetroCard as RetroCardType } from "../../hooks/useRetroSocket";

interface RetroColumnProps {
  title: string;
  color: string;
  cards: RetroCardType[];
  hideCards: boolean;
  hideAuthorNames: boolean;
  userName: string;
  isTimerRunning: boolean;
  // Remove inputValue and onInputChange from props
  // inputValue: string;
  // onInputChange: (value: string) => void;
  onAddCard: (text: string) => void; // Pass text directly
  onDeleteCard: (cardId: string) => void;
  onVoteCard: (cardId: string) => void;
  onEditCard: (cardId: string, text: string) => void;
}

const RetroColumn: FC<RetroColumnProps> = ({
  title,
  color,
  cards,
  hideCards,
  hideAuthorNames,
  userName,
  isTimerRunning,
  // inputValue, // Removed prop
  // onInputChange, // Removed prop
  onAddCard, // Keep onAddCard, but it will now receive text
  onDeleteCard,
  onVoteCard,
  onEditCard,
}) => {
  const { colorMode } = useColorMode();
  const [inputValue, setInputValue] = useState(""); // Internal state for input

  const handleAddClick = () => {
    if (inputValue.trim()) {
      onAddCard(inputValue.trim()); // Pass the text to the handler
      setInputValue(""); // Clear input after adding
    }
  };

  return (
    <Box
      bg={colorMode === "light" ? "white" : "gray.700"}
      borderRadius="lg"
      shadow="md"
      h="full"
      display="flex"
      flexDirection="column"
    >
      <Box
        p={4}
        borderBottom="1px"
        borderColor={colorMode === "light" ? "gray.100" : "gray.600"}
      >
        <Heading size="md" color={color} textAlign="center">
          {title}
        </Heading>
      </Box>

      <VStack
        flex={1}
        spacing={3}
        align="stretch"
        overflowY="auto"
        p={4}
        minH={0}
        sx={{
          "&::-webkit-scrollbar": {
            width: "4px",
          },
          "&::-webkit-scrollbar-track": {
            width: "6px",
          },
          "&::-webkit-scrollbar-thumb": {
            background: colorMode === "light" ? "gray.300" : "gray.600",
            borderRadius: "24px",
          },
        }}
      >
        {cards.map((card) => (
          <RetroCard
            key={card.id}
            id={card.id}
            text={card.text}
            authorName={card.author_name}
            votes={card.votes || []}
            hideCards={hideCards}
            hideAuthorNames={hideAuthorNames}
            currentUserName={userName}
            onDelete={onDeleteCard}
            onVote={onVoteCard}
            onEdit={onEditCard}
          />
        ))}
      </VStack>

      <Box
        p={4}
        borderTop="1px"
        borderColor={colorMode === "light" ? "gray.100" : "gray.600"}
      >
        <RetroCardInput
          isTimerRunning={isTimerRunning}
          value={inputValue} // Use internal state
          onChange={setInputValue} // Use internal state setter
          onSubmit={handleAddClick} // Use internal handler
          userName={userName}
        />
      </Box>
    </Box>
  );
};

export default React.memo(RetroColumn); // Memoize the component
