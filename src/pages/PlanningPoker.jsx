import { useState } from 'react'
import {
    Box,
    Container,
    Heading,
    SimpleGrid,
    Button,
    Text,
    VStack,
    HStack,
    useColorMode,
    useToast
} from '@chakra-ui/react'

const FIBONACCI_SEQUENCE = ['1', '2', '3', '5', '8', '13', '21', '?']

const Card = ({ value, isSelected, onClick }) => {
    const { colorMode } = useColorMode()

    return (
        <Button
            h="120px"
            w="80px"
            fontSize="2xl"
            variant="outline"
            colorScheme={isSelected ? 'blue' : 'gray'}
            bg={isSelected ? (colorMode === 'light' ? 'blue.50' : 'blue.900') : 'transparent'}
            onClick={onClick}
            _hover={{
                transform: 'translateY(-4px)',
                transition: 'transform 0.2s'
            }}
        >
            {value}
        </Button>
    )
}

const PlanningPoker = () => {
    const [selectedCard, setSelectedCard] = useState(null)
    const { colorMode } = useColorMode()
    const toast = useToast()

    const handleCardSelect = (value) => {
        setSelectedCard(value)
        toast({
            title: 'Vote Recorded',
            description: `You selected ${value} points`,
            status: 'success',
            duration: 2000,
            isClosable: true,
        })
    }

    return (
        <Box bg={colorMode === 'light' ? 'gray.50' : 'gray.900'} minH="calc(100vh - 60px)">
            <Container maxW="1200px" py={12}>
                <VStack spacing={8}>
                    <Box textAlign="center">
                        <Heading size="xl" mb={4}>
                            Planning Poker
                        </Heading>
                        <Text fontSize="lg" color={colorMode === 'light' ? 'gray.600' : 'gray.300'}>
                            Select a card to estimate the story points
                        </Text>
                    </Box>

                    <Box
                        w="full"
                        p={8}
                        borderRadius="lg"
                        bg={colorMode === 'light' ? 'white' : 'gray.700'}
                        shadow="md"
                    >
                        <VStack spacing={8}>
                            <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4}>
                                {FIBONACCI_SEQUENCE.map((value) => (
                                    <Card
                                        key={value}
                                        value={value}
                                        isSelected={selectedCard === value}
                                        onClick={() => handleCardSelect(value)}
                                    />
                                ))}
                            </SimpleGrid>

                            <HStack spacing={4}>
                                <Text fontSize="lg">
                                    Your vote: <strong>{selectedCard || 'Not voted'}</strong>
                                </Text>
                                {selectedCard && (
                                    <Button
                                        colorScheme="red"
                                        variant="ghost"
                                        onClick={() => setSelectedCard(null)}
                                    >
                                        Clear Vote
                                    </Button>
                                )}
                            </HStack>
                        </VStack>
                    </Box>

                    <Box textAlign="center">
                        <Text color={colorMode === 'light' ? 'gray.600' : 'gray.400'}>
                            Coming soon: Create rooms and vote in real-time with your team!
                        </Text>
                    </Box>
                </VStack>
            </Container>
        </Box>
    )
}

export default PlanningPoker
