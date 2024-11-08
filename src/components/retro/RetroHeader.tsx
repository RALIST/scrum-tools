import { FC } from 'react'
import {
    Box,
    Heading,
    VStack,
    Text,
    Button,
    IconButton,
    HStack,
    Badge,
    Divider,
    useColorMode,
    Tooltip
} from '@chakra-ui/react'
import { ViewIcon, ViewOffIcon, TimeIcon, SettingsIcon, EditIcon } from '@chakra-ui/icons'

interface RetroHeaderProps {
    boardName: string
    userName: string
    isTimerRunning: boolean
    timeLeft: number
    hideCards: boolean
    onToggleCards: () => void
    onToggleTimer: () => void
    onOpenSettings: () => void
    onChangeName: () => void
}

const RetroHeader: FC<RetroHeaderProps> = ({
    boardName,
    userName,
    isTimerRunning,
    timeLeft,
    hideCards,
    onToggleCards,
    onToggleTimer,
    onOpenSettings,
    onChangeName
}) => {
    const { colorMode } = useColorMode()

    const formatTime = (seconds: number) => {
        const minutes = Math.floor(seconds / 60)
        const remainingSeconds = seconds % 60
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
    }

    return (
        <Box textAlign="center">
            <VStack spacing={4}>
                <Heading as="h1" size="xl">
                    {boardName}
                </Heading>
                <HStack justify="center" spacing={4}>
                    <Tooltip label={hideCards ? "Show Cards" : "Hide Cards"}>
                        <IconButton
                            aria-label={hideCards ? "Show Cards" : "Hide Cards"}
                            icon={hideCards ? <ViewIcon /> : <ViewOffIcon />}
                            onClick={onToggleCards}
                            colorScheme={hideCards ? "green" : "gray"}
                            size="sm"
                        />
                    </Tooltip>
                    <Button
                        leftIcon={<TimeIcon />}
                        onClick={onToggleTimer}
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
                        onClick={onOpenSettings}
                        size="sm"
                    />
                </HStack>
                <Divider />
                <Text fontSize="lg" color={colorMode === 'light' ? 'gray.600' : 'gray.300'}>
                    Share your thoughts about the sprint
                </Text>
                <HStack justify="center">
                    <Text>Your name: {userName}</Text>
                    <IconButton
                        aria-label="Change name"
                        icon={<EditIcon />}
                        size="sm"
                        onClick={onChangeName}
                    />
                </HStack>
            </VStack>
        </Box>
    )
}

export default RetroHeader
