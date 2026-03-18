// src/contexts/AuthContext.test.tsx
import { render, screen, waitFor, act, renderHook } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "./AuthContext";

// --- Mocks ---
const mockApiRequest = vi.fn();

vi.mock("../utils/apiUtils", () => ({
  apiRequest: (...args: unknown[]) => mockApiRequest(...args) as unknown,
  AuthError: class AuthError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "AuthError";
    }
  },
}));

// --- Helpers ---
function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

// A test component that exposes auth context
function AuthConsumer() {
  const auth = useAuth();
  return (
    <div>
      <span data-testid="is-loading">{String(auth.isLoading)}</span>
      <span data-testid="is-authenticated">{String(auth.isAuthenticated)}</span>
      <span data-testid="user">{auth.user ? auth.user.name : "null"}</span>
      <span data-testid="token">{auth.token ?? "null"}</span>
      <button onClick={() => { auth.login({ email: "test@example.com", password: "pass123" }).catch(() => {}); }}>
        Login
      </button>
      <button onClick={() => { auth.register({ email: "test@example.com", password: "pass123", name: "Test" }).catch(() => {}); }}>
        Register
      </button>
      <button onClick={auth.logout}>Logout</button>
    </div>
  );
}

describe("AuthContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe("useAuth", () => {
    it("throws when used outside AuthProvider", () => {
      // Suppress console.error for the expected error
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

      expect(() => {
        renderHook(() => useAuth());
      }).toThrow("useAuth must be used within an AuthProvider");

      consoleSpy.mockRestore();
    });
  });

  describe("AuthProvider - initial state", () => {
    it("starts with isLoading false and user null when no token in localStorage", async () => {
      const queryClient = createTestQueryClient();

      render(
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <AuthConsumer />
          </AuthProvider>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("is-loading").textContent).toBe("false");
      });
      expect(screen.getByTestId("is-authenticated").textContent).toBe("false");
      expect(screen.getByTestId("user").textContent).toBe("null");
      expect(screen.getByTestId("token").textContent).toBe("null");
    });

    it("starts with isLoading true when token exists in localStorage", async () => {
      localStorage.setItem("token", "existing-token");
      localStorage.setItem("user", JSON.stringify({ id: "1", name: "User", email: "u@e.com" }));

      // Make the verify endpoint hang (never resolve) so we can observe isLoading = true
      mockApiRequest.mockReturnValue(new Promise(() => {}));

      const queryClient = createTestQueryClient();

      render(
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <AuthConsumer />
          </AuthProvider>
        </QueryClientProvider>
      );

      // isLoading should be true while verification is pending
      expect(screen.getByTestId("is-loading").textContent).toBe("true");
    });
  });

  describe("Token verification", () => {
    it("verifies token via /auth/verify and sets user on success", async () => {
      localStorage.setItem("token", "valid-token");
      localStorage.setItem("user", JSON.stringify({ id: "1", name: "Stored User", email: "stored@e.com" }));

      const verifiedUser = { id: "1", name: "Verified User", email: "verified@e.com" };
      mockApiRequest.mockResolvedValueOnce({ user: verifiedUser });

      const queryClient = createTestQueryClient();

      render(
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <AuthConsumer />
          </AuthProvider>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("is-loading").textContent).toBe("false");
      });

      expect(screen.getByTestId("is-authenticated").textContent).toBe("true");
      expect(screen.getByTestId("user").textContent).toBe("Verified User");
      expect(screen.getByTestId("token").textContent).toBe("valid-token");

      // Verify apiRequest was called with correct endpoint
      expect(mockApiRequest).toHaveBeenCalledWith("/auth/verify", {
        method: "GET",
        includeAuth: true,
      });
    });

    it("logs out user on failed token verification", async () => {
      localStorage.setItem("token", "invalid-token");
      localStorage.setItem("user", JSON.stringify({ id: "1", name: "User", email: "u@e.com" }));

      mockApiRequest.mockRejectedValueOnce(new Error("Token expired"));

      const queryClient = createTestQueryClient();

      render(
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <AuthConsumer />
          </AuthProvider>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("is-loading").textContent).toBe("false");
      });

      expect(screen.getByTestId("is-authenticated").textContent).toBe("false");
      expect(screen.getByTestId("user").textContent).toBe("null");
      expect(screen.getByTestId("token").textContent).toBe("null");

      // localStorage should be cleared
      expect(localStorage.getItem("token")).toBeNull();
      expect(localStorage.getItem("user")).toBeNull();
    });
  });

  describe("login", () => {
    it("calls apiRequest with correct endpoint and stores user/token on success", async () => {
      const mockUser = { id: "1", name: "Test User", email: "test@example.com" };
      const mockToken = "new-auth-token";

      mockApiRequest.mockResolvedValueOnce({ user: mockUser, token: mockToken });

      const queryClient = createTestQueryClient();

      render(
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <AuthConsumer />
          </AuthProvider>
        </QueryClientProvider>
      );

      // Wait for initial load to complete
      await waitFor(() => {
        expect(screen.getByTestId("is-loading").textContent).toBe("false");
      });

      // Click login button
      await act(async () => {
        screen.getByText("Login").click();
      });

      await waitFor(() => {
        expect(screen.getByTestId("is-authenticated").textContent).toBe("true");
      });

      expect(screen.getByTestId("user").textContent).toBe("Test User");
      expect(screen.getByTestId("token").textContent).toBe("new-auth-token");

      // Check localStorage was updated
      expect(localStorage.getItem("token")).toBe("new-auth-token");
      expect(JSON.parse(localStorage.getItem("user")!)).toEqual(mockUser);

      // Check apiRequest was called correctly
      expect(mockApiRequest).toHaveBeenCalledWith("/auth/login", {
        method: "POST",
        body: { email: "test@example.com", password: "pass123" },
        includeAuth: false,
      });
    });

    it("handles login failure gracefully", async () => {
      mockApiRequest.mockRejectedValueOnce(new Error("Invalid credentials"));

      const queryClient = createTestQueryClient();

      render(
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <AuthConsumer />
          </AuthProvider>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("is-loading").textContent).toBe("false");
      });

      // The login button should throw, but the component handles it
      await act(async () => {
        try {
          screen.getByText("Login").click();
        } catch {
          // Expected - mutateAsync throws
        }
      });

      // Wait for the mutation to settle
      await waitFor(() => {
        expect(screen.getByTestId("is-authenticated").textContent).toBe("false");
      });

      expect(screen.getByTestId("user").textContent).toBe("null");
      expect(localStorage.getItem("token")).toBeNull();
    });
  });

  describe("register", () => {
    it("calls apiRequest with correct endpoint and stores user/token on success", async () => {
      const mockUser = { id: "2", name: "New User", email: "new@example.com" };
      const mockToken = "register-token";

      mockApiRequest.mockResolvedValueOnce({ user: mockUser, token: mockToken });

      const queryClient = createTestQueryClient();

      render(
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <AuthConsumer />
          </AuthProvider>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("is-loading").textContent).toBe("false");
      });

      await act(async () => {
        screen.getByText("Register").click();
      });

      await waitFor(() => {
        expect(screen.getByTestId("is-authenticated").textContent).toBe("true");
      });

      expect(screen.getByTestId("user").textContent).toBe("New User");
      expect(screen.getByTestId("token").textContent).toBe("register-token");

      expect(localStorage.getItem("token")).toBe("register-token");
      expect(JSON.parse(localStorage.getItem("user")!)).toEqual(mockUser);

      expect(mockApiRequest).toHaveBeenCalledWith("/auth/register", {
        method: "POST",
        body: { email: "test@example.com", password: "pass123", name: "Test" },
        includeAuth: false,
      });
    });
  });

  describe("logout", () => {
    it("clears user, token from state and localStorage", async () => {
      const mockUser = { id: "1", name: "Test User", email: "test@example.com" };
      const mockToken = "auth-token";

      // Setup: login first
      mockApiRequest.mockResolvedValueOnce({ user: mockUser, token: mockToken });

      const queryClient = createTestQueryClient();

      render(
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <AuthConsumer />
          </AuthProvider>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("is-loading").textContent).toBe("false");
      });

      // Login
      await act(async () => {
        screen.getByText("Login").click();
      });

      await waitFor(() => {
        expect(screen.getByTestId("is-authenticated").textContent).toBe("true");
      });

      // Now logout
      await act(async () => {
        screen.getByText("Logout").click();
      });

      await waitFor(() => {
        expect(screen.getByTestId("is-authenticated").textContent).toBe("false");
      });

      expect(screen.getByTestId("user").textContent).toBe("null");
      expect(screen.getByTestId("token").textContent).toBe("null");
      expect(localStorage.getItem("token")).toBeNull();
      expect(localStorage.getItem("user")).toBeNull();
      expect(localStorage.getItem("currentWorkspaceId")).toBeNull();
    });

    it("clears currentWorkspaceId from localStorage on logout", async () => {
      localStorage.setItem("currentWorkspaceId", "workspace-123");

      const mockUser = { id: "1", name: "Test User", email: "test@example.com" };
      mockApiRequest.mockResolvedValueOnce({ user: mockUser, token: "tok" });

      const queryClient = createTestQueryClient();

      render(
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <AuthConsumer />
          </AuthProvider>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("is-loading").textContent).toBe("false");
      });

      // Login first
      await act(async () => {
        screen.getByText("Login").click();
      });

      await waitFor(() => {
        expect(screen.getByTestId("is-authenticated").textContent).toBe("true");
      });

      // Logout
      await act(async () => {
        screen.getByText("Logout").click();
      });

      await waitFor(() => {
        expect(localStorage.getItem("currentWorkspaceId")).toBeNull();
      });
    });
  });
});
