import { FC } from 'react'
import {
    VStack,
    Heading,
    Box,
    useColorMode
} from '@chakra-ui/react'
import RetroCard from './RetroCard'
import RetroCardInput from './RetroCardInput'
import { RetroCard as RetroCardType } from '../../hooks/useRetroSocket'

interface RetroColumnProps {
    id: string
    title: string
    color: string
    cards: RetroCardType[]
    hideCards: boolean
    hideAuthorNames: boolean
    userName: string
    isTimerRunning: boolean
    inputValue: string
    onInputChange: (value: string) => void
    onAddCard: () => void
    onDeleteCard: (cardId: string) => void
    onVoteCard: (cardId: string) => void
}

const RetroColumn: FC<RetroColumnProps> = ({
    id,
    title,
    color,
    cards,
    hideCards,
    hideAuthorNames,
    userName,
    isTimerRunning,
    inputValue,
    onInputChange,
    onAddCard,
    onDeleteCard,
    onVoteCard
}) => {
    const { colorMode } = useColorMode()

    return (
        <VStack
            bg={colorMode === 'light' ? 'white' : 'gray.700'}
            p={4}
            borderRadius="lg"
            shadow="md"
            spacing={4}
            align="stretch"
            minH="400px"
            h="calc(100vh - 300px)"
        >
            <Heading
                size="md"
                color={color}
                textAlign="center"
                mb={2}
            >
                {title}
            </Heading>

            <Box
                flex="1"
                overflowY="auto"
                sx={{
                    '&::-webkit-scrollbar': {
                        width: '4px',
                    },
                    '&::-webkit-scrollbar-track': {
                        width: '6px',
                    },
                    '&::-webkit-scrollbar-thumb': {
                        background: colorMode === 'light' ? 'gray.300' : 'gray.600',
                        borderRadius: '24px',
                    },
                }}
            >
                <VStack spacing={3} align="stretch" pb={2}>
                    {cards.map(card => (
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
                        />
                    ))}
                </VStack>
            </Box>

            <Box mt="auto" pt={2}>
                <RetroCardInput
                    columnId={id}
                    isTimerRunning={isTimerRunning}
                    value={inputValue}
                    onChange={onInputChange}
                    onSubmit={onAddCard}
                    userName={userName}
                />
            </Box>
        </VStack>
    )
}

export default RetroColumn
