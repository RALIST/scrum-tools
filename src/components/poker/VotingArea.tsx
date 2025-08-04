import { FC, memo, useCallback, useMemo } from 'react';
import { VStack, Wrap, WrapItem, Stack, Button, useToast } from '@chakra-ui/react';
import { SEQUENCES, SequenceType } from '../../constants/poker'; // Re-added import
import { Card } from './Card';

interface VotingAreaProps {
  sequence: SequenceType; // Changed back to key type
  selectedCard: string | null;
  isRevealed: boolean;
  onCardSelect: (value: string) => void;
  onRevealVotes: () => void;
  onResetVotes: () => void;
}

export const VotingArea: FC<VotingAreaProps> = memo(
  ({ sequence, selectedCard, isRevealed, onCardSelect, onRevealVotes, onResetVotes }) => {
    const toast = useToast();

    // Memoize sequence values to avoid repeated lookups
    const sequenceValues = useMemo(() => {
      return SEQUENCES[sequence] || SEQUENCES['fibonacci'] || [];
    }, [sequence]);

    const handleCardSelectInternal = useCallback(
      (value: string) => {
        onCardSelect(value);
        toast({
          title: 'Vote Recorded',
          description: `You selected: ${value}`, // Changed "points" to be more general
          status: 'success',
          duration: 2000,
        });
      },
      [onCardSelect, toast]
    );

    return (
      <VStack spacing={{ base: 4, md: 8 }} w="full">
        <Wrap spacing={4} justify="center">
          {/* Use memoized sequence values */}
          {sequenceValues.map(value => (
            <WrapItem key={value}>
              <Card
                value={value}
                isSelected={selectedCard === value}
                onClick={() => handleCardSelectInternal(value)}
                disabled={isRevealed}
              />
            </WrapItem>
          ))}
        </Wrap>

        <Stack direction={{ base: 'column', md: 'row' }} spacing={4} justify="center" w="full">
          <Button
            colorScheme="blue"
            onClick={onRevealVotes}
            disabled={isRevealed}
            w={{ base: 'full', md: 'auto' }}
          >
            Reveal Votes
          </Button>
          <Button colorScheme="orange" onClick={onResetVotes} w={{ base: 'full', md: 'auto' }}>
            New Round
          </Button>
        </Stack>
      </VStack>
    );
  }
);

VotingArea.displayName = 'VotingArea';
