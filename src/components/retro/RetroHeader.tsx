import React, { FC, useMemo, useCallback } from "react"; // Import React and useCallback
import {
  Box,
  Heading,
  VStack,
  Text,
  Button,
  IconButton,
  HStack,
  Badge,
  Divider,
  useColorMode,
  Tooltip,
  useClipboard,
  useToast,
} from "@chakra-ui/react";
import {
  ViewIcon,
  ViewOffIcon,
  TimeIcon,
  SettingsIcon,
  EditIcon,
  CheckIcon,
  CopyIcon,
} from "@chakra-ui/icons";
import config from "../../config";

// Helper function moved outside
const formatTime = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
};

interface RetroHeaderProps {
  boardName: string;
  userName: string;
  isTimerRunning: boolean;
  timeLeft: number;
  hideCards: boolean;
  boardId: string;
  onToggleCards: () => void;
  onToggleTimer: () => void;
  onOpenSettings: () => void;
  onChangeName: () => void;
}

const RetroHeader: FC<RetroHeaderProps> = ({
  boardName,
  userName,
  isTimerRunning,
  timeLeft,
  hideCards,
  onToggleCards,
  onToggleTimer,
  onOpenSettings,
  onChangeName,
  boardId,
}) => {
  const { colorMode } = useColorMode();
  const shareableLink = useMemo(
    () => `${config.siteUrl}/retro/${boardId}`,
    [boardId]
  );
  const { hasCopied, onCopy } = useClipboard(shareableLink);
  const toast = useToast();

  // Memoize the onClick handler for copy button
  const handleCopyClick = useCallback(() => {
    onCopy(); // Call the hook's onCopy function
    toast({
      title: "Link to board copied",
      status: "success",
      duration: 2000,
    });
  }, [onCopy, toast]); // Add dependencies

  return (
    <Box textAlign="center">
      <VStack spacing={4}>
        <Heading as="h1" size="xl">
          <HStack>
            <Text>{boardName}</Text>
            <Tooltip label={"Copy link to room"}>
              <IconButton
                title="Copy link"
                aria-label="Copy link"
                icon={hasCopied ? <CheckIcon /> : <CopyIcon />}
                onClick={handleCopyClick} // Use the memoized handler
                size="xs"
              />
            </Tooltip>
          </HStack>
        </Heading>
        <Text
          fontSize={{ base: "md", md: "lg" }}
          color={colorMode === "light" ? "gray.600" : "gray.300"}
        >
          ID: {boardId}
        </Text>
        <HStack justify="center" spacing={4}>
          <Tooltip label={hideCards ? "Show Cards" : "Hide Cards"}>
            <IconButton
              aria-label={hideCards ? "Show Cards" : "Hide Cards"}
              icon={hideCards ? <ViewOffIcon /> : <ViewIcon />}
              onClick={onToggleCards}
              colorScheme={hideCards ? "green" : "gray"}
              size="sm"
            />
          </Tooltip>
          <Button
            leftIcon={<TimeIcon />}
            onClick={onToggleTimer}
            colorScheme={isTimerRunning ? "red" : "green"}
            size="sm"
          >
            {isTimerRunning ? "Stop Timer" : "Start Timer"}
          </Button>
          <Badge
            colorScheme={isTimerRunning ? "green" : "gray"}
            fontSize="xl"
            px={3}
            py={1}
            borderRadius="md"
          >
            {formatTime(timeLeft)}
          </Badge>
          <IconButton
            aria-label="Board Settings"
            icon={<SettingsIcon />}
            onClick={onOpenSettings}
            size="sm"
          />
        </HStack>
        <Divider />
        <Text
          fontSize="lg"
          color={colorMode === "light" ? "gray.600" : "gray.300"}
        >
          Share your thoughts about the sprint
        </Text>
        <HStack justify="center">
          <Text>Your name: {userName}</Text>
          <IconButton
            aria-label="Change name"
            icon={<EditIcon />}
            size="xs"
            onClick={onChangeName}
          />
        </HStack>
      </VStack>
    </Box>
  );
};

export default React.memo(RetroHeader); // Memoize the component
