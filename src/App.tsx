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
import Login from './pages/Login'
import Register from './pages/Register'
import Profile from './pages/Profile'
import Workspaces from './pages/Workspaces'
import WorkspaceDetail from './pages/WorkspaceDetail'
import RetroBoardHistory from './pages/RetroBoardHistory'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import PageContainer from './components/PageContainer'
import { AuthProvider } from './contexts/AuthContext'
import { WorkspaceProvider } from './contexts/WorkspaceContext'
import PrivateRoute from './components/PrivateRoute'

const App: FC = () => {
    return (
        <HelmetProvider>
            <AuthProvider>
                <WorkspaceProvider key="workspace-provider">
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
                                    <Route path="/login" element={<Login />} />
                                    <Route path="/register" element={<Register />} />
                                    <Route path="/profile" element={
                                        <PrivateRoute>
                                            <Profile />
                                        </PrivateRoute>
                                    } />
                                    <Route path="/workspaces" element={
                                        <PrivateRoute>
                                            <Workspaces />
                                        </PrivateRoute>
                                    } />
                                    <Route path="/workspaces/:id" element={
                                        <PrivateRoute>
                                            <WorkspaceDetail />
                                        </PrivateRoute>
                                    } />
                                    <Route path="/retro" element={<RetroLanding />} />
                                    <Route path="/retro/:boardId" element={<RetroBoard />} />
                                    <Route path="/retro/:boardId/history" element={
                                        <PrivateRoute>
                                            <RetroBoardHistory />
                                        </PrivateRoute>
                                    } />
                                    <Route path="/planning-poker" element={<PlanningPoker />} />
                                    <Route path="/planning-poker/:roomId" element={<PlanningPokerRoom />} />
                                    <Route path="/daily-standup" element={<DailyStandup />} />
                                    <Route path="/velocity" element={<TeamVelocity />} />
                                </Routes>
                            </PageContainer>
                            <Footer />
                        </Box>
                    </Router>
                </WorkspaceProvider>
            </AuthProvider>
        </HelmetProvider>
    )
}

export default App;