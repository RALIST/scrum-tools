import { Box, Container, Heading, SimpleGrid, Text, Button, VStack, useColorMode } from '@chakra-ui/react'
import { Link as RouterLink } from 'react-router-dom'

const FeatureCard = ({ title, description, link }) => {
    const { colorMode } = useColorMode()

    return (
        <Box
            p={6}
            borderRadius="lg"
            bg={colorMode === 'light' ? 'white' : 'gray.700'}
            shadow="md"
            _hover={{ transform: 'translateY(-4px)', transition: 'transform 0.2s' }}
        >
            <VStack spacing={4} align="start">
                <Heading size="md">{title}</Heading>
                <Text>{description}</Text>
                <Button as={RouterLink} to={link} colorScheme="blue">
                    Try Now
                </Button>
            </VStack>
        </Box>
    )
}

const Home = () => {
    const { colorMode } = useColorMode()

    return (
        <Box bg={colorMode === 'light' ? 'gray.50' : 'gray.900'} minH="calc(100vh - 60px)">
            <Container maxW="1200px" py={12}>
                <VStack spacing={8} align="stretch">
                    <Box textAlign="center" mb={8}>
                        <Heading size="2xl" mb={4}>
                            Welcome to Scrum Tools
                        </Heading>
                        <Text fontSize="xl" color={colorMode === 'light' ? 'gray.600' : 'gray.300'}>
                            Boost your team's agile workflow with our free scrum tools
                        </Text>
                    </Box>

                    <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={8}>
                        <FeatureCard
                            title="Planning Poker"
                            description="Estimate user stories efficiently with your team using our real-time planning poker tool."
                            link="/planning-poker"
                        />
                        <FeatureCard
                            title="Daily Standup Timer"
                            description="Keep your daily standups focused and time-boxed with our specialized timer."
                            link="/daily-standup"
                        />
                        <FeatureCard
                            title="Coming Soon: Sprint Timer"
                            description="Track your sprint progress with our customizable sprint timer."
                            link="/"
                        />
                        <FeatureCard
                            title="Coming Soon: Retro Board"
                            description="Conduct effective retrospectives with our digital retrospective board."
                            link="/"
                        />
                        <FeatureCard
                            title="Coming Soon: Team Velocity"
                            description="Track and visualize your team's velocity over time."
                            link="/"
                        />
                        <FeatureCard
                            title="Coming Soon: Health Check"
                            description="Monitor your team's health and satisfaction with anonymous feedback."
                            link="/"
                        />
                    </SimpleGrid>
                </VStack>
            </Container>
        </Box>
    )
}

export default Home
