import { FC, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    Box,
    Heading,
    Button,
    VStack,
    Text,
    useColorMode,
    Center,
    useToast,
    Input,
    Divider
} from '@chakra-ui/react'
import PageContainer from '../components/PageContainer'
import PageHelmet from '../components/PageHelmet'
import SeoText from '../components/SeoText'
import { retroBoardSeoSections } from '../content/retroBoardSeo'
import config from '../config'

const RetroLanding: FC = () => {
    const { colorMode } = useColorMode()
    const navigate = useNavigate()
    const toast = useToast()
    const [joinBoardId, setJoinBoardId] = useState('')

    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        "name": "Sprint Retrospective Board",
        "applicationCategory": "BusinessApplication",
        "operatingSystem": "Any",
        "description": "Free online retrospective board for agile teams. Collaborate with your team to identify what went well and what could be improved. Features include real-time voting, timer control, and card management.",
        "offers": {
            "@type": "Offer",
            "price": "0",
            "priceCurrency": "USD"
        },
        "featureList": [
            "Real-time team collaboration",
            "Three-column retro format",
            "Action item tracking",
            "Card voting system",
            "Timer control",
            "Card visibility toggle",
            "Author name management",
            "No registration required",
            "Instant board sharing",
            "Password protection option"
        ]
    }

    const handleCreateBoard = async () => {
        try {
            const response = await fetch(`${config.apiUrl}/retro`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            })

            if (!response.ok) {
                throw new Error('Failed to create board')
            }

            const data = await response.json()
            navigate(`/retro/${data.boardId}`)
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to create retro board',
                status: 'error',
                duration: 2000,
            })
        }
    }

    const handleJoinBoard = () => {
        if (!joinBoardId.trim()) {
            toast({
                title: 'Error',
                description: 'Please enter a board ID',
                status: 'error',
                duration: 2000,
            })
            return
        }
        navigate(`/retro/${joinBoardId.trim()}`)
    }

    return (
        <PageContainer>
            <PageHelmet
                title="Retro Board - Team Retrospective Tool"
                description="Free online retrospective board for agile teams. Collaborate with your team to identify what went well and what could be improved. Features include real-time voting, timer control, and card management."
                keywords="retro board, retrospective, agile retrospective, team collaboration, sprint retrospective, scrum ceremonies, voting, timer control, card management"
                canonicalUrl={`${config.siteUrl}/retro`}
                jsonLd={jsonLd}
            />
            <Box bg={colorMode === 'light' ? 'gray.50' : 'gray.900'} minH="calc(100vh - 60px)">
                <VStack spacing={{ base: 6, md: 8 }} align="stretch">
                    <Box textAlign="center" mb={{ base: 6, md: 8 }}>
                        <Heading
                            as="h1"
                            size={{ base: "xl", md: "2xl" }}
                            mb={{ base: 3, md: 4 }}
                            px={{ base: 2, md: 0 }}
                        >
                            Sprint Retrospective Board
                        </Heading>
                        <Text
                            fontSize={{ base: "lg", md: "xl" }}
                            color={colorMode === 'light' ? 'gray.600' : 'gray.300'}
                            px={{ base: 2, md: 0 }}
                        >
                            Collaborate with your team to improve your process
                        </Text>
                        <Text
                            fontSize={{ base: "md", md: "lg" }}
                            color={colorMode === 'light' ? 'gray.500' : 'gray.400'}
                            mt={2}
                            px={{ base: 2, md: 0 }}
                        >
                            Features: Real-time voting • Timer control • Card management
                        </Text>
                    </Box>

                    <Center p={8}>
                        <VStack spacing={4} w={{ base: "full", md: "400px" }}>
                            <Button
                                colorScheme="blue"
                                size="lg"
                                w="full"
                                onClick={handleCreateBoard}
                            >
                                Create New Board
                            </Button>
                            <Text textAlign="center">or</Text>
                            <VStack w="full" spacing={2}>
                                <Input
                                    placeholder="Enter board ID"
                                    value={joinBoardId}
                                    onChange={(e) => setJoinBoardId(e.target.value)}
                                    onKeyPress={(e) => {
                                        if (e.key === 'Enter') {
                                            handleJoinBoard()
                                        }
                                    }}
                                />
                                <Button
                                    colorScheme="green"
                                    size="lg"
                                    w="full"
                                    onClick={handleJoinBoard}
                                >
                                    Join Existing Board
                                </Button>
                            </VStack>
                        </VStack>
                    </Center>

                    <Divider my={8} />

                    <SeoText sections={retroBoardSeoSections} />
                </VStack>
            </Box>
        </PageContainer>
    )
}

export default RetroLanding
