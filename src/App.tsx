import { FC } from "react";
import { Box } from "@chakra-ui/react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
// Keep Home, DailyStandup, Profile at top level for now
import Home from "./pages/Home";
import DailyStandup from "./pages/DailyStandup";
import Profile from "./pages/Profile";
// Update imports for moved pages
import RetroBoard from "./pages/retro/RetroBoard";
import RetroLanding from "./pages/retro/RetroLanding";
import RetroBoardHistory from "./pages/retro/RetroBoardHistory";
import PlanningPoker from "./pages/poker/PlanningPoker";
import PlanningPokerRoom from "./pages/poker/PlanningPokerRoom";
import TeamVelocity from "./pages/velocity/TeamVelocity";
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import Workspaces from "./pages/workspaces/Workspaces";
import WorkspaceDetail from "./pages/workspaces/WorkspaceDetail";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import PageContainer from "./components/PageContainer";
import { AuthProvider } from "./contexts/AuthContext";
import { WorkspaceProvider } from "./contexts/WorkspaceContext";
import PrivateRoute from "./components/PrivateRoute";

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
                  {/* Auth Routes */}
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />

                  {/* Core Public Routes */}
                  <Route path="/" element={<Home />} />
                  <Route path="/planning-poker" element={<PlanningPoker />} />
                  <Route
                    path="/planning-poker/:roomId"
                    element={<PlanningPokerRoom />}
                  />
                  <Route path="/retro" element={<RetroLanding />} />
                  <Route path="/retro/:boardId" element={<RetroBoard />} />
                  <Route path="/velocity" element={<TeamVelocity />} />
                  <Route path="/daily-standup" element={<DailyStandup />} />

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
                  <Route
                    path="/retro/:boardId/history"
                    element={
                      <PrivateRoute>
                        <RetroBoardHistory />
                      </PrivateRoute>
                    }
                  />
                  {/* Removed extra closing tags */}
                  {/* Add other private routes if needed */}
                </Routes>
              </PageContainer>
              <Footer />
            </Box>
          </Router>
        </WorkspaceProvider>
      </AuthProvider>
    </HelmetProvider>
  );
};

export default App;
