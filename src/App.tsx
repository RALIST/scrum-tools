import { Box } from '@chakra-ui/react';
import { type FC, Suspense, lazy } from 'react';
import { HelmetProvider } from 'react-helmet-async';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import DeveloperTools from './components/DeveloperTools';
import ErrorBoundary from './components/ErrorBoundary';
import Footer from './components/Footer';
import Navbar from './components/Navbar';
import PageContainer from './components/PageContainer';
import PrivateRoute from './components/PrivateRoute';
import RouteLoadingSpinner from './components/RouteLoadingSpinner';
import { AuthProvider } from './contexts/AuthContext';
import { WorkspaceProvider } from './contexts/WorkspaceContext';
import Home from './pages/Home';

// Lazy load major route components for code splitting
const DailyStandup = lazy(async () => import('./pages/DailyStandup'));
const Profile = lazy(async () => import('./pages/Profile'));

// Planning Poker routes
const PlanningPoker = lazy(async () => import('./pages/poker/PlanningPoker'));
const PlanningPokerRoom = lazy(async () => import('./pages/poker/PlanningPokerRoom'));

// Retro routes
const RetroBoard = lazy(async () => import('./pages/retro/RetroBoard'));
const RetroLanding = lazy(async () => import('./pages/retro/RetroLanding'));

// Velocity routes
const TeamVelocity = lazy(async () => import('./pages/velocity/TeamVelocity'));

// Blog routes
const BlogIndex = lazy(async () => import('./pages/blog/BlogIndex'));
const BlogPost = lazy(async () => import('./pages/blog/BlogPost'));
const BlogTagPage = lazy(async () => import('./pages/blog/BlogTagPage'));

// FAQ
const FaqPage = lazy(async () => import('./pages/FaqPage'));

// Comparison routes
const CompareIndex = lazy(async () => import('./pages/compare/CompareIndex'));
const ComparisonPage = lazy(async () => import('./pages/compare/ComparisonPage'));

// Auth routes
const Login = lazy(async () => import('./pages/auth/Login'));
const Register = lazy(async () => import('./pages/auth/Register'));

// Workspace routes
const Workspaces = lazy(async () => import('./pages/workspaces/Workspaces'));
const WorkspaceDetail = lazy(async () => import('./pages/workspaces/WorkspaceDetail'));
const JoinWorkspacePage = lazy(async () => import('./pages/workspaces/JoinWorkspacePage'));

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
                      <Route path="/blog" element={<BlogIndex />} />
                      <Route path="/blog/:slug" element={<BlogPost />} />
                      <Route path="/blog/tag/:tag" element={<BlogTagPage />} />
                      <Route path="/faq" element={<FaqPage />} />
                      <Route path="/compare" element={<CompareIndex />} />
                      <Route path="/compare/:tool" element={<ComparisonPage />} />
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
