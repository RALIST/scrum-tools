import { FC } from 'react'
import {
    Grid,
    GridItem,
    Card,
    CardBody,
    Stat,
    StatLabel,
    StatNumber,
    StatHelpText,
} from '@chakra-ui/react'

interface TeamAverages {
    average_velocity: number
    average_commitment: number
    completion_rate: number
}

interface VelocityStatsProps {
    averages: TeamAverages
}

const VelocityStats: FC<VelocityStatsProps> = ({ averages }) => {
    return (
        <Grid templateColumns="repeat(3, 1fr)" gap={4}>
            <GridItem>
                <Card>
                    <CardBody>
                        <Stat>
                            <StatLabel>Average Velocity</StatLabel>
                            <StatNumber>{averages.average_velocity}</StatNumber>
                            <StatHelpText>Points per sprint</StatHelpText>
                        </Stat>
                    </CardBody>
                </Card>
            </GridItem>
            <GridItem>
                <Card>
                    <CardBody>
                        <Stat>
                            <StatLabel>Average Commitment</StatLabel>
                            <StatNumber>{averages.average_commitment}</StatNumber>
                            <StatHelpText>Points committed per sprint</StatHelpText>
                        </Stat>
                    </CardBody>
                </Card>
            </GridItem>
            <GridItem>
                <Card>
                    <CardBody>
                        <Stat>
                            <StatLabel>Completion Rate</StatLabel>
                            <StatNumber>{averages.completion_rate}%</StatNumber>
                            <StatHelpText>Average completion percentage</StatHelpText>
                        </Stat>
                    </CardBody>
                </Card>
            </GridItem>
        </Grid>
    )
}

export default VelocityStats
