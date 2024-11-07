import { useState, useEffect } from 'react'
import {
    Box,
    Container,
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
    useToast
} from '@chakra-ui/react'
import { AddIcon, DeleteIcon, TimeIcon } from '@chakra-ui/icons'

const DEFAULT_TIME = 120 // 2 minutes in seconds
const WARNING_TIME = 30 // Time in seconds when to show warning color

const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
}

const DailyStandup = () => {
    const [teamMembers, setTeamMembers] = useState([])
    const [newMember, setNewMember] = useState('')
    const [timeLeft, setTimeLeft] = useState(DEFAULT_TIME)
    const [isRunning, setIsRunning] = useState(false)
    const [currentSpeaker, setCurrentSpeaker] = useState(null)
    const { colorMode } = useColorMode()
    const toast = useToast()

    useEffect(() => {
        let timer
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

        return () => clearInterval(timer)
    }, [isRunning, timeLeft, toast])

    const handleAddMember = () => {
        if (newMember.trim()) {
            setTeamMembers([...teamMembers, newMember.trim()])
            setNewMember('')
        }
    }

    const handleRemoveMember = (index) => {
        setTeamMembers(teamMembers.filter((_, i) => i !== index))
    }

    const startTimer = (member) => {
        setCurrentSpeaker(member)
        setTimeLeft(DEFAULT_TIME)
        setIsRunning(true)
    }

    const stopTimer = () => {
        setIsRunning(false)
        setCurrentSpeaker(null)
    }

    const getTimeColor = () => {
        if (timeLeft <= WARNING_TIME) {
            return 'red.500'
        }
        return colorMode === 'light' ? 'blue.500' : 'blue.300'
    }

    return (
        <Box bg={colorMode === 'light' ? 'gray.50' : 'gray.900'} minH="calc(100vh - 60px)">
            <Container maxW="1200px" py={12}>
                <VStack spacing={8}>
                    <Box textAlign="center">
                        <Heading size="xl" mb={4}>
                            Daily Standup Timer
                        </Heading>
                        <Text fontSize="lg" color={colorMode === 'light' ? 'gray.600' : 'gray.300'}>
                            Keep your daily standups focused and time-boxed
                        </Text>
                    </Box>

                    <Box
                        w="full"
                        p={8}
                        borderRadius="lg"
                        bg={colorMode === 'light' ? 'white' : 'gray.700'}
                        shadow="md"
                    >
                        <VStack spacing={6}>
                            <HStack w="full">
                                <Input
                                    placeholder="Add team member"
                                    value={newMember}
                                    onChange={(e) => setNewMember(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && handleAddMember()}
                                />
                                <IconButton
                                    icon={<AddIcon />}
                                    onClick={handleAddMember}
                                    colorScheme="blue"
                                    aria-label="Add team member"
                                />
                            </HStack>

                            <List spacing={3} w="full">
                                {teamMembers.map((member, index) => (
                                    <ListItem
                                        key={index}
                                        p={3}
                                        borderRadius="md"
                                        bg={currentSpeaker === member ? 'blue.100' : 'transparent'}
                                        color={currentSpeaker === member ? 'blue.800' : 'inherit'}
                                    >
                                        <HStack justify="space-between">
                                            <Text>{member}</Text>
                                            <HStack>
                                                <IconButton
                                                    icon={<TimeIcon />}
                                                    onClick={() => startTimer(member)}
                                                    colorScheme="green"
                                                    size="sm"
                                                    aria-label="Start timer"
                                                    isDisabled={isRunning}
                                                />
                                                <IconButton
                                                    icon={<DeleteIcon />}
                                                    onClick={() => handleRemoveMember(index)}
                                                    colorScheme="red"
                                                    size="sm"
                                                    aria-label="Remove member"
                                                />
                                            </HStack>
                                        </HStack>
                                    </ListItem>
                                ))}
                            </List>

                            {currentSpeaker && (
                                <VStack spacing={4}>
                                    <Text fontSize="2xl" fontWeight="bold" color={getTimeColor()}>
                                        {formatTime(timeLeft)}
                                    </Text>
                                    <Text>
                                        Current Speaker: <strong>{currentSpeaker}</strong>
                                    </Text>
                                    <Button
                                        colorScheme="red"
                                        onClick={stopTimer}
                                        isDisabled={!isRunning}
                                    >
                                        Stop Timer
                                    </Button>
                                </VStack>
                            )}

                            {teamMembers.length === 0 && (
                                <Text color={colorMode === 'light' ? 'gray.500' : 'gray.400'}>
                                    Add team members to get started
                                </Text>
                            )}
                        </VStack>
                    </Box>
                </VStack>
            </Container>
        </Box>
    )
}

export default DailyStandup
