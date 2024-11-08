import { FC, useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
    Box,
    Heading,
    SimpleGrid,
    VStack,
    Text,
    Button,
    useColorMode,
    Input,
    IconButton,
    Card,
    CardBody,
    HStack,
    useToast,
    Badge,
    useDisclosure,
    Divider,
    Spinner,
    Center,
    Tooltip
} from '@chakra-ui/react'
import { AddIcon, DeleteIcon, ViewIcon, ViewOffIcon, TimeIcon, SettingsIcon, EditIcon, TriangleUpIcon } from '@chakra-ui/icons'
import PageContainer from '../components/PageContainer'
import { Helmet } from 'react-helmet-async'
import { RetroBoardSettingsModal, JoinRetroBoardModal, ChangeRetroBoardNameModal } from '../components/modals'
import { useRetroSocket, type RetroBoard as RetroType } from '../hooks/useRetroSocket'

const COLUMNS = [
    { id: 'good', title: 'What Went Well', color: 'green.500' },
    { id: 'improve', title: 'What Could Be Improved', color: 'orange.500' },
    { id: 'actions', title: 'Action Items', color: 'blue.500' }
]

const RetroBoard: FC = () => {
    const { colorMode } = useColorMode()
    const { boardId } = useParams<{ boardId: string }>()
    const navigate = useNavigate()
    const toast = useToast()
    const [userName, setUserName] = useState<string>('')
    const [newCardText, setNewCardText] = useState<{ [key: string]: string }>({})
    const { isOpen: isSettingsOpen, onOpen: onSettingsOpen, onClose: onSettingsClose } = useDisclosure()
    const { isOpen: isJoinOpen, onOpen: onJoinOpen, onClose: onJoinClose } = useDisclosure()
    const { isOpen: isChangeNameOpen, onOpen: onChangeNameOpen, onClose: onChangeNameClose } = useDisclosure()

    const {
        board,
        isTimerRunning,
        timeLeft,
        hideCards,
        setHideCards,
        hasJoined,
        joinBoard,
        changeName,
        addCard,
        deleteCard,
        toggleVote,
        toggleTimer,
        updateSettings
    } = useRetroSocket({
        boardId: boardId || '',
        onBoardJoined: () => {
            console.log('Board joined successfully')
        }
    })

    // Show join modal when board is loaded but not joined
    useEffect(() => {
        if (board && !hasJoined) {
            const savedUsername = localStorage.getItem('retroUserName')
            if (savedUsername) {
                setUserName(savedUsername)
                joinBoard(savedUsername)
            } else {
                onJoinOpen()
            }
        }
    }, [board, hasJoined])

    const handleJoinBoard = (name: string, password?: string) => {
        console.log('Handling join board:', { name })
        if (!boardId) return
        setUserName(name)
        localStorage.setItem('retroUserName', name)
        onJoinClose()
        joinBoard(name, password)
    }

    const handleChangeName = (newName: string) => {
        console.log('Handling name change:', newName)
        if (!boardId) return
        changeName(newName)
        setUserName(newName)
        localStorage.setItem('retroUserName', newName)
        onChangeNameClose()
    }

    const handleAddCard = (columnId: string) => {
        if (!newCardText[columnId]?.trim() || !isTimerRunning || !userName) {
            if (!userName) {
                toast({
                    title: 'Error',
                    description: 'Please enter your name first',
                    status: 'error',
                    duration: 2000,
                })
            }
            return
        }

        const cardId = Math.random().toString(36).substring(7)
        addCard(cardId, columnId, newCardText[columnId], userName)
        setNewCardText({ ...newCardText, [columnId]: '' })
    }

    const handleToggleCards = () => {
        setHideCards(!hideCards)
        toast({
            title: hideCards ? 'Cards Revealed' : 'Cards Hidden',
            status: 'info',
            duration: 2000,
        })
    }

    const formatTime = (seconds: number) => {
        const minutes = Math.floor(seconds / 60)
        const remainingSeconds = seconds % 60
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
    }

    // Show loading state
    if (!board) {
        return (
            <Center minH="100vh">
                <VStack spacing={4}>
                    <Spinner size="xl" />
                    <Text>Loading board...</Text>
                </VStack>
            </Center>
        )
    }

    // Show join modal
    if (!hasJoined) {
        return (
            <JoinRetroBoardModal
                isOpen={isJoinOpen}
                onClose={() => navigate('/retro')}
                onJoin={handleJoinBoard}
                hasPassword={board?.hasPassword}
            />
        )
    }

    return (
        <PageContainer>
            <Helmet>
                <title>Retro Board</title>
                <meta name="robots" content="noindex, nofollow" />
            </Helmet>
            <Box bg={colorMode === 'light' ? 'gray.50' : 'gray.900'} minH="calc(100vh - 60px)" p={4}>
                <VStack spacing={8} align="stretch">
                    <Box textAlign="center">
                        <VStack spacing={4}>
                            <Heading as="h1" size="xl">
                                {board.name}
                            </Heading>
                            <HStack justify="center" spacing={4}>
                                <IconButton
                                    aria-label={hideCards ? "Show Cards" : "Hide Cards"}
                                    icon={hideCards ? <ViewIcon /> : <ViewOffIcon />}
                                    onClick={handleToggleCards}
                                    colorScheme="purple"
                                    size="sm"
                                />
                                <Button
                                    leftIcon={<TimeIcon />}
                                    onClick={toggleTimer}
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
                                    onClick={onSettingsOpen}
                                    size="sm"
                                />
                            </HStack>
                            <Divider />
                            <Text fontSize="lg" color={colorMode === 'light' ? 'gray.600' : 'gray.300'}>
                                Share your thoughts about the sprint
                            </Text>
                            {!isTimerRunning && timeLeft < (board?.default_timer ?? 300) && (
                                <Text color="red.500" mt={2}>
                                    Timer is paused. Cards cannot be added.
                                </Text>
                            )}
                            <HStack justify="center">
                                <Text>Your name: {userName}</Text>
                                <IconButton
                                    aria-label="Change name"
                                    icon={<EditIcon />}
                                    size="sm"
                                    onClick={onChangeNameOpen}
                                />
                            </HStack>
                        </VStack>
                    </Box>

                    <SimpleGrid columns={{ base: 1, md: 3 }} spacing={8}>
                        {COLUMNS.map(column => (
                            <VStack
                                key={column.id}
                                bg={colorMode === 'light' ? 'white' : 'gray.700'}
                                p={4}
                                borderRadius="lg"
                                shadow="md"
                                spacing={4}
                                align="stretch"
                            >
                                <Heading
                                    size="md"
                                    color={column.color}
                                    textAlign="center"
                                >
                                    {column.title}
                                </Heading>

                                <VStack spacing={4} align="stretch">
                                    {board?.cards
                                        .filter(card => card.column_id === column.id)
                                        .sort((a, b) => (b.votes || []).length - (a.votes || []).length) // Sort by votes with fallback
                                        .map(card => (
                                            <Card key={card.id} variant="outline">
                                                <CardBody>
                                                    <VStack align="stretch" spacing={2}>
                                                        <HStack justify="space-between" align="start">
                                                            <VStack align="start" spacing={1} flex={1}>
                                                                <Text>{hideCards ? '[ Hidden ]' : card.text}</Text>
                                                                {!board.hide_author_names && (
                                                                    <Text fontSize="sm" color="gray.500">
                                                                        Added by: {card.author_name}
                                                                    </Text>
                                                                )}
                                                            </VStack>
                                                            <HStack>
                                                                <Tooltip
                                                                    label={(card.votes || []).length > 0
                                                                        ? `Votes: ${(card.votes || []).join(', ')}`
                                                                        : 'No votes yet'}
                                                                >
                                                                    <Button
                                                                        size="sm"
                                                                        variant="ghost"
                                                                        leftIcon={<TriangleUpIcon />}
                                                                        onClick={() => toggleVote(card.id)}
                                                                        colorScheme={(card.votes || []).includes(userName) ? "blue" : "gray"}
                                                                    >
                                                                        {(card.votes || []).length}
                                                                    </Button>
                                                                </Tooltip>
                                                                <IconButton
                                                                    aria-label="Delete card"
                                                                    icon={<DeleteIcon />}
                                                                    size="sm"
                                                                    variant="ghost"
                                                                    colorScheme="red"
                                                                    onClick={() => deleteCard(card.id)}
                                                                />
                                                            </HStack>
                                                        </HStack>
                                                    </VStack>
                                                </CardBody>
                                            </Card>
                                        ))}

                                    <Box>
                                        <Input
                                            placeholder={isTimerRunning ? "Add a new card" : "Timer is paused"}
                                            value={newCardText[column.id] || ''}
                                            onChange={(e) => setNewCardText({
                                                ...newCardText,
                                                [column.id]: e.target.value
                                            })}
                                            onKeyPress={(e) => {
                                                if (e.key === 'Enter' && isTimerRunning) {
                                                    handleAddCard(column.id)
                                                }
                                            }}
                                            disabled={!isTimerRunning}
                                        />
                                        <Button
                                            leftIcon={<AddIcon />}
                                            mt={2}
                                            w="full"
                                            onClick={() => handleAddCard(column.id)}
                                            disabled={!isTimerRunning}
                                        >
                                            Add Card
                                        </Button>
                                    </Box>
                                </VStack>
                            </VStack>
                        ))}
                    </SimpleGrid>
                </VStack>

                {board && (
                    <RetroBoardSettingsModal
                        isOpen={isSettingsOpen}
                        onClose={onSettingsClose}
                        settings={{
                            defaultTimer: board.default_timer,
                            hideCardsByDefault: board.hide_cards_by_default,
                            hideAuthorNames: board.hide_author_names
                        }}
                        onSave={updateSettings}
                    />
                )}

                <ChangeRetroBoardNameModal
                    isOpen={isChangeNameOpen}
                    onClose={onChangeNameClose}
                    currentName={userName}
                    onChangeName={handleChangeName}
                />
            </Box>
        </PageContainer>
    )
}

export default RetroBoard
