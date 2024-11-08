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
    useColorMode
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
        <Card variant="outline">
            <CardBody>
                <VStack align="stretch" spacing={2}>
                    <HStack justify="space-between" align="start">
                        <VStack align="start" spacing={1} flex={1}>
                            <Text>
                                {shouldHideContent ? '[ Hidden ]' : text}
                            </Text>
                            {!hideAuthorNames && (
                                <Text fontSize="sm" color={colorMode === 'light' ? 'gray.500' : 'gray.400'}>
                                    Added by: {authorName}
                                </Text>
                            )}
                        </VStack>
                        <HStack>
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
                    </HStack>
                </VStack>
            </CardBody>
        </Card>
    )
}

export default RetroCard
