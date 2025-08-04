import { FC, useMemo, memo } from 'react'; // Import useMemo and memo
import {
  Box,
  Heading,
  Text,
  VStack,
  IconButton,
  useColorMode,
  Stack,
  useClipboard,
  useToast,
  Tooltip,
  Divider,
} from '@chakra-ui/react';
import { CopyIcon, CheckIcon, SettingsIcon, EditIcon } from '@chakra-ui/icons';
import config from '../../config'; // Assuming config is accessible

interface RoomHeaderProps {
  roomId: string | undefined;
  // Removed roomName prop
  isJoined: boolean;
  userName: string; // Current user's name (from state or auth)
  isAuthenticated: boolean;
  onSettingsOpen: () => void;
  onChangeNameOpen: () => void;
  participants: { id: string; name: string }[] | null; // Need participants to find current user's name from socket data
  socketId: string | undefined; // Need socket id to match participant
}

export const RoomHeader: FC<RoomHeaderProps> = memo(
  ({
    roomId,
    // Removed roomName destructuring
    isJoined,
    userName,
    isAuthenticated,
    onSettingsOpen,
    onChangeNameOpen,
    participants,
    socketId,
  }) => {
    const { colorMode } = useColorMode();
    const toast = useToast();

    // Memoize the shareable link to avoid recreation on every render
    const shareableLink = useMemo(() => `${config.siteUrl}/planning-poker/${roomId}`, [roomId]);
    const { hasCopied, onCopy } = useClipboard(shareableLink);

    // Find the current user's name from the participants list if available
    const currentParticipantName = useMemo(() => {
      if (!participants || !socketId) return userName; // Fallback to state/prop userName
      const currentUser = participants.find(p => p.id === socketId);
      return currentUser?.name || userName;
    }, [participants, socketId, userName]);

    // Memoize copy handler to prevent recreation
    const handleCopyLink = useMemo(
      () => () => {
        onCopy();
        toast({
          title: 'Link copied',
          status: 'success',
          duration: 2000,
        });
      },
      [onCopy, toast]
    );

    if (!roomId) {
      return null; // Or some placeholder/error
    }

    // Reverted displayTitle logic
    // const displayTitle = roomName ? `${roomName} (${roomId})` : `Room ${roomId}`;

    return (
      <Box textAlign="center" w="full">
        <Heading size={{ base: 'lg', md: 'xl' }} mb={4} textAlign={'center'}>
          <Stack
            direction={{ base: 'column', md: 'row' }}
            spacing={2}
            align="center"
            justify="center" // Center align items
          >
            {/* Reverted display */}
            <Text>Room {roomId}</Text>
            <Stack direction={'row'} spacing={2}>
              <Tooltip label={'Copy link to room'}>
                <IconButton
                  title="Copy link"
                  aria-label="Copy link"
                  icon={hasCopied ? <CheckIcon /> : <CopyIcon />}
                  onClick={handleCopyLink}
                  size="sm"
                />
              </Tooltip>
              {/* Show settings only if joined? Or always? Let's assume always for now */}
              <Tooltip label={'Change room settings'}>
                <IconButton
                  aria-label="Room Settings"
                  icon={<SettingsIcon />}
                  size="sm"
                  onClick={onSettingsOpen}
                  isDisabled={!isJoined} // Disable if not joined
                />
              </Tooltip>
            </Stack>
          </Stack>
        </Heading>
        <Divider my={2} />
        {/* Show user name only if joined */}
        {isJoined && (
          <VStack spacing={2}>
            <Stack direction="row" spacing={2} align="center">
              <Text
                fontSize={{ base: 'md', md: 'lg' }}
                color={colorMode === 'light' ? 'gray.600' : 'gray.300'}
              >
                Playing as: {currentParticipantName}
              </Text>
              {/* Hide change name button if authenticated */}
              {!isAuthenticated && (
                <IconButton
                  aria-label="Change name"
                  icon={<EditIcon />}
                  size="xs"
                  onClick={onChangeNameOpen}
                />
              )}
            </Stack>
          </VStack>
        )}
      </Box>
    );
  }
);

RoomHeader.displayName = 'RoomHeader';
