import { FC, useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
    Box,
    Heading,
    Button,
    Text,
    VStack,
    Table,
    Thead,
    Tbody,
    Tr,
    Th,
    Td,
    Badge,
    IconButton,
    useColorMode,
    useToast,
    Stack,
    TableContainer,
    Wrap,
    WrapItem,
    useClipboard,
    useDisclosure,
    Tooltip,
    Divider
} from '@chakra-ui/react'
import { CopyIcon, CheckIcon, SettingsIcon, EditIcon } from '@chakra-ui/icons'
import PageContainer from '../components/PageContainer'
import { Helmet } from 'react-helmet-async'
import { SEQUENCES, SequenceType } from '../constants/poker'
import { JoinRoomModal, ChangeNameModal, RoomSettingsModal } from '../components/modals'
import { usePokerSocket } from '../hooks/usePokerSocket'
import config from '../config'

const LOCAL_STORAGE_USERNAME_KEY = 'planningPokerUsername'

interface RoomInfo {
    id: string
    name: string
    participantCount: number
    createdAt: string
    hasPassword: boolean
    sequence: string
}

interface CardProps {
    value: string
    isSelected: boolean
    onClick: () => void
    disabled?: boolean
}

const Card: FC<CardProps> = ({ value, isSelected, onClick, disabled }) => {
    const { colorMode } = useColorMode()

    return (
        <Button
            h={{ base: "100px", md: "120px" }}
            w={{ base: "70px", md: "80px" }}
            fontSize={{ base: "xl", md: "2xl" }}
            variant="outline"
            colorScheme={isSelected ? 'blue' : 'gray'}
            bg={isSelected ? (colorMode === 'light' ? 'blue.50' : 'blue.900') : 'transparent'}
            onClick={onClick}
            disabled={disabled}
            _hover={{
                transform: disabled ? 'none' : 'translateY(-4px)',
                transition: 'transform 0.2s'
            }}
        >
            {value}
        </Button>
    )
}

const PlanningPokerRoom: FC = () => {
    const { colorMode } = useColorMode()
    const { roomId } = useParams<{ roomId: string }>()
    const navigate = useNavigate()
    const toast = useToast()
    const [userName, setUserName] = useState(() => localStorage.getItem(LOCAL_STORAGE_USERNAME_KEY) || '')
    const [selectedCard, setSelectedCard] = useState<string | null>(null)
    const [showJoinModal, setShowJoinModal] = useState(true)
    const shareableLink = useMemo(() => `${config.siteUrl}/planning-poker/${roomId}`, [roomId])
    const { hasCopied, onCopy } = useClipboard(shareableLink)
    const { isOpen: isChangeNameOpen, onOpen: onChangeNameOpen, onClose: onChangeNameClose } = useDisclosure()
    const { isOpen: isSettingsOpen, onOpen: onSettingsOpen, onClose: onSettingsClose } = useDisclosure()
    const [newUserName, setNewUserName] = useState<string>('')
    const [roomPassword, setRoomPassword] = useState<string>('')
    const [showPassword, setShowPassword] = useState(false)
    const [newSettings, setNewSettings] = useState<{
        sequence?: SequenceType
        password?: string
    }>({})
    const [isPasswordProtected, setIsPasswordProtected] = useState(false)

    const onRoomJoined = useCallback(() => {
        toast({
            title: 'Joined Room',
            status: 'success',
            duration: 2000,
        })
        setShowJoinModal(false)
    }, [toast])

    const {
        participants,
        settings,
        isRevealed,
        isJoined,
        joinRoom,
        changeName,
        vote,
        revealVotes,
        resetVotes,
        updateSettings: updateRoomSettings
    } = usePokerSocket({
        roomId: roomId || '',
        onRoomJoined
    })

    // Check room password protection once
    useEffect(() => {
        if (!roomId) {
            navigate('/planning-poker')
            return
        }

        let isActive = true
        fetch(`${config.apiUrl}/rooms`)
            .then(res => res.json())
            .then((rooms: RoomInfo[]) => {
                if (!isActive) return
                const room = rooms.find(r => r.id === roomId)
                if (room) {
                    setIsPasswordProtected(room.hasPassword)
                }
            })
            .catch(console.error)

        return () => {
            isActive = false
        }
    }, [roomId, navigate])

    const handleJoinRoom = useCallback(() => {
        if (!userName.trim()) {
            toast({
                title: 'Error',
                description: 'Please enter your name',
                status: 'error',
                duration: 2000,
            })
            return
        }

        if (isPasswordProtected && !roomPassword.trim()) {
            toast({
                title: 'Error',
                description: 'Please enter the room password',
                status: 'error',
                duration: 2000,
            })
            return
        }

        localStorage.setItem(LOCAL_STORAGE_USERNAME_KEY, userName)
        joinRoom(userName, roomPassword)
    }, [userName, roomPassword, isPasswordProtected, joinRoom, toast])

    const handleChangeName = useCallback(() => {
        if (!newUserName.trim()) {
            toast({
                title: 'Error',
                description: 'Please enter a valid name',
                status: 'error',
                duration: 2000,
            })
            return
        }

        localStorage.setItem(LOCAL_STORAGE_USERNAME_KEY, newUserName)
        setUserName(newUserName)
        changeName(newUserName)
        onChangeNameClose()
        toast({
            title: 'Name Updated',
            status: 'success',
            duration: 2000,
        })
    }, [newUserName, changeName, onChangeNameClose, toast])

    const handleUpdateSettings = useCallback(() => {
        updateRoomSettings(newSettings)
        onSettingsClose()
        setNewSettings({})
    }, [newSettings, updateRoomSettings, onSettingsClose])

    const handleCardSelect = useCallback((value: string) => {
        setSelectedCard(value)
        vote(value)
        toast({
            title: 'Vote Recorded',
            description: `You selected ${value} points`,
            status: 'success',
            duration: 2000,
        })
    }, [vote, toast])

    const calculateAverage = useCallback(() => {
        const numericVotes = participants
            .map(p => p.vote)
            .filter(vote => vote && vote !== '?' && !isNaN(Number(vote)))
            .map(Number)

        if (numericVotes.length === 0) return 0
        const avg = numericVotes.reduce((a, b) => a + b, 0) / numericVotes.length
        return avg
    }, [participants])

    const getVoteColor = useCallback((vote: string | null) => {
        if (!vote || vote === '?' || !isRevealed) return undefined

        const voteNum = Number(vote)
        const average = calculateAverage()

        if (isNaN(voteNum)) return undefined

        // Calculate the percentage difference from the average
        const maxDiff = Math.max(...SEQUENCES[settings.sequence]
            .filter(v => v !== '?' && !isNaN(Number(v)))
            .map(v => Math.abs(Number(v) - average)))

        const diff = Math.abs(voteNum - average)
        const percentage = diff / maxDiff

        // Color gradient from green (close to average) to red (far from average)
        if (percentage <= 0.2) return 'green.500'
        if (percentage <= 0.4) return 'green.300'
        if (percentage <= 0.6) return 'yellow.400'
        if (percentage <= 0.8) return 'orange.400'
        return 'red.500'
    }, [isRevealed, settings.sequence, calculateAverage])

    return (
        <PageContainer>
            <Helmet>
                <title>Planning Poker Room {roomId}</title>
                <meta name="robots" content="noindex, nofollow" />
            </Helmet>
            <Box bg={colorMode === 'light' ? 'gray.50' : 'gray.900'} minH="calc(100vh - 60px)">
                <VStack spacing={{ base: 4, md: 8 }}>
                    <Box textAlign="center" w="full">
                        <Heading size={{ base: "lg", md: "xl" }} mb={4} textAlign={"center"}>
                            <Stack direction={{base: "column", md: "row"}} spacing={2} align="center">
                                <Text>Room {roomId}</Text>
                                <Stack direction={"row"} spacing={2}>
                                    <Tooltip label={"Copy link to room"}>
                                        <IconButton
                                            title='Copy link'
                                            aria-label="Copy link"
                                            icon={hasCopied ? <CheckIcon /> : <CopyIcon />}
                                            onClick={() => {
                                                onCopy
                                                toast({
                                                    title: 'Link to room copied',
                                                    status: 'success',
                                                    duration: 2000,
                                                })
                                            }}
                                            size="sm"
                                        />
                                    </Tooltip>
                                    <Tooltip label={"Change room settings"}>
                                        <IconButton
                                            aria-label="Room Settings"
                                            icon={<SettingsIcon />}
                                            size="sm"
                                            onClick={onSettingsOpen}
                                        />
                                    </Tooltip>
                                
                                </Stack>
                            </Stack>
                        </Heading>
                        <Divider my={2} />
                        {isJoined && (
                            <VStack spacing={2}>
                                <Stack direction="row" spacing={2}>
                                    <Text fontSize={{ base: "md", md: "lg" }} color={colorMode === 'light' ? 'gray.600' : 'gray.300'}>
                                        Playing as: {userName}
                                    </Text>
                                     <IconButton
                                        aria-label="Change name"
                                        icon={<EditIcon />}
                                        size="xs"
                                        onClick={() => {
                                            setNewUserName(userName)
                                            onChangeNameOpen()
                                        }}
                                    />
                                </Stack>
                            </VStack>
                        )}
                    </Box>

                    {isJoined && (
                        <Box
                            w="full"
                            p={{ base: 4, md: 8 }}
                            borderRadius="lg"
                            bg={colorMode === 'light' ? 'white' : 'gray.700'}
                            shadow="md"
                        >
                            <VStack spacing={{ base: 4, md: 8 }}>
                                <Wrap spacing={4} justify="center">
                                    {SEQUENCES[settings.sequence].map((value) => (
                                        <WrapItem key={value}>
                                            <Card
                                                value={value}
                                                isSelected={selectedCard === value}
                                                onClick={() => handleCardSelect(value)}
                                                disabled={isRevealed}
                                            />
                                        </WrapItem>
                                    ))}
                                </Wrap>

                                <Stack
                                    direction={{ base: "column", md: "row" }}
                                    spacing={4}
                                    justify="center"
                                    w="full"
                                >
                                    <Button
                                        colorScheme="blue"
                                        onClick={revealVotes}
                                        disabled={isRevealed}
                                        w={{ base: "full", md: "auto" }}
                                    >
                                        Reveal Votes
                                    </Button>
                                    <Button
                                        colorScheme="orange"
                                        onClick={resetVotes}
                                        w={{ base: "full", md: "auto" }}
                                    >
                                        New Round
                                    </Button>
                                </Stack>

                                <Box w="full" overflowX="auto">
                                    <TableContainer>
                                        <Table variant="simple" size={{ base: "sm", md: "md" }}>
                                            <Thead>
                                                <Tr>
                                                    <Th>Participant</Th>
                                                    <Th>Status</Th>
                                                    {isRevealed && <Th>Vote</Th>}
                                                </Tr>
                                            </Thead>
                                            <Tbody>
                                                {participants.map((participant) => (
                                                    <Tr key={participant.id}>
                                                        <Td>{participant.name}</Td>
                                                        <Td>
                                                            <Badge
                                                                colorScheme={participant.vote ? 'green' : 'yellow'}
                                                            >
                                                                {participant.vote ? 'Voted' : 'Not Voted'}
                                                            </Badge>
                                                        </Td>
                                                        {isRevealed && (
                                                            <Td>
                                                                <Text
                                                                    color={getVoteColor(participant.vote)}
                                                                    fontWeight="bold"
                                                                >
                                                                    {participant.vote || 'No vote'}
                                                                </Text>
                                                            </Td>
                                                        )}
                                                    </Tr>
                                                ))}
                                            </Tbody>
                                        </Table>
                                    </TableContainer>
                                    {isRevealed && (
                                        <Text mt={4} fontWeight="bold" textAlign={{ base: "center", md: "left" }}>
                                            Average (excluding '?'): {calculateAverage().toFixed(1)}
                                        </Text>
                                    )}
                                </Box>
                            </VStack>
                        </Box>
                    )}
                </VStack>

                <JoinRoomModal
                    isOpen={showJoinModal && !isJoined}
                    userName={userName}
                    roomPassword={roomPassword}
                    showPassword={showPassword}
                    isPasswordProtected={isPasswordProtected}
                    onUserNameChange={setUserName}
                    onPasswordChange={setRoomPassword}
                    onTogglePassword={() => setShowPassword(!showPassword)}
                    onJoin={handleJoinRoom}
                />

                <ChangeNameModal
                    isOpen={isChangeNameOpen}
                    newUserName={newUserName}
                    onClose={onChangeNameClose}
                    onNameChange={setNewUserName}
                    onSave={handleChangeName}
                />

                <RoomSettingsModal
                    isOpen={isSettingsOpen}
                    onClose={onSettingsClose}
                    currentSequence={settings.sequence}
                    newSettings={newSettings}
                    showPassword={showPassword}
                    onTogglePassword={() => setShowPassword(!showPassword)}
                    onSettingsChange={setNewSettings}
                    onSave={handleUpdateSettings}
                />
            </Box>
        </PageContainer>
    )
}

export default PlanningPokerRoom
