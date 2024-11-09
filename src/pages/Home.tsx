import { FC } from 'react'
import { Box, Heading, SimpleGrid, Text, Button, VStack, useColorMode } from '@chakra-ui/react'
import { Link as RouterLink } from 'react-router-dom'
import PageContainer from '../components/PageContainer'
import PageHelmet from '../components/PageHelmet'
import SeoText from '../components/SeoText'
import { homeSeoSections } from '../content/homeSeo'

interface FeatureCardProps {
    title: string
    description: string
    link: string
    isComingSoon?: boolean
}

const FeatureCard: FC<FeatureCardProps> = ({ title, description, link, isComingSoon }) => {
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
                <Heading size={{ base: "sm", md: "md" }}>
                    {isComingSoon ? `Coming Soon: ${title}` : title}
                </Heading>
                <Text fontSize={{ base: "sm", md: "md" }}>{description}</Text>
                <Button
                    as={RouterLink}
                    to={link}
                    colorScheme="blue"
                    size={{ base: "sm", md: "md" }}
                    mt="auto"
                    w={{ base: "full", md: "auto" }}
                    isDisabled={isComingSoon}
                >
                    Try Now
                </Button>
            </VStack>
        </Box>
    )
}

const Home: FC = () => {
    const { colorMode } = useColorMode()

    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "WebApplication",
        "name": "Scrum Tools",
        "description": "Free online tools for agile teams including Planning Poker, Daily Standup Timer, Retrospective Board, and Team Velocity Tracker. Boost your team's productivity with our simple, effective Scrum tools.",
        "applicationCategory": "ProjectManagementApplication",
        "operatingSystem": "Any",
        "offers": {
            "@type": "Offer",
            "price": "0",
            "priceCurrency": "USD"
        },
        "featureList": [
            "Real-time Planning Poker with customizable voting sequences",
            "Daily Standup Timer with configurable time slots",
            "Retrospective Board with real-time collaboration",
            "Team Velocity Tracker with analytics",
            "Password-protected team data",
            "Dark/Light theme support",
            "Mobile-responsive design"
        ],
        "screenshot": `${window.location.origin}/og-image.svg`,
        "url": "https://scrumtools.app"
    }

    return (
        <Box bg={colorMode === 'light' ? 'gray.50' : 'gray.900'} minH="calc(100vh - 60px)">
            <PageHelmet
                title="Scrum Tools - Free Online Tools for Agile Teams"
                description="Free online tools for agile teams including Planning Poker, Daily Standup Timer, Retrospective Board, and Team Velocity Tracker. Real-time collaboration, password protection, and mobile support included."
                keywords="scrum tools, agile tools, planning poker, daily standup, retrospective board, team velocity, sprint tracking, agile ceremonies, scrum ceremonies, team collaboration, real-time collaboration, password protection"
                canonicalUrl="https://scrumtools.app"
                jsonLd={jsonLd}
            />
            <PageContainer>
                <VStack spacing={{ base: 6, md: 8 }} align="stretch">
                    <Box textAlign="center" mb={{ base: 6, md: 8 }}>
                        <Heading
                            as="h1"
                            size={{ base: "xl", md: "2xl" }}
                            mb={{ base: 3, md: 4 }}
                            px={{ base: 2, md: 0 }}
                        >
                            Free Online Scrum Tools for Agile Teams
                        </Heading>
                        <Text
                            fontSize={{ base: "lg", md: "xl" }}
                            color={colorMode === 'light' ? 'gray.600' : 'gray.300'}
                            px={{ base: 2, md: 0 }}
                        >
                            Boost your team's agile workflow with our secure, real-time collaboration tools
                        </Text>
                    </Box>

                    <SimpleGrid
                        columns={{ base: 1, sm: 2, lg: 3 }}
                        spacing={{ base: 4, md: 8 }}
                        mx={{ base: 2, md: 0 }}
                    >
                        <FeatureCard
                            title="Planning Poker"
                            description="Estimate user stories efficiently with real-time voting and customizable sequences."
                            link="/planning-poker"
                        />
                        <FeatureCard
                            title="Daily Standup Timer"
                            description="Keep your daily standups focused with configurable timers and notifications."
                            link="/daily-standup"
                        />
                        <FeatureCard
                            title="Retro Board"
                            description="Conduct effective retrospectives with real-time collaboration and voting."
                            link="/retro"
                        />
                        <FeatureCard
                            title="Team Velocity"
                            description="Track and analyze your team's velocity with interactive charts and statistics."
                            link="/velocity"
                        />
                        <FeatureCard
                            title="Sprint Timer"
                            description="Track your sprint progress with our customizable sprint timer."
                            link="/"
                            isComingSoon
                        />
                        <FeatureCard
                            title="Health Check"
                            description="Monitor your team's health and satisfaction with anonymous feedback."
                            link="/"
                            isComingSoon
                        />
                    </SimpleGrid>

                    <Box mt={16}>
                        <SeoText sections={homeSeoSections} />
                    </Box>
                </VStack>
            </PageContainer>
        </Box>
    )
}

export default Home
