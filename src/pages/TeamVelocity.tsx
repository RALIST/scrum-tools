import { FC, useState } from 'react'
import {
    Container,
    Heading,
    VStack,
    Button,
    useToast,
    FormControl,
    FormLabel,
    Input,
    Grid,
    GridItem,
    Card,
    CardBody,
    Text,
    HStack,
    Divider,
    useDisclosure,
    FormErrorMessage,
} from '@chakra-ui/react'
import PageContainer from '../components/PageContainer'
import PageHelmet from '../components/PageHelmet'
import SeoText from '../components/SeoText'
import { AddSprintModal } from '../components/modals'
import { VelocityChart, VelocityStats } from '../components/velocity'
import { teamVelocitySeo, teamVelocitySeoSections } from '../content/teamVelocitySeo'
import config from '../config'

interface SprintData {
    sprint_name: string
    committed_points: number
    completed_points: number
    start_date: string
    end_date: string
}

interface TeamAverages {
    average_velocity: number
    average_commitment: number
    completion_rate: number
}

interface FormErrors {
    teamName?: string
    teamPassword?: string
}

const TeamVelocity: FC = () => {
    const [teamName, setTeamName] = useState('')
    const [teamPassword, setTeamPassword] = useState('')
    const [sprintName, setSprintName] = useState('')
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')
    const [committedPoints, setCommittedPoints] = useState('')
    const [completedPoints, setCompletedPoints] = useState('')
    const [velocityData, setVelocityData] = useState<SprintData[]>([])
    const [averages, setAverages] = useState<TeamAverages | null>(null)
    const [isTeamLoaded, setIsTeamLoaded] = useState(false)
    const [formErrors, setFormErrors] = useState<FormErrors>({})
    const { isOpen: isAddSprintOpen, onOpen: onAddSprintOpen, onClose: onAddSprintClose } = useDisclosure()
    const toast = useToast()

    const validateTeamForm = (): boolean => {
        const errors: FormErrors = {}
        let isValid = true

        if (!teamName.trim()) {
            errors.teamName = 'Team name is required'
            isValid = false
        } else if (teamName.length < 3) {
            errors.teamName = 'Team name must be at least 3 characters'
            isValid = false
        }

        if (!teamPassword.trim()) {
            errors.teamPassword = 'Password is required'
            isValid = false
        } else if (teamPassword.length < 6) {
            errors.teamPassword = 'Password must be at least 6 characters'
            isValid = false
        }

        setFormErrors(errors)
        return isValid
    }

    const handleCreateOrLoadTeam = async () => {
        if (!validateTeamForm()) {
            return
        }

        try {
            const response = await fetch(`${config.apiUrl}/teams`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: teamName,
                    password: teamPassword,
                }),
            })
            const data = await response.json()
            console.log(response.ok)
            if (!response.ok) {
                throw new Error(data.error || 'Failed to load team')
            }

            if (data.success) {
                setIsTeamLoaded(true)
                setFormErrors({})
                toast({
                    title: 'Team loaded successfully',
                    status: 'success',
                    duration: 3000,
                })
                loadTeamData()
            }
        } catch (error) {
            toast({
                title: 'Error',
                description: error instanceof Error ? error.message : 'Unknown error occurred',
                status: 'error',
                duration: 3000,
            })
        }
    }

    const handleAddSprint = async (data: {
        sprintName: string
        startDate: string
        endDate: string
        committedPoints: string
        completedPoints: string
    }) => {
        if (!isTeamLoaded) {
            toast({
                title: 'Error',
                description: 'Please create or load a team first',
                status: 'error',
                duration: 3000,
            })
            return
        }

        try {
            // Create sprint
            const sprintResponse = await fetch(
                `${config.apiUrl}/teams/${teamName}/sprints?password=${teamPassword}`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        sprintName: data.sprintName,
                        startDate: data.startDate,
                        endDate: data.endDate,
                    }),
                }
            )

            if (!sprintResponse.ok) {
                const errorData = await sprintResponse.json()
                throw new Error(errorData.error || 'Failed to create sprint')
            }

            const sprintData = await sprintResponse.json()

            // Update velocity
            const velocityResponse = await fetch(`${config.apiUrl}/sprints/${sprintData.id}/velocity`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    committedPoints: parseInt(data.committedPoints),
                    completedPoints: parseInt(data.completedPoints),
                }),
            })

            if (!velocityResponse.ok) {
                const errorData = await velocityResponse.json()
                throw new Error(errorData.error || 'Failed to update velocity')
            }

            toast({
                title: 'Sprint data added successfully',
                status: 'success',
                duration: 3000,
            })
            loadTeamData()
            onAddSprintClose()

            // Reset form
            setSprintName('')
            setStartDate('')
            setEndDate('')
            setCommittedPoints('')
            setCompletedPoints('')
        } catch (error) {
            toast({
                title: 'Error',
                description: error instanceof Error ? error.message : 'Unknown error occurred',
                status: 'error',
                duration: 3000,
            })
        }
    }

    const loadTeamData = async () => {
        try {
            const response = await fetch(
                `${config.apiUrl}/teams/${teamName}/velocity?password=${teamPassword}`
            )
            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || 'Failed to load team data')
            }

            setVelocityData(data.sprints)
            setAverages(data.averages)
        } catch (error) {
            toast({
                title: 'Error',
                description: error instanceof Error ? error.message : 'Unknown error occurred',
                status: 'error',
                duration: 3000,
            })
            // Reset team state on error
            setIsTeamLoaded(false)
            setVelocityData([])
            setAverages(null)
        }
    }

    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        "name": "Team Velocity Tracker",
        "applicationCategory": "BusinessApplication",
        "operatingSystem": "Any",
        "description": teamVelocitySeo.description,
        "offers": {
            "@type": "Offer",
            "price": "0",
            "priceCurrency": "USD"
        },
        "featureList": teamVelocitySeo.content.features
    }

    return (
        <PageContainer>
            <PageHelmet
                title={teamVelocitySeo.title}
                description={teamVelocitySeo.description}
                keywords={teamVelocitySeo.keywords}
                canonicalUrl={`${config.siteUrl}/velocity`}
                jsonLd={jsonLd}
            />
            <Container maxW="container.xl" py={8}>
                <VStack spacing={8} align="stretch">
                    <VStack spacing={4} align="center" textAlign="center">
                        <Heading as="h1" size="xl">
                            {teamVelocitySeo.content.heading}
                        </Heading>
                        <Text fontSize="lg" color="gray.600">
                            {teamVelocitySeo.content.subheading}
                        </Text>
                    </VStack>

                    {/* Team Setup */}
                    <Card>
                        <CardBody>
                            <VStack spacing={4}>
                                <Grid templateColumns="repeat(2, 1fr)" gap={4} width="100%">
                                    <GridItem>
                                        <FormControl isInvalid={!!formErrors.teamName}>
                                            <FormLabel>Team Name</FormLabel>
                                            <Input
                                                value={teamName}
                                                onChange={(e) => {
                                                    setTeamName(e.target.value)
                                                    setFormErrors(prev => ({ ...prev, teamName: undefined }))
                                                }}
                                                placeholder="Enter team name"
                                                isDisabled={isTeamLoaded}
                                            />
                                            <FormErrorMessage>{formErrors.teamName}</FormErrorMessage>
                                        </FormControl>
                                    </GridItem>
                                    <GridItem>
                                        <FormControl isInvalid={!!formErrors.teamPassword}>
                                            <FormLabel>Team Password</FormLabel>
                                            <Input
                                                type="password"
                                                value={teamPassword}
                                                onChange={(e) => {
                                                    setTeamPassword(e.target.value)
                                                    setFormErrors(prev => ({ ...prev, teamPassword: undefined }))
                                                }}
                                                placeholder="Enter team password"
                                                isDisabled={isTeamLoaded}
                                            />
                                            <FormErrorMessage>{formErrors.teamPassword}</FormErrorMessage>
                                        </FormControl>
                                    </GridItem>
                                </Grid>
                                <HStack spacing={4}>
                                    {!isTeamLoaded ? (
                                        <Button colorScheme="blue" onClick={handleCreateOrLoadTeam}>
                                            Create/Load Team
                                        </Button>
                                    ) : (
                                        <>
                                            <Button colorScheme="green" onClick={onAddSprintOpen}>
                                                Add Sprint Data
                                            </Button>
                                            <Button
                                                colorScheme="blue"
                                                variant="outline"
                                                onClick={() => {
                                                    setIsTeamLoaded(false)
                                                    setTeamName('')
                                                    setTeamPassword('')
                                                    setVelocityData([])
                                                    setAverages(null)
                                                    setFormErrors({})
                                                }}
                                            >
                                                Change Team
                                            </Button>
                                        </>
                                    )}
                                </HStack>
                            </VStack>
                        </CardBody>
                    </Card>

                    {/* Statistics */}
                    {averages && <VelocityStats averages={averages} />}

                    {/* Velocity Chart */}
                    {velocityData.length > 0 && <VelocityChart velocityData={velocityData} />}

                    <Divider my={8} />

                    <SeoText sections={teamVelocitySeoSections} />
                </VStack>
            </Container>

            <AddSprintModal
                isOpen={isAddSprintOpen}
                onClose={onAddSprintClose}
                onSubmit={handleAddSprint}
                sprintName={sprintName}
                startDate={startDate}
                endDate={endDate}
                committedPoints={committedPoints}
                completedPoints={completedPoints}
                onSprintNameChange={setSprintName}
                onStartDateChange={setStartDate}
                onEndDateChange={setEndDate}
                onCommittedPointsChange={setCommittedPoints}
                onCompletedPointsChange={setCompletedPoints}
            />
        </PageContainer>
    )
}

export default TeamVelocity
