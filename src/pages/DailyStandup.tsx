import { FC, useState } from 'react'
import {
    Box,
    Container,
    Heading,
    VStack,
    Button,
    Text,
    useColorMode,
    HStack,
    IconButton,
    List,
    ListItem,
    Divider,
    useToast,
    useDisclosure,
} from '@chakra-ui/react'
import { AddIcon, DeleteIcon, RepeatIcon } from '@chakra-ui/icons'
import PageContainer from '../components/PageContainer'
import PageHelmet from '../components/PageHelmet'
import SeoText from '../components/SeoText'
import { AddTeamMemberModal } from '../components/modals'
import { dailyStandupSeo, dailyStandupSeoSections } from '../content/dailyStandupSeo'
import config from '../config'

interface TeamMember {
    id: string
    name: string
    timeLeft: number
}

const MEMBER_TIME = 120 // 2 minutes in seconds

const DailyStandup: FC = () => {
    const { colorMode } = useColorMode()
    const toast = useToast()
    const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
    const [currentMember, setCurrentMember] = useState<number>(-1)
    const [isRunning, setIsRunning] = useState(false)
    const [intervalId, setIntervalId] = useState<number | null>(null)
    const { isOpen: isAddMemberOpen, onOpen: onAddMemberOpen, onClose: onAddMemberClose } = useDisclosure()

    const addMember = (name: string) => {
        setTeamMembers([
            ...teamMembers,
            { id: Math.random().toString(), name, timeLeft: MEMBER_TIME }
        ])
    }

    const removeMember = (id: string) => {
        setTeamMembers(teamMembers.filter(member => member.id !== id))
        if (currentMember >= teamMembers.length - 1) {
            setCurrentMember(-1)
        }
    }

    const resetTimer = () => {
        setTeamMembers(teamMembers.map(member => ({ ...member, timeLeft: MEMBER_TIME })))
        setCurrentMember(-1)
        setIsRunning(false)
        if (intervalId) {
            clearInterval(intervalId)
            setIntervalId(null)
        }
    }

    const startTimer = () => {
        if (teamMembers.length === 0) {
            toast({
                title: 'No team members',
                description: 'Please add team members first',
                status: 'warning',
                duration: 3000,
            })
            return
        }

        setIsRunning(true)
        setCurrentMember(prev => (prev === -1 ? 0 : prev))

        const id = window.setInterval(() => {
            setTeamMembers(prevMembers => {
                const newMembers = [...prevMembers]
                const currentMemberIndex = currentMember === -1 ? 0 : currentMember

                if (newMembers[currentMemberIndex].timeLeft > 0) {
                    newMembers[currentMemberIndex] = {
                        ...newMembers[currentMemberIndex],
                        timeLeft: newMembers[currentMemberIndex].timeLeft - 1
                    }
                } else {
                    // Play sound when time is up
                    const audio = new Audio('/timer-end.mp3')
                    audio.play()

                    // Move to next member
                    if (currentMemberIndex < teamMembers.length - 1) {
                        setCurrentMember(currentMemberIndex + 1)
                    } else {
                        clearInterval(id)
                        setIsRunning(false)
                        setIntervalId(null)
                        setCurrentMember(-1)
                    }
                }
                return newMembers
            })
        }, 1000)

        setIntervalId(id)
    }

    const pauseTimer = () => {
        if (intervalId) {
            clearInterval(intervalId)
            setIntervalId(null)
        }
        setIsRunning(false)
    }

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60)
        const secs = seconds % 60
        return `${mins}:${secs.toString().padStart(2, '0')}`
    }

    const getTotalTime = () => {
        const totalSeconds = teamMembers.reduce((acc, member) => acc + member.timeLeft, 0)
        return formatTime(totalSeconds)
    }

    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "WebApplication",
        "name": "Daily Standup Timer",
        "applicationCategory": "BusinessApplication",
        "operatingSystem": "Any",
        "description": dailyStandupSeo.description,
        "offers": {
            "@type": "Offer",
            "price": "0",
            "priceCurrency": "USD"
        },
        "featureList": dailyStandupSeo.content.features
    }

    return (
        <PageContainer>
            <PageHelmet
                title={dailyStandupSeo.title}
                description={dailyStandupSeo.description}
                keywords={dailyStandupSeo.keywords}
                canonicalUrl={`${config.siteUrl}/daily-standup`}
                jsonLd={jsonLd}
            />
            <Container maxW="container.xl" py={8}>
                <VStack spacing={8} align="stretch">
                    <VStack spacing={4} align="center" textAlign="center">
                        <Heading as="h1" size="xl">
                            {dailyStandupSeo.content.heading}
                        </Heading>
                        <Text fontSize="lg" color="gray.600">
                            {dailyStandupSeo.content.subheading}
                        </Text>
                    </VStack>

                    <Box
                        p={6}
                        borderRadius="lg"
                        bg={colorMode === 'light' ? 'white' : 'gray.700'}
                        shadow="md"
                    >
                        <VStack spacing={6}>
                            <HStack spacing={4}>
                                <Button
                                    leftIcon={<AddIcon />}
                                    colorScheme="blue"
                                    onClick={onAddMemberOpen}
                                >
                                    Add Member
                                </Button>
                                <Button
                                    leftIcon={<RepeatIcon />}
                                    colorScheme="gray"
                                    onClick={resetTimer}
                                >
                                    Reset
                                </Button>
                            </HStack>

                            <List spacing={3} width="100%">
                                {teamMembers.map((member, index) => (
                                    <ListItem
                                        key={member.id}
                                        p={3}
                                        borderRadius="md"
                                        bg={index === currentMember ? 'blue.500' : undefined}
                                        color={index === currentMember ? 'white' : undefined}
                                    >
                                        <HStack justify="space-between">
                                            <Text>{member.name}</Text>
                                            <HStack>
                                                <Text>{formatTime(member.timeLeft)}</Text>
                                                <IconButton
                                                    aria-label="Remove member"
                                                    icon={<DeleteIcon />}
                                                    size="sm"
                                                    colorScheme="red"
                                                    variant="ghost"
                                                    onClick={() => removeMember(member.id)}
                                                />
                                            </HStack>
                                        </HStack>
                                    </ListItem>
                                ))}
                            </List>

                            {teamMembers.length > 0 && (
                                <HStack justify="space-between" width="100%">
                                    <Text>Total Time: {getTotalTime()}</Text>
                                    <Button
                                        colorScheme={isRunning ? 'orange' : 'green'}
                                        onClick={isRunning ? pauseTimer : startTimer}
                                    >
                                        {isRunning ? 'Pause' : 'Start'}
                                    </Button>
                                </HStack>
                            )}
                        </VStack>
                    </Box>

                    <Divider my={8} />

                    <SeoText sections={dailyStandupSeoSections} />
                </VStack>
            </Container>

            <AddTeamMemberModal
                isOpen={isAddMemberOpen}
                onClose={onAddMemberClose}
                onSubmit={addMember}
            />
        </PageContainer>
    )
}

export default DailyStandup
