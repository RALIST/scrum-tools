// src/pages/auth/Login.invitations.test.tsx - Pending invitation flow tests
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ChakraProvider } from "@chakra-ui/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import Login from "./Login";
import { AuthContext } from "../../contexts/AuthContext";
import { WorkspaceContext } from "../../contexts/WorkspaceContext";
import * as apiUtils from "../../utils/apiUtils";

// Mock the apiRequest function
vi.mock("../../utils/apiUtils", async (importOriginal) => {
  const actual = await importOriginal<typeof apiUtils>();
  return {
    ...actual,
    apiRequest: vi.fn(),
  };
});

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
  };
});

// Mock useToast
const mockToast = vi.fn();
vi.mock("@chakra-ui/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@chakra-ui/react")>();
  return {
    ...actual,
    useToast: () => mockToast,
  };
});

const mockLogin = vi.fn();
const mockRefreshWorkspaces = vi.fn();

const renderLoginComponent = (isAuthenticated = false) => {
  return render(
    <HelmetProvider>
      <ChakraProvider>
        <AuthContext.Provider
          value={{
            user: null,
            token: isAuthenticated ? "fake-token" : null,
            isAuthenticated,
            login: mockLogin,
            register: vi.fn(),
            logout: vi.fn(),
            isLoading: false,
          }}
        >
          <WorkspaceContext.Provider
            value={{
              workspaces: [],
              currentWorkspace: null,
              isLoading: false,
              refreshWorkspaces: mockRefreshWorkspaces,
              setCurrentWorkspace: vi.fn(),
              createWorkspace: vi.fn(),
              updateWorkspace: vi.fn(),
              addWorkspaceMember: vi.fn(),
              removeWorkspaceMember: vi.fn(),
              getWorkspaceMembers: vi.fn(),
            }}
          >
            <MemoryRouter initialEntries={["/login"]}>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route
                  path="/workspaces"
                  element={<div>Workspaces Page</div>}
                />
                <Route
                  path="/workspaces/:id"
                  element={<div>Workspace Detail Page</div>}
                />
              </Routes>
            </MemoryRouter>
          </WorkspaceContext.Provider>
        </AuthContext.Provider>
      </ChakraProvider>
    </HelmetProvider>
  );
};

/** Helper to fill and submit the login form */
const fillAndSubmitLoginForm = (
  email = "test@example.com",
  password = "password123"
) => {
  fireEvent.change(screen.getByLabelText(/email/i), {
    target: { value: email },
  });
  fireEvent.change(screen.getByLabelText(/^password$/i), {
    target: { value: password },
  });
  fireEvent.click(screen.getByRole("button", { name: /log in/i }));
};

describe("Login - Pending Invitation Flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  describe("Invitation Token Detection", () => {
    it("should detect invitation token from sessionStorage", async () => {
      sessionStorage.setItem(
        "pendingInvitationToken",
        "valid-invitation-token-123"
      );
      renderLoginComponent(false);

      // Should show login form
      expect(screen.getByRole("heading", { name: /log in/i })).toBeInTheDocument();
    });

    it("should handle missing invitation token gracefully", () => {
      renderLoginComponent(false);

      // Should render normal login form
      expect(screen.getByRole("heading", { name: /log in/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    });

    it("should handle invalid invitation token format", () => {
      sessionStorage.setItem("pendingInvitationToken", "invalid-token");
      renderLoginComponent(false);

      // Should still render login form
      expect(screen.getByRole("heading", { name: /log in/i })).toBeInTheDocument();
    });
  });

  describe("Post-Login Invitation Processing", () => {
    it("should process invitation after successful login", async () => {
      const invitationToken = "valid-invitation-token-123";
      const mockApiRequest = vi.mocked(apiUtils.apiRequest);

      // Set pending invitation in sessionStorage (the component reads this after login)
      sessionStorage.setItem("pendingInvitationToken", invitationToken);

      // Mock successful login
      mockLogin.mockResolvedValueOnce({
        token: "auth-token",
        user: { id: "1", email: "test@example.com", name: "Test User" },
      });

      // Mock successful invitation acceptance
      mockApiRequest.mockResolvedValueOnce({
        success: true,
        workspaceId: "workspace-123",
        message: "Successfully joined workspace",
      });

      mockRefreshWorkspaces.mockResolvedValueOnce(undefined);

      renderLoginComponent(false);
      fillAndSubmitLoginForm();

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith({
          email: "test@example.com",
          password: "password123",
        });
      });

      // After successful login, invitation should be processed
      await waitFor(() => {
        expect(mockApiRequest).toHaveBeenCalledWith(
          "/workspaces/invitations/accept",
          expect.objectContaining({
            method: "POST",
            body: { token: invitationToken },
          })
        );
      });

      // Should navigate to workspace after successful invitation acceptance
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith("/workspaces/workspace-123");
      });
    });

    it("should handle invitation acceptance failure gracefully", async () => {
      const invitationToken = "expired-invitation-token";
      const mockApiRequest = vi.mocked(apiUtils.apiRequest);

      // Set pending invitation in sessionStorage
      sessionStorage.setItem("pendingInvitationToken", invitationToken);

      // Mock successful login
      mockLogin.mockResolvedValueOnce({
        token: "auth-token",
        user: { id: "1", email: "test@example.com", name: "Test User" },
      });

      // Mock failed invitation acceptance
      mockApiRequest.mockRejectedValueOnce(
        new Error("Invitation token expired")
      );

      renderLoginComponent(false);
      fillAndSubmitLoginForm();

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalled();
      });

      // Should show error toast for failed invitation
      // The component uses title "Failed to Accept Invitation" and status "error"
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: "Failed to Accept Invitation",
            status: "error",
          })
        );
      });

      // Should still navigate to default location (workspaces list)
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith("/workspaces");
      });
    });

    it("should clear pending token and set processed token after success", async () => {
      const invitationToken = "token-to-store";
      const mockApiRequest = vi.mocked(apiUtils.apiRequest);

      sessionStorage.setItem("pendingInvitationToken", invitationToken);

      mockLogin.mockResolvedValueOnce({
        token: "auth-token",
        user: { id: "1", email: "test@example.com", name: "Test User" },
      });

      mockApiRequest.mockResolvedValueOnce({
        success: true,
        workspaceId: "workspace-123",
        message: "Joined workspace",
      });

      mockRefreshWorkspaces.mockResolvedValueOnce(undefined);

      renderLoginComponent(false);
      fillAndSubmitLoginForm();

      // After processing, the pending token should be removed and the processed token set
      await waitFor(() => {
        expect(sessionStorage.getItem("pendingInvitationToken")).toBeNull();
        expect(sessionStorage.getItem("processedInvitationToken")).toBe(
          invitationToken
        );
      });
    });
  });

  describe("Invitation Flow Edge Cases", () => {
    it("should handle network errors during invitation processing", async () => {
      const invitationToken = "network-error-token";
      const mockApiRequest = vi.mocked(apiUtils.apiRequest);

      // Set pending invitation in sessionStorage
      sessionStorage.setItem("pendingInvitationToken", invitationToken);

      mockLogin.mockResolvedValueOnce({
        token: "auth-token",
        user: { id: "1", email: "test@example.com", name: "Test User" },
      });

      // Mock network error
      mockApiRequest.mockRejectedValueOnce(new Error("Network error"));

      renderLoginComponent(false);
      fillAndSubmitLoginForm();

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: "Failed to Accept Invitation",
            status: "error",
          })
        );
      });
    });

    it("should prevent duplicate invitation processing", async () => {
      const invitationToken = "duplicate-processing-token";
      const mockApiRequest = vi.mocked(apiUtils.apiRequest);

      // Set pending invitation in sessionStorage
      sessionStorage.setItem("pendingInvitationToken", invitationToken);

      mockLogin.mockResolvedValueOnce({
        token: "auth-token",
        user: { id: "1", email: "test@example.com", name: "Test User" },
      });

      mockApiRequest.mockResolvedValueOnce({
        success: true,
        workspaceId: "workspace-123",
      });

      mockRefreshWorkspaces.mockResolvedValueOnce(undefined);

      renderLoginComponent(false);
      fillAndSubmitLoginForm();

      // Wait for processing
      await waitFor(() => {
        expect(mockApiRequest).toHaveBeenCalledTimes(1);
      });

      // Ensure invitation is only processed once
      expect(mockApiRequest).toHaveBeenCalledTimes(1);
    });

    it("should handle already processed invitations", async () => {
      const invitationToken = "already-used-token";
      const mockApiRequest = vi.mocked(apiUtils.apiRequest);

      // Set pending invitation in sessionStorage
      sessionStorage.setItem("pendingInvitationToken", invitationToken);

      mockLogin.mockResolvedValueOnce({
        token: "auth-token",
        user: { id: "1", email: "test@example.com", name: "Test User" },
      });

      // Mock "already used" error
      mockApiRequest.mockRejectedValueOnce(
        new Error("Invitation already used")
      );

      renderLoginComponent(false);
      fillAndSubmitLoginForm();

      // The component shows "Failed to Accept Invitation" for any invitation error
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: "Failed to Accept Invitation",
            status: "error",
          })
        );
      });
    });
  });

  describe("Redirect Behavior with Invitations", () => {
    it("should redirect to specific workspace after successful invitation", async () => {
      const invitationToken = "redirect-test-token";
      const workspaceId = "target-workspace-123";
      const mockApiRequest = vi.mocked(apiUtils.apiRequest);

      // Set pending invitation in sessionStorage
      sessionStorage.setItem("pendingInvitationToken", invitationToken);

      mockLogin.mockResolvedValueOnce({
        token: "auth-token",
        user: { id: "1", email: "test@example.com", name: "Test User" },
      });

      mockApiRequest.mockResolvedValueOnce({
        success: true,
        workspaceId,
        message: "Welcome to the workspace!",
      });

      mockRefreshWorkspaces.mockResolvedValueOnce(undefined);

      renderLoginComponent(false);
      fillAndSubmitLoginForm();

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith(
          `/workspaces/${workspaceId}`
        );
      });
    });

    it("should refresh workspaces after successful invitation acceptance", async () => {
      const invitationToken = "refresh-workspaces-token";
      const mockApiRequest = vi.mocked(apiUtils.apiRequest);

      // Set pending invitation in sessionStorage
      sessionStorage.setItem("pendingInvitationToken", invitationToken);

      mockLogin.mockResolvedValueOnce({
        token: "auth-token",
        user: { id: "1", email: "test@example.com", name: "Test User" },
      });

      mockApiRequest.mockResolvedValueOnce({
        success: true,
        workspaceId: "new-workspace-123",
      });

      mockRefreshWorkspaces.mockResolvedValueOnce(undefined);

      renderLoginComponent(false);
      fillAndSubmitLoginForm();

      await waitFor(() => {
        expect(mockRefreshWorkspaces).toHaveBeenCalled();
      });
    });
  });
});
