import { FC, useState, useEffect } from 'react'
import {
    Box,
    Heading,
    Text,
    VStack,
    Button,
    HStack,
    Input,
    List,
    ListItem,
    IconButton,
    useColorMode,
    useToast,
    Stack
} from '@chakra-ui/react'
import { AddIcon, DeleteIcon, TimeIcon } from '@chakra-ui/icons'
import PageContainer from '../components/PageContainer'

const DEFAULT_TIME: number = 120 // 2 minutes in seconds
const WARNING_TIME: number = 30 // Time in seconds when to show warning color

const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
}

const DailyStandup: FC = () => {
    const [teamMembers, setTeamMembers] = useState<string[]>([])
    const [newMember, setNewMember] = useState<string>('')
    const [timeLeft, setTimeLeft] = useState<number>(DEFAULT_TIME)
    const [isRunning, setIsRunning] = useState<boolean>(false)
    const [currentSpeaker, setCurrentSpeaker] = useState<string | null>(null)
    const { colorMode } = useColorMode()
    const toast = useToast()

    useEffect(() => {
        let timer: NodeJS.Timeout | undefined
        if (isRunning && timeLeft > 0) {
            timer = setInterval(() => {
                setTimeLeft((prev) => prev - 1)
            }, 1000)
        } else if (timeLeft === 0 && isRunning) {
            setIsRunning(false)
            toast({
                title: 'Time\'s up!',
                description: 'Move on to the next team member',
                status: 'warning',
                duration: 3000,
                isClosable: true,
            })
        }

        return () => {
            if (timer) clearInterval(timer)
        }
    }, [isRunning, timeLeft, toast])

    const handleAddMember = (): void => {
        if (newMember.trim()) {
            setTeamMembers([...teamMembers, newMember.trim()])
            setNewMember('')
        }
    }

    const handleRemoveMember = (index: number): void => {
        setTeamMembers(teamMembers.filter((_, i) => i !== index))
    }

    const startTimer = (member: string): void => {
        setCurrentSpeaker(member)
        setTimeLeft(DEFAULT_TIME)
        setIsRunning(true)
    }

    const stopTimer = (): void => {
        setIsRunning(false)
        setCurrentSpeaker(null)
    }

    const getTimeColor = (): string => {
        if (timeLeft <= WARNING_TIME) {
            return 'red.500'
        }
        return colorMode === 'light' ? 'blue.500' : 'blue.300'
    }

    return (
        <Box bg={colorMode === 'light' ? 'gray.50' : 'gray.900'} minH="calc(100vh - 60px)">
            <PageContainer>
                <VStack spacing={{ base: 6, md: 8 }}>
                    <Box textAlign="center">
                        <Heading size={{ base: "lg", md: "xl" }} mb={{ base: 3, md: 4 }}>
                            Daily Standup Timer
                        </Heading>
                        <Text
                            fontSize={{ base: "md", md: "lg" }}
                            color={colorMode === 'light' ? 'gray.600' : 'gray.300'}
                            px={{ base: 2, md: 0 }}
                        >
                            Keep your daily standups focused and time-boxed
                        </Text>
                    </Box>

                    <Box
                        w="full"
                        p={{ base: 4, md: 8 }}
                        borderRadius="lg"
                        bg={colorMode === 'light' ? 'white' : 'gray.700'}
                        shadow="md"
                    >
                        <VStack spacing={{ base: 4, md: 6 }}>
                            <Stack
                                w="full"
                                direction={{ base: "column", md: "row" }}
                                spacing={{ base: 2, md: 4 }}
                            >
                                <Input
                                    placeholder="Add team member"
                                    value={newMember}
                                    onChange={(e) => setNewMember(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && handleAddMember()}
                                    size={{ base: "md", md: "md" }}
                                />
                                <IconButton
                                    icon={<AddIcon />}
                                    onClick={handleAddMember}
                                    colorScheme="blue"
                                    aria-label="Add team member"
                                    size={{ base: "md", md: "md" }}
                                    w={{ base: "full", md: "auto" }}
                                />
                            </Stack>

                            <List spacing={{ base: 2, md: 3 }} w="full">
                                {teamMembers.map((member, index) => (
                                    <ListItem
                                        key={index}
                                        p={{ base: 2, md: 3 }}
                                        borderRadius="md"
                                        bg={currentSpeaker === member ? 'blue.100' : 'transparent'}
                                        color={currentSpeaker === member ? 'blue.800' : 'inherit'}
                                    >
                                        <Stack
                                            direction={{ base: "column", md: "row" }}
                                            justify="space-between"
                                            align={{ base: "stretch", md: "center" }}
                                            spacing={{ base: 2, md: 0 }}
                                        >
                                            <Text
                                                fontSize={{ base: "md", md: "md" }}
                                                textAlign={{ base: "center", md: "left" }}
                                            >
                                                {member}
                                            </Text>
                                            <Stack
                                                direction="row"
                                                justify={{ base: "center", md: "flex-end" }}
                                                spacing={2}
                                            >
                                                <IconButton
                                                    icon={<TimeIcon />}
                                                    onClick={() => startTimer(member)}
                                                    colorScheme="green"
                                                    size={{ base: "md", md: "sm" }}
                                                    aria-label="Start timer"
                                                    isDisabled={isRunning}
                                                />
                                                <IconButton
                                                    icon={<DeleteIcon />}
                                                    onClick={() => handleRemoveMember(index)}
                                                    colorScheme="red"
                                                    size={{ base: "md", md: "sm" }}
                                                    aria-label="Remove member"
                                                />
                                            </Stack>
                                        </Stack>
                                    </ListItem>
                                ))}
                            </List>

                            {currentSpeaker && (
                                <VStack spacing={{ base: 3, md: 4 }}>
                                    <Text
                                        fontSize={{ base: "xl", md: "2xl" }}
                                        fontWeight="bold"
                                        color={getTimeColor()}
                                    >
                                        {formatTime(timeLeft)}
                                    </Text>
                                    <Text fontSize={{ base: "md", md: "lg" }}>
                                        Current Speaker: <strong>{currentSpeaker}</strong>
                                    </Text>
                                    <Button
                                        colorScheme="red"
                                        onClick={stopTimer}
                                        isDisabled={!isRunning}
                                        size={{ base: "md", md: "md" }}
                                        w={{ base: "full", md: "auto" }}
                                    >
                                        Stop Timer
                                    </Button>
                                </VStack>
                            )}

                            {teamMembers.length === 0 && (
                                <Text
                                    color={colorMode === 'light' ? 'gray.500' : 'gray.400'}
                                    fontSize={{ base: "sm", md: "md" }}
                                    textAlign="center"
                                >
                                    Add team members to get started
                                </Text>
                            )}
                        </VStack>
                    </Box>
                </VStack>
            </PageContainer>
        </Box>
    )
}

export default DailyStandup
