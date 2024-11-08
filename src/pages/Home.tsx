import { FC } from 'react'
import { Box, Heading, SimpleGrid, Text, Button, VStack, useColorMode, Container, Stack, List, ListItem, ListIcon } from '@chakra-ui/react'
import { Link as RouterLink } from 'react-router-dom'
import { CheckCircleIcon } from '@chakra-ui/icons'
import PageContainer from '../components/PageContainer'
import PageHelmet from '../components/PageHelmet'

interface FeatureCardProps {
    title: string
    description: string
    link: string
}

const FeatureCard: FC<FeatureCardProps> = ({ title, description, link }) => {
    const { colorMode } = useColorMode()

    return (
        <Box
            p={{ base: 4, md: 6 }}
            borderRadius="lg"
            bg={colorMode === 'light' ? 'white' : 'gray.700'}
            shadow="md"
            _hover={{ transform: 'translateY(-4px)', transition: 'transform 0.2s' }}
            height="full"
        >
            <VStack spacing={4} align="start" height="full">
                <Heading size={{ base: "sm", md: "md" }}>{title}</Heading>
                <Text fontSize={{ base: "sm", md: "md" }}>{description}</Text>
                <Button
                    as={RouterLink}
                    to={link}
                    colorScheme="blue"
                    size={{ base: "sm", md: "md" }}
                    mt="auto"
                    w={{ base: "full", md: "auto" }}
                >
                    Try Now
                </Button>
            </VStack>
        </Box>
    )
}

const Home: FC = () => {
    const { colorMode } = useColorMode()

    return (
        <Box bg={colorMode === 'light' ? 'gray.50' : 'gray.900'} minH="calc(100vh - 60px)">
            <PageHelmet
                title="Free Online Scrum Tools for Agile Teams"
                description="Enhance your agile workflow with our free scrum tools. Planning Poker for story estimation, Daily Standup Timer, and more tools for effective agile ceremonies."
                keywords="scrum tools, agile tools, planning poker online, daily standup timer, sprint planning, agile ceremonies, scrum master tools, agile team tools"
            />
            <PageContainer>
                <VStack spacing={{ base: 6, md: 8 }} align="stretch">
                    <Box textAlign="center" mb={{ base: 6, md: 8 }}>
                        <Heading
                            size={{ base: "xl", md: "2xl" }}
                            mb={{ base: 3, md: 4 }}
                            px={{ base: 2, md: 0 }}
                        >
                            Welcome to Scrum Tools
                        </Heading>
                        <Text
                            fontSize={{ base: "lg", md: "xl" }}
                            color={colorMode === 'light' ? 'gray.600' : 'gray.300'}
                            px={{ base: 2, md: 0 }}
                        >
                            Boost your team's agile workflow with our free scrum tools
                        </Text>
                    </Box>

                    <SimpleGrid
                        columns={{ base: 1, sm: 2, lg: 3 }}
                        spacing={{ base: 4, md: 8 }}
                        mx={{ base: 2, md: 0 }}
                    >
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

                    <Container maxW="container.lg" mt={16}>
                        <Stack spacing={12}>
                            <Box>
                                <Heading as="h2" size="lg" mb={6}>
                                    Free Online Tools for Agile Teams
                                </Heading>
                                <Text fontSize="lg" mb={4}>
                                    Our suite of free online tools helps agile teams run more effective ceremonies and collaborate better, whether working remotely or in person. Built by Scrum practitioners for agile teams, our tools focus on simplicity and ease of use.
                                </Text>
                                <List spacing={3}>
                                    <ListItem>
                                        <ListIcon as={CheckCircleIcon} color="green.500" />
                                        No registration required - start using tools immediately
                                    </ListItem>
                                    <ListItem>
                                        <ListIcon as={CheckCircleIcon} color="green.500" />
                                        Real-time collaboration for distributed teams
                                    </ListItem>
                                    <ListItem>
                                        <ListIcon as={CheckCircleIcon} color="green.500" />
                                        Works on all devices - desktop, tablet, and mobile
                                    </ListItem>
                                </List>
                            </Box>

                            <Box>
                                <Heading as="h2" size="lg" mb={6}>
                                    Planning Poker for Better Estimation
                                </Heading>
                                <Text fontSize="lg" mb={4}>
                                    Our Planning Poker tool helps teams estimate work items more accurately through consensus-based techniques. Using the Fibonacci sequence, team members can independently assess the complexity of user stories before discussing and reaching agreement.
                                </Text>
                                <List spacing={3}>
                                    <ListItem>
                                        <ListIcon as={CheckCircleIcon} color="green.500" />
                                        Real-time voting with instant results
                                    </ListItem>
                                    <ListItem>
                                        <ListIcon as={CheckCircleIcon} color="green.500" />
                                        Visual indicators for consensus and outliers
                                    </ListItem>
                                    <ListItem>
                                        <ListIcon as={CheckCircleIcon} color="green.500" />
                                        Customizable room settings for different team needs
                                    </ListItem>
                                </List>
                            </Box>

                            <Box>
                                <Heading as="h2" size="lg" mb={6}>
                                    Daily Standup Made Simple
                                </Heading>
                                <Text fontSize="lg" mb={4}>
                                    Keep your daily standups efficient and focused with our specialized timer. Designed to help teams stick to the 15-minute timebox while ensuring everyone gets their turn to speak about progress and impediments.
                                </Text>
                                <List spacing={3}>
                                    <ListItem>
                                        <ListIcon as={CheckCircleIcon} color="green.500" />
                                        Configurable time limits per team member
                                    </ListItem>
                                    <ListItem>
                                        <ListIcon as={CheckCircleIcon} color="green.500" />
                                        Visual and audio notifications
                                    </ListItem>
                                    <ListItem>
                                        <ListIcon as={CheckCircleIcon} color="green.500" />
                                        Track meeting duration and participation
                                    </ListItem>
                                </List>
                            </Box>

                            <Box>
                                <Heading as="h2" size="lg" mb={6}>
                                    Why Choose Our Tools?
                                </Heading>
                                <Text fontSize="lg" mb={4}>
                                    Our tools are designed with simplicity and effectiveness in mind. We focus on providing essential features that teams actually need, without the complexity of enterprise tools. Perfect for teams that want to:
                                </Text>
                                <List spacing={3}>
                                    <ListItem>
                                        <ListIcon as={CheckCircleIcon} color="green.500" />
                                        Improve estimation accuracy and team alignment
                                    </ListItem>
                                    <ListItem>
                                        <ListIcon as={CheckCircleIcon} color="green.500" />
                                        Run more efficient and engaging ceremonies
                                    </ListItem>
                                    <ListItem>
                                        <ListIcon as={CheckCircleIcon} color="green.500" />
                                        Foster better team collaboration and communication
                                    </ListItem>
                                    <ListItem>
                                        <ListIcon as={CheckCircleIcon} color="green.500" />
                                        Start using agile practices without complex setup
                                    </ListItem>
                                </List>
                            </Box>
                        </Stack>
                    </Container>
                </VStack>
            </PageContainer>
        </Box>
    )
}

export default Home
