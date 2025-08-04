import { FC, Suspense, lazy } from 'react';
import { Box } from '@chakra-ui/react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import Home from './pages/Home';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import PageContainer from './components/PageContainer';
import ErrorBoundary from './components/ErrorBoundary';
import DeveloperTools from './components/DeveloperTools';
import RouteLoadingSpinner from './components/RouteLoadingSpinner';
import { AuthProvider } from './contexts/AuthContext';
import { WorkspaceProvider } from './contexts/WorkspaceContext';
import PrivateRoute from './components/PrivateRoute';

// Lazy load major route components for code splitting
const DailyStandup = lazy(() => import('./pages/DailyStandup'));
const Profile = lazy(() => import('./pages/Profile'));

// Planning Poker routes
const PlanningPoker = lazy(() => import('./pages/poker/PlanningPoker'));
const PlanningPokerRoom = lazy(() => import('./pages/poker/PlanningPokerRoom'));

// Retro routes
const RetroBoard = lazy(() => import('./pages/retro/RetroBoard'));
const RetroLanding = lazy(() => import('./pages/retro/RetroLanding'));

// Velocity routes
const TeamVelocity = lazy(() => import('./pages/velocity/TeamVelocity'));

// Auth routes
const Login = lazy(() => import('./pages/auth/Login'));
const Register = lazy(() => import('./pages/auth/Register'));

// Workspace routes
const Workspaces = lazy(() => import('./pages/workspaces/Workspaces'));
const WorkspaceDetail = lazy(() => import('./pages/workspaces/WorkspaceDetail'));
const JoinWorkspacePage = lazy(() => import('./pages/workspaces/JoinWorkspacePage'));

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
                  <Suspense fallback={<RouteLoadingSpinner />}>
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
                  </Suspense>
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
