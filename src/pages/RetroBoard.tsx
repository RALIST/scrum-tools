import { FC, useState, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
    Box,
    SimpleGrid,
    VStack,
    useColorMode,
    useToast,
    useDisclosure,
    Spinner,
    Center,
    Text,
    Flex
} from '@chakra-ui/react'
import { Helmet } from 'react-helmet-async'
import { RetroBoardSettingsModal, JoinRetroBoardModal, ChangeRetroBoardNameModal } from '../components/modals'
import { useRetroSocket } from '../hooks/useRetroSocket'
import { RetroHeader, RetroColumn } from '../components/retro'

const COLUMNS = [
    { id: 'good', title: 'What Went Well', color: 'green.500' },
    { id: 'improve', title: 'What Could Be Improved', color: 'orange.500' },
    { id: 'actions', title: 'Action Items', color: 'blue.500' }
]

const RetroBoard: FC = () => {
    const { colorMode } = useColorMode()
    const { boardId } = useParams()
    const navigate = useNavigate()
    const toast = useToast()
    const [userName, setUserName] = useState(() => localStorage.getItem('retroUserName') || '')
    const [newCardText, setNewCardText] = useState<{ [key: string]: string }>({})
    const { isOpen: isSettingsOpen, onOpen: onSettingsOpen, onClose: onSettingsClose } = useDisclosure()
    const { isOpen: isChangeNameOpen, onOpen: onChangeNameOpen, onClose: onChangeNameClose } = useDisclosure()

    const onBoardJoined = useCallback(() => {
        toast({
            title: 'Joined Board',
            status: 'success',
            duration: 2000,
        })
    }, [toast])

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
        editCard,
        deleteCard,
        toggleVote,
        toggleTimer,
        updateSettings
    } = useRetroSocket({
        boardId: boardId || '',
        onBoardJoined
    })

    const handleJoinBoard = useCallback((name: string, password?: string) => {
        if (!boardId) return
        setUserName(name)
        localStorage.setItem('retroUserName', name)
        joinBoard(name, password)
    }, [boardId, joinBoard])

    const handleChangeName = useCallback((newName: string) => {
        if (!boardId) return
        changeName(newName)
        setUserName(newName)
        localStorage.setItem('retroUserName', newName)
        onChangeNameClose()
    }, [boardId, changeName, onChangeNameClose])

    const handleAddCard = useCallback((columnId: string) => {
        if (!newCardText[columnId]?.trim() || !isTimerRunning || !userName) return

        const cardId = Math.random().toString(36).substring(7)
        addCard(cardId, columnId, newCardText[columnId], userName)
        setNewCardText(prev => ({ ...prev, [columnId]: '' }))
    }, [newCardText, isTimerRunning, userName, addCard])

    const columnCards = useMemo(() => {
        if (!board) return {}
        return COLUMNS.reduce((acc, column) => {
            acc[column.id] = board.cards.filter(card => card.column_id === column.id)
            return acc
        }, {} as { [key: string]: typeof board.cards })
    }, [board])

    // Show loading state
    if (!board) {
        return (
            <Center minH="calc(100vh - 120px)">
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
                isOpen={true}
                onClose={() => navigate('/retro')}
                onJoin={handleJoinBoard}
                hasPassword={board?.hasPassword}
            />
        )
    }

    return (
        <>
            <Helmet>
                <title>Retro Board</title>
                <meta name="robots" content="noindex, nofollow" />
            </Helmet>
            <Box
                bg={colorMode === 'light' ? 'gray.50' : 'gray.900'}
                borderRadius="lg"
                display="flex"
                flexDirection="column"
                flex="1"
            >
                <VStack spacing={8} align="stretch" flex={1}>
                    <RetroHeader
                        boardName={board.name}
                        userName={userName}
                        isTimerRunning={isTimerRunning}
                        timeLeft={timeLeft}
                        hideCards={hideCards}
                        onToggleCards={() => setHideCards(!hideCards)}
                        onToggleTimer={toggleTimer}
                        onOpenSettings={onSettingsOpen}
                        onChangeName={onChangeNameOpen}
                    />

                    <Flex flex={1} minH={0}>
                        <SimpleGrid
                            columns={{ base: 1, md: 3 }}
                            spacing={8}
                            w="full"
                            alignItems="stretch"
                        >
                            {COLUMNS.map(column => (
                                <RetroColumn
                                    key={column.id}
                                    title={column.title}
                                    color={column.color}
                                    cards={columnCards[column.id] || []}
                                    hideCards={hideCards}
                                    hideAuthorNames={board.hide_author_names}
                                    userName={userName}
                                    isTimerRunning={isTimerRunning}
                                    inputValue={newCardText[column.id] || ''}
                                    onInputChange={(value) => setNewCardText(prev => ({
                                        ...prev,
                                        [column.id]: value
                                    }))}
                                    onAddCard={() => handleAddCard(column.id)}
                                    onDeleteCard={deleteCard}
                                    onVoteCard={toggleVote}
                                    onEditCard={editCard}
                                />
                            ))}
                        </SimpleGrid>
                    </Flex>
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
        </>
    )
}

export default RetroBoard
