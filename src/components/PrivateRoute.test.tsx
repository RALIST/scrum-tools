// src/components/PrivateRoute.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ChakraProvider } from "@chakra-ui/react";
import PrivateRoute from "./PrivateRoute";
import { AuthContext } from "../contexts/AuthContext";

// --- Helpers ---
interface RenderOptions {
  isAuthenticated: boolean;
  isLoading: boolean;
}

function renderPrivateRoute({ isAuthenticated, isLoading }: RenderOptions) {
  return render(
    <ChakraProvider>
      <AuthContext.Provider
        value={{
          user: isAuthenticated ? { id: "1", name: "User", email: "u@e.com" } : null,
          token: isAuthenticated ? "fake-token" : null,
          isAuthenticated,
          isLoading,
          login: vi.fn(),
          register: vi.fn(),
          logout: vi.fn(),
        }}
      >
        <MemoryRouter initialEntries={["/protected"]}>
          <Routes>
            <Route
              path="/protected"
              element={
                <PrivateRoute>
                  <div data-testid="protected-content">Protected Content</div>
                </PrivateRoute>
              }
            />
            <Route path="/login" element={<div data-testid="login-page">Login Page</div>} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </ChakraProvider>
  );
}

describe("PrivateRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a Spinner when isLoading is true", () => {
    renderPrivateRoute({ isAuthenticated: false, isLoading: true });

    // Chakra Spinner renders a div with role="status"
    expect(screen.getByText("Loading...")).toBeInTheDocument();
    expect(screen.queryByTestId("protected-content")).not.toBeInTheDocument();
    expect(screen.queryByTestId("login-page")).not.toBeInTheDocument();
  });

  it("renders children when authenticated", () => {
    renderPrivateRoute({ isAuthenticated: true, isLoading: false });

    expect(screen.getByTestId("protected-content")).toBeInTheDocument();
    expect(screen.getByText("Protected Content")).toBeInTheDocument();
    expect(screen.queryByTestId("login-page")).not.toBeInTheDocument();
  });

  it("redirects to /login when not authenticated", () => {
    renderPrivateRoute({ isAuthenticated: false, isLoading: false });

    expect(screen.getByTestId("login-page")).toBeInTheDocument();
    expect(screen.getByText("Login Page")).toBeInTheDocument();
    expect(screen.queryByTestId("protected-content")).not.toBeInTheDocument();
  });

  it("does not render children while loading even if authenticated", () => {
    renderPrivateRoute({ isAuthenticated: true, isLoading: true });

    // When loading, spinner should show regardless of auth status
    expect(screen.getByText("Loading...")).toBeInTheDocument();
    expect(screen.queryByTestId("protected-content")).not.toBeInTheDocument();
  });

  it("does not redirect to login while loading", () => {
    renderPrivateRoute({ isAuthenticated: false, isLoading: true });

    expect(screen.queryByTestId("login-page")).not.toBeInTheDocument();
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("renders different children correctly when authenticated", () => {
    render(
      <ChakraProvider>
        <AuthContext.Provider
          value={{
            user: { id: "1", name: "User", email: "u@e.com" },
            token: "token",
            isAuthenticated: true,
            isLoading: false,
            login: vi.fn(),
            register: vi.fn(),
            logout: vi.fn(),
          }}
        >
          <MemoryRouter initialEntries={["/dashboard"]}>
            <Routes>
              <Route
                path="/dashboard"
                element={
                  <PrivateRoute>
                    <div data-testid="dashboard">Dashboard Content</div>
                  </PrivateRoute>
                }
              />
            </Routes>
          </MemoryRouter>
        </AuthContext.Provider>
      </ChakraProvider>
    );

    expect(screen.getByTestId("dashboard")).toBeInTheDocument();
    expect(screen.getByText("Dashboard Content")).toBeInTheDocument();
  });
});
