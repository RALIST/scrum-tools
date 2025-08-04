import { FC } from 'react';
import { Box } from '@chakra-ui/react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import Home from './pages/Home';
import DailyStandup from './pages/DailyStandup';
import Profile from './pages/Profile';
import RetroBoard from './pages/retro/RetroBoard';
import RetroLanding from './pages/retro/RetroLanding';
import PlanningPoker from './pages/poker/PlanningPoker';
import PlanningPokerRoom from './pages/poker/PlanningPokerRoom';
import TeamVelocity from './pages/velocity/TeamVelocity';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import Workspaces from './pages/workspaces/Workspaces';
import WorkspaceDetail from './pages/workspaces/WorkspaceDetail';
import JoinWorkspacePage from './pages/workspaces/JoinWorkspacePage'; // Import the new page
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import PageContainer from './components/PageContainer';
import ErrorBoundary from './components/ErrorBoundary';
import DeveloperTools from './components/DeveloperTools';
import { AuthProvider } from './contexts/AuthContext';
import { WorkspaceProvider } from './contexts/WorkspaceContext';
import PrivateRoute from './components/PrivateRoute';

const App: FC = () => {
  return (
    <HelmetProvider>
      <ErrorBoundary>
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
                    {/* Auth Routes */}
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />

                    {/* Core Public Routes */}
                    <Route path="/" element={<Home />} />
                    <Route path="/planning-poker" element={<PlanningPoker />} />
                    <Route path="/planning-poker/:roomId" element={<PlanningPokerRoom />} />
                    <Route path="/retro" element={<RetroLanding />} />
                    <Route path="/retro/:boardId" element={<RetroBoard />} />
                    <Route path="/velocity" element={<TeamVelocity />} />
                    <Route path="/daily-standup" element={<DailyStandup />} />
                    {/* Workspace Invitation Route */}
                    <Route path="/join-workspace" element={<JoinWorkspacePage />} />

                    {/* Private Routes */}
                    <Route
                      path="/profile"
                      element={
                        <PrivateRoute>
                          <Profile />
                        </PrivateRoute>
                      }
                    />
                    <Route
                      path="/workspaces"
                      element={
                        <PrivateRoute>
                          <Workspaces />
                        </PrivateRoute>
                      }
                    />
                    <Route
                      path="/workspaces/:id"
                      element={
                        <PrivateRoute>
                          <WorkspaceDetail />
                        </PrivateRoute>
                      }
                    />
                  </Routes>
                </PageContainer>
                <Footer />
                <DeveloperTools isVisible={import.meta.env.DEV} />
              </Box>
            </Router>
          </WorkspaceProvider>
        </AuthProvider>
      </ErrorBoundary>
    </HelmetProvider>
  );
};

export default App;
