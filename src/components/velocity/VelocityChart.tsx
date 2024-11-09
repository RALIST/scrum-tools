import { FC } from 'react'
import { Box, Card, CardBody } from '@chakra-ui/react'
import { Line } from 'react-chartjs-2'
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend
} from 'chart.js'

// Register ChartJS components
ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend
)

interface SprintData {
    sprint_name: string
    committed_points: number
    completed_points: number
    start_date: string
    end_date: string
}

interface VelocityChartProps {
    velocityData: SprintData[]
}

const VelocityChart: FC<VelocityChartProps> = ({ velocityData }) => {
    const chartData = {
        labels: velocityData.map(sprint => sprint.sprint_name).reverse(),
        datasets: [
            {
                label: 'Committed Points',
                data: velocityData.map(sprint => sprint.committed_points).reverse(),
                borderColor: 'rgb(255, 99, 132)',
                backgroundColor: 'rgba(255, 99, 132, 0.5)',
            },
            {
                label: 'Completed Points',
                data: velocityData.map(sprint => sprint.completed_points).reverse(),
                borderColor: 'rgb(53, 162, 235)',
                backgroundColor: 'rgba(53, 162, 235, 0.5)',
            },
        ],
    }

    const chartOptions = {
        responsive: true,
        plugins: {
            legend: {
                position: 'top' as const,
            },
            title: {
                display: true,
                text: 'Team Velocity Chart',
            },
        },
        scales: {
            y: {
                beginAtZero: true,
            },
        },
    }

    return (
        <Card>
            <CardBody>
                <Box height="400px">
                    <Line data={chartData} options={chartOptions} />
                </Box>
            </CardBody>
        </Card>
    )
}

export default VelocityChart
