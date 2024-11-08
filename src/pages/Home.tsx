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
        "description": "Free online tools for agile teams including Planning Poker, Daily Standup Timer, and more.",
        "applicationCategory": "ProjectManagementApplication",
        "operatingSystem": "Any",
        "offers": {
            "@type": "Offer",
            "price": "0",
            "priceCurrency": "USD"
        },
        "featureList": [
            "Planning Poker for story estimation",
            "Daily Standup Timer",
            "Sprint Planning Tools",
            "Team Collaboration Features",
            "Retro Board"
        ],
        "screenshot": `${window.location.origin}/og-image.svg`,
        "url": "https://scrumtools.app"
    }

    return (
        <Box bg={colorMode === 'light' ? 'gray.50' : 'gray.900'} minH="calc(100vh - 60px)">
            <PageHelmet
                title="Scrum Tools - Free Online Tools for Agile Teams"
                description="Free online tools for agile teams including Planning Poker, Daily Standup Timer, and more. Boost your team's productivity with our simple, effective Scrum tools."
                keywords="scrum tools, agile tools, planning poker, daily standup, sprint planning, team collaboration, scrum ceremonies, agile ceremonies"
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
                            title="Retro Board"
                            description="Conduct effective retrospectives with your team using our collaborative board."
                            link="/retro"
                        />
                        <FeatureCard
                            title="Sprint Timer"
                            description="Track your sprint progress with our customizable sprint timer."
                            link="/"
                            isComingSoon
                        />
                        <FeatureCard
                            title="Team Velocity"
                            description="Track and visualize your team's velocity over time."
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
