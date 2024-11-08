import { FC, useMemo } from 'react'
import {
    Card,
    CardBody,
    VStack,
    HStack,
    Text,
    Button,
    IconButton,
    Tooltip,
    useColorMode,
    Box,
    Spacer
} from '@chakra-ui/react'
import { DeleteIcon, TriangleUpIcon } from '@chakra-ui/icons'

interface RetroCardProps {
    id: string
    text: string
    authorName: string
    votes: string[]
    hideCards: boolean
    hideAuthorNames: boolean
    currentUserName: string
    onDelete: (cardId: string) => void
    onVote: (cardId: string) => void
}

const RetroCard: FC<RetroCardProps> = ({
    id,
    text,
    authorName,
    votes,
    hideCards,
    hideAuthorNames,
    currentUserName,
    onDelete,
    onVote
}) => {
    const { colorMode } = useColorMode()
    const isAuthor = useMemo(() => authorName === currentUserName, [authorName, currentUserName])
    const shouldHideContent = useMemo(() => hideCards && !isAuthor, [hideCards, isAuthor])

    return (
        <Card variant="outline" size="sm">
            <CardBody>
                <VStack align="stretch" spacing={3}>
                    <Box>
                        <Text
                            whiteSpace="pre-wrap"
                            wordBreak="break-word"
                            fontSize="sm"
                            maxH="200px"
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
                            {shouldHideContent ? '[ Hidden ]' : text}
                        </Text>
                        {!hideAuthorNames && (
                            <Text
                                fontSize="xs"
                                color={colorMode === 'light' ? 'gray.500' : 'gray.400'}
                                mt={1}
                            >
                                Added by: {authorName}
                            </Text>
                        )}
                    </Box>

                    <HStack justify="space-between" align="center" mt="auto">
                        <Tooltip
                            label={votes.length > 0
                                ? `Votes: ${votes.join(', ')}`
                                : 'No votes yet'}
                            placement="top"
                        >
                            <Button
                                size="sm"
                                variant="ghost"
                                leftIcon={<TriangleUpIcon />}
                                onClick={() => onVote(id)}
                                colorScheme={votes.includes(currentUserName) ? "blue" : "gray"}
                                isDisabled={shouldHideContent}
                                minW="70px"
                            >
                                {votes.length}
                            </Button>
                        </Tooltip>
                        {isAuthor && (
                            <IconButton
                                aria-label="Delete card"
                                icon={<DeleteIcon />}
                                size="sm"
                                variant="ghost"
                                colorScheme="red"
                                onClick={() => onDelete(id)}
                            />
                        )}
                    </HStack>
                </VStack>
            </CardBody>
        </Card>
    )
}

export default RetroCard
