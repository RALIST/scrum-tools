import { FC, useMemo, useState, useRef, useEffect } from 'react'
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
    Textarea,
    ButtonGroup
} from '@chakra-ui/react'
import { DeleteIcon, TriangleUpIcon, EditIcon, CheckIcon, CloseIcon } from '@chakra-ui/icons'

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
    onEdit: (cardId: string, newText: string) => void
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
    onVote,
    onEdit
}) => {
    const { colorMode } = useColorMode()
    const [isEditing, setIsEditing] = useState(false)
    const [editText, setEditText] = useState(text)
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const isAuthor = useMemo(() => authorName === currentUserName, [authorName, currentUserName])
    const shouldHideContent = useMemo(() => hideCards && !isAuthor, [hideCards, isAuthor])

    useEffect(() => {
        if (isEditing && textareaRef.current) {
            textareaRef.current.focus()
            textareaRef.current.setSelectionRange(editText.length, editText.length)
        }
    }, [isEditing])

    const handleStartEdit = () => {
        setEditText(text)
        setIsEditing(true)
    }

    const handleSaveEdit = () => {
        if (editText.trim() !== text) {
            onEdit(id, editText.trim())
        }
        setIsEditing(false)
    }

    const handleCancelEdit = () => {
        setEditText(text)
        setIsEditing(false)
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && e.metaKey) {
            handleSaveEdit()
        } else if (e.key === 'Escape') {
            handleCancelEdit()
        }
    }

    return (
        <Card variant="outline" size="sm">
            <CardBody>
                <VStack align="stretch" spacing={3}>
                    <Box>
                        {isEditing ? (
                            <Textarea
                                ref={textareaRef}
                                value={editText}
                                onChange={(e) => setEditText(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Enter your text..."
                                size="sm"
                                resize="vertical"
                                rows={3}
                                autoFocus
                            />
                        ) : (
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
                        )}
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
                                isDisabled={shouldHideContent || isEditing}
                                minW="70px"
                            >
                                {votes.length}
                            </Button>
                        </Tooltip>
                        {isAuthor && (
                            isEditing ? (
                                <ButtonGroup size="sm" spacing={1}>
                                    <IconButton
                                        aria-label="Save edit"
                                        icon={<CheckIcon />}
                                        colorScheme="green"
                                        variant="ghost"
                                        onClick={handleSaveEdit}
                                    />
                                    <IconButton
                                        aria-label="Cancel edit"
                                        icon={<CloseIcon />}
                                        colorScheme="red"
                                        variant="ghost"
                                        onClick={handleCancelEdit}
                                    />
                                </ButtonGroup>
                            ) : (
                                <ButtonGroup size="sm" spacing={1}>
                                    <IconButton
                                        aria-label="Edit card"
                                        icon={<EditIcon />}
                                        colorScheme="blue"
                                        variant="ghost"
                                        onClick={handleStartEdit}
                                    />
                                    <IconButton
                                        aria-label="Delete card"
                                        icon={<DeleteIcon />}
                                        colorScheme="red"
                                        variant="ghost"
                                        onClick={() => onDelete(id)}
                                    />
                                </ButtonGroup>
                            )
                        )}
                    </HStack>
                </VStack>
            </CardBody>
        </Card>
    )
}

export default RetroCard
