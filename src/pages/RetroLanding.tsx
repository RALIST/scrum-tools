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
    Modal,
    ModalOverlay,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
    FormControl,
    FormLabel,
    useDisclosure,
    Divider
} from '@chakra-ui/react'
import PageContainer from '../components/PageContainer'
import PageHelmet from '../components/PageHelmet'
import SeoText from '../components/SeoText'
import { retroBoardSeoSections } from '../content/retroBoardSeo'

const SOCKET_URL = `https://${window.location.hostname}`

const RetroLanding: FC = () => {
    const { colorMode } = useColorMode()
    const navigate = useNavigate()
    const toast = useToast()
    const { isOpen, onOpen, onClose } = useDisclosure()
    const [boardName, setBoardName] = useState('')
    const [joinBoardId, setJoinBoardId] = useState('')

    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        "name": "Sprint Retrospective Board",
        "applicationCategory": "BusinessApplication",
        "operatingSystem": "Any",
        "description": "Free online retrospective board for agile teams. Collaborate with your team to identify what went well and what could be improved.",
        "offers": {
            "@type": "Offer",
            "price": "0",
            "priceCurrency": "USD"
        },
        "featureList": [
            "Real-time team collaboration",
            "Three-column retro format",
            "Action item tracking",
            "No registration required",
            "Instant board sharing"
        ]
    }

    const handleCreateBoard = async () => {
        try {
            const response = await fetch(`${SOCKET_URL}/api/retro`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: boardName || 'Sprint Retrospective'
                }),
            })

            if (!response.ok) {
                throw new Error('Failed to create board')
            }

            const data = await response.json()
            onClose()
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
                description="Free online retrospective board for agile teams. Collaborate with your team to identify what went well and what could be improved."
                keywords="retro board, retrospective, agile retrospective, team collaboration, sprint retrospective, scrum ceremonies"
                canonicalUrl="https://scrumtools.app/retro"
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
                    </Box>

                    <Center p={8}>
                        <VStack spacing={4} w={{ base: "full", md: "400px" }}>
                            <Button
                                colorScheme="blue"
                                size="lg"
                                w="full"
                                onClick={onOpen}
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

                <Modal isOpen={isOpen} onClose={onClose}>
                    <ModalOverlay />
                    <ModalContent mx={4}>
                        <ModalHeader>Create Retro Board</ModalHeader>
                        <ModalBody>
                            <FormControl>
                                <FormLabel>Board Name (Optional)</FormLabel>
                                <Input
                                    placeholder="Sprint Retrospective"
                                    value={boardName}
                                    onChange={(e) => setBoardName(e.target.value)}
                                />
                            </FormControl>
                        </ModalBody>
                        <ModalFooter>
                            <Button variant="ghost" mr={3} onClick={onClose}>
                                Cancel
                            </Button>
                            <Button colorScheme="blue" onClick={handleCreateBoard}>
                                Create Board
                            </Button>
                        </ModalFooter>
                    </ModalContent>
                </Modal>
            </Box>
        </PageContainer>
    )
}

export default RetroLanding
