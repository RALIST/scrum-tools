import { FC } from 'react'
import { Box } from '@chakra-ui/react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import Home from './pages/Home'
import RetroBoard from './pages/RetroBoard'
import RetroLanding from './pages/RetroLanding'
import PlanningPoker from './pages/PlanningPoker'
import PlanningPokerRoom from './pages/PlanningPokerRoom'
import DailyStandup from './pages/DailyStandup'
import TeamVelocity from './pages/TeamVelocity'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import PageContainer from './components/PageContainer'

const App: FC = () => {
    return (
        <HelmetProvider>
            <Router>
                <Box
                    width="100%"
                    maxW="100vw"
                    overflowX="hidden"
                    minH="100vh"
                    display="flex"
                    flexDirection="column"
                >
                    <Navbar />
                    <PageContainer>
                        <Routes>
                            <Route path="/" element={<Home />} />
                            <Route path="/retro" element={<RetroLanding />} />
                            <Route path="/retro/:boardId" element={<RetroBoard />} />
                            <Route path="/planning-poker" element={<PlanningPoker />} />
                            <Route path="/planning-poker/:roomId" element={<PlanningPokerRoom />} />
                            <Route path="/daily-standup" element={<DailyStandup />} />
                            <Route path="/velocity" element={<TeamVelocity />} />
                        </Routes>
                    </PageContainer>
                    <Footer />
                </Box>
            </Router>
        </HelmetProvider>
    )
}

export default App;