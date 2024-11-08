import { FC, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    Box,
    Heading,
    Button,
    VStack,
    Table,
    Thead,
    Tbody,
    Tr,
    Th,
    Td,
    useColorMode,
    useToast,
    TableContainer,
    Center,
    HStack,
    Modal,
    ModalOverlay,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
    Input,
    Select,
    FormControl,
    FormLabel,
    useDisclosure,
    Divider
} from '@chakra-ui/react'
import PageContainer from '../components/PageContainer'
import PageHelmet from '../components/PageHelmet'
import SeoText from '../components/SeoText'
import { planningPokerSeoSections } from '../content/planningPokerSeo'
import { SEQUENCE_LABELS, SequenceType } from '../constants/poker'
import config from '../config'

interface Room {
    id: string
    name: string
    participantCount: number
    createdAt: string
    hasPassword: boolean
    sequence: string
}

interface CreateRoomSettings {
    password?: string
    sequence: SequenceType
}

const PlanningPoker: FC = () => {
    const [showRoomList, setShowRoomList] = useState(false)
    const [activeRooms, setActiveRooms] = useState<Room[]>([])
    const { colorMode } = useColorMode()
    const navigate = useNavigate()
    const toast = useToast()
    const { isOpen: isCreateModalOpen, onOpen: onCreateModalOpen, onClose: onCreateModalClose } = useDisclosure()
    const [createSettings, setCreateSettings] = useState<CreateRoomSettings>({
        sequence: 'fibonacci'
    })

    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        "name": "Planning Poker - Online Estimation Tool",
        "applicationCategory": "BusinessApplication",
        "operatingSystem": "Any",
        "description": "Free online Planning Poker tool for agile teams. Real-time story point estimation with your team. No registration required.",
        "offers": {
            "@type": "Offer",
            "price": "0",
            "priceCurrency": "USD"
        },
        "featureList": [
            "Real-time team collaboration",
            "Multiple estimation sequences",
            "Password-protected rooms",
            "Instant voting results",
            "No registration required"
        ]
    }

    useEffect(() => {
        fetch(`${config.apiUrl}/rooms`)
            .then(res => res.json())
            .then(setActiveRooms)
            .catch(console.error)
    }, [])

    const handleCreateRoom = async () => {
        const newRoomId = Math.random().toString(36).substring(2, 8)
        try {
            const response = await fetch(`${config.apiUrl}/rooms`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    roomId: newRoomId,
                    ...createSettings
                }),
            })

            if (response.ok) {
                onCreateModalClose()
                navigate(`/planning-poker/${newRoomId}`)
            } else {
                throw new Error('Failed to create room')
            }
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to create new room',
                status: 'error',
                duration: 2000,
            })
        }
    }

    const handleJoinRoom = (roomId: string) => {
        navigate(`/planning-poker/${roomId}`)
    }

    return (
        <PageContainer>
            <PageHelmet
                title="Planning Poker - Free Online Estimation Tool for Agile Teams"
                description="Free online Planning Poker tool for agile teams. Real-time story point estimation with your team. No registration required. Start estimating user stories instantly."
                keywords="planning poker, scrum poker, agile estimation, story points, team estimation, real-time voting, sprint planning, agile tools, fibonacci sequence"
                canonicalUrl={`${config.siteUrl}/planning-poker`}
                jsonLd={jsonLd}
            />
            <Box bg={colorMode === 'light' ? 'gray.50' : 'gray.900'} minH="calc(100vh - 60px)">
                <VStack spacing={{ base: 4, md: 8 }}>
                    <Box textAlign="center" w="full">
                        <Heading
                            as="h1"
                            size={{ base: "lg", md: "xl" }}
                            mb={4}
                        >
                            Online Planning Poker - Free Story Point Estimation Tool
                        </Heading>
                    </Box>

                    {!showRoomList ? (
                        <Center p={8}>
                            <VStack spacing={4} w={{ base: "full", md: "400px" }}>
                                <Button
                                    colorScheme="blue"
                                    size="lg"
                                    w="full"
                                    onClick={onCreateModalOpen}
                                >
                                    Create New Room
                                </Button>
                                <Button
                                    colorScheme="green"
                                    size="lg"
                                    w="full"
                                    onClick={() => setShowRoomList(true)}
                                >
                                    Join Existing Room
                                </Button>
                            </VStack>
                        </Center>
                    ) : (
                        <Box
                            w="full"
                            p={{ base: 4, md: 8 }}
                            borderRadius="lg"
                            bg={colorMode === 'light' ? 'white' : 'gray.700'}
                            shadow="md"
                        >
                            <VStack spacing={4}>
                                <HStack w="full" justify="space-between">
                                    <Heading size="md">Active Rooms</Heading>
                                    <Button size="sm" onClick={() => setShowRoomList(false)}>
                                        Back
                                    </Button>
                                </HStack>
                                <Box w="full" overflowX="auto">
                                    <TableContainer>
                                        <Table variant="simple" size={{ base: "sm", md: "md" }}>
                                            <Thead>
                                                <Tr>
                                                    <Th>Room ID</Th>
                                                    <Th>Participants</Th>
                                                    <Th>Sequence</Th>
                                                    <Th>Protected</Th>
                                                    <Th>Action</Th>
                                                </Tr>
                                            </Thead>
                                            <Tbody>
                                                {activeRooms.map((room) => (
                                                    <Tr key={room.id}>
                                                        <Td>{room.id}</Td>
                                                        <Td>{room.participantCount}</Td>
                                                        <Td>{room.sequence}</Td>
                                                        <Td>{room.hasPassword ? 'Yes' : 'No'}</Td>
                                                        <Td>
                                                            <Button
                                                                size="sm"
                                                                colorScheme="blue"
                                                                onClick={() => handleJoinRoom(room.id)}
                                                            >
                                                                Join
                                                            </Button>
                                                        </Td>
                                                    </Tr>
                                                ))}
                                            </Tbody>
                                        </Table>
                                    </TableContainer>
                                </Box>
                            </VStack>
                        </Box>
                    )}

                    <Modal isOpen={isCreateModalOpen} onClose={onCreateModalClose}>
                        <ModalOverlay />
                        <ModalContent mx={4}>
                            <ModalHeader>Create Planning Poker Room</ModalHeader>
                            <ModalBody>
                                <VStack spacing={4}>
                                    <FormControl>
                                        <FormLabel>Estimation Sequence</FormLabel>
                                        <Select
                                            value={createSettings.sequence}
                                            onChange={(e) => setCreateSettings(prev => ({
                                                ...prev,
                                                sequence: e.target.value as SequenceType
                                            }))}
                                        >
                                            {Object.entries(SEQUENCE_LABELS).map(([key, label]) => (
                                                <option key={key} value={key}>{label}</option>
                                            ))}
                                        </Select>
                                    </FormControl>
                                    <FormControl>
                                        <FormLabel>Room Password (Optional)</FormLabel>
                                        <Input
                                            type="password"
                                            placeholder="Leave empty for no password"
                                            value={createSettings.password || ''}
                                            onChange={(e) => setCreateSettings(prev => ({
                                                ...prev,
                                                password: e.target.value || undefined
                                            }))}
                                        />
                                    </FormControl>
                                </VStack>
                            </ModalBody>
                            <ModalFooter>
                                <Button variant="ghost" mr={3} onClick={onCreateModalClose}>
                                    Cancel
                                </Button>
                                <Button colorScheme="blue" onClick={handleCreateRoom}>
                                    Create Room
                                </Button>
                            </ModalFooter>
                        </ModalContent>
                    </Modal>

                    <Divider my={8} />

                    <SeoText sections={planningPokerSeoSections} />
                </VStack>
            </Box>
        </PageContainer>
    )
}

export default PlanningPoker
