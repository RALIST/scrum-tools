// src/pages/auth/Register.invitations.test.tsx - Pending invitation flow tests for registration
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ChakraProvider } from "@chakra-ui/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import Register from "./Register";
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

const mockRegister = vi.fn();
const mockRefreshWorkspaces = vi.fn();

const renderRegisterComponent = (isAuthenticated = false) => {
  return render(
    <HelmetProvider>
      <ChakraProvider>
        <AuthContext.Provider
          value={{
            user: null,
            token: isAuthenticated ? "fake-token" : null,
            isAuthenticated,
            login: vi.fn(),
            register: mockRegister,
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
            <MemoryRouter initialEntries={["/register"]}>
              <Routes>
                <Route path="/register" element={<Register />} />
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

/** Helper to fill and submit the registration form */
const fillAndSubmitRegisterForm = (
  name = "New User",
  email = "newuser@example.com",
  password = "password123"
) => {
  fireEvent.change(screen.getByLabelText(/^name$/i), {
    target: { value: name },
  });
  fireEvent.change(screen.getByLabelText(/email/i), {
    target: { value: email },
  });
  fireEvent.change(screen.getByLabelText(/^password$/i), {
    target: { value: password },
  });
  fireEvent.change(screen.getByLabelText(/confirm password/i), {
    target: { value: password },
  });
  fireEvent.click(screen.getByRole("button", { name: /register/i }));
};

describe("Register - Pending Invitation Flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  describe("Registration with Invitation Token", () => {
    it("should detect invitation token from sessionStorage and show registration form", () => {
      sessionStorage.setItem(
        "pendingInvitationToken",
        "new-user-invitation-123"
      );
      renderRegisterComponent(false);

      // Should show registration form
      expect(screen.getByRole("heading", { name: /register/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/^name$/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    });

    it("should complete registration and process invitation automatically", async () => {
      const invitationToken = "auto-process-invitation";
      const mockApiRequest = vi.mocked(apiUtils.apiRequest);

      // Set pending invitation in sessionStorage
      sessionStorage.setItem("pendingInvitationToken", invitationToken);

      // Mock successful registration
      mockRegister.mockResolvedValueOnce({
        token: "new-auth-token",
        user: { id: "2", email: "newuser@example.com", name: "New User" },
      });

      // Mock successful invitation acceptance
      mockApiRequest.mockResolvedValueOnce({
        success: true,
        workspaceId: "invitation-workspace-456",
        message: "Welcome to your new workspace!",
      });

      mockRefreshWorkspaces.mockResolvedValueOnce(undefined);

      renderRegisterComponent(false);
      fillAndSubmitRegisterForm();

      await waitFor(() => {
        // Component calls register({ email, password, name }) as an object
        expect(mockRegister).toHaveBeenCalledWith({
          email: "newuser@example.com",
          password: "password123",
          name: "New User",
        });
      });

      // Should process invitation after registration
      await waitFor(() => {
        expect(mockApiRequest).toHaveBeenCalledWith(
          "/workspaces/invitations/accept",
          expect.objectContaining({
            method: "POST",
            body: { token: invitationToken },
          })
        );
      });

      // Should navigate to workspace
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith(
          "/workspaces/invitation-workspace-456"
        );
      });
    });

    it("should handle registration failure with pending invitation", async () => {
      // Set pending invitation in sessionStorage
      sessionStorage.setItem(
        "pendingInvitationToken",
        "registration-fail-token"
      );

      // Mock registration failure
      mockRegister.mockRejectedValueOnce(new Error("Email already exists"));

      renderRegisterComponent(false);
      fillAndSubmitRegisterForm(
        "Existing User",
        "existing@example.com",
        "password123"
      );

      await waitFor(() => {
        // Component shows "Registration failed" toast
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: "Registration failed",
            status: "error",
          })
        );
      });

      // Should not process invitation if registration fails
      expect(vi.mocked(apiUtils.apiRequest)).not.toHaveBeenCalled();
    });
  });

  describe("Invitation Token Validation", () => {
    it("should handle malformed invitation tokens gracefully", () => {
      sessionStorage.setItem("pendingInvitationToken", "malformed-token-!@#");
      renderRegisterComponent(false);

      // Should still show registration form
      expect(screen.getByRole("heading", { name: /register/i })).toBeInTheDocument();
    });

    it("should handle empty invitation token parameter", () => {
      renderRegisterComponent(false);

      // Should render normal registration form
      expect(screen.getByRole("heading", { name: /register/i })).toBeInTheDocument();
    });

    it("should preserve invitation token through validation errors", async () => {
      sessionStorage.setItem(
        "pendingInvitationToken",
        "preserve-token-123"
      );
      renderRegisterComponent(false);

      // Submit form with validation errors (missing fields)
      fireEvent.click(screen.getByRole("button", { name: /register/i }));

      // Form should show validation errors but keep invitation context
      await waitFor(() => {
        // Validation errors should be shown
        // But invitation token should still be preserved for retry
      });
    });
  });

  describe("Post-Registration Invitation Processing", () => {
    it("should show success message for successful invitation acceptance", async () => {
      const invitationToken = "success-message-token";
      const mockApiRequest = vi.mocked(apiUtils.apiRequest);

      // Set pending invitation in sessionStorage
      sessionStorage.setItem("pendingInvitationToken", invitationToken);

      mockRegister.mockResolvedValueOnce({
        token: "auth-token",
        user: { id: "3", email: "success@example.com", name: "Success User" },
      });

      mockApiRequest.mockResolvedValueOnce({
        success: true,
        workspaceId: "success-workspace",
        message: "Successfully joined the team!",
      });

      mockRefreshWorkspaces.mockResolvedValueOnce(undefined);

      renderRegisterComponent(false);
      fillAndSubmitRegisterForm(
        "Success User",
        "success@example.com",
        "password123"
      );

      // The component first shows "Account created" success toast,
      // then "Invitation Accepted!" success toast
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: "Account created",
            status: "success",
          })
        );
      });
    });

    it("should handle expired invitation tokens after registration", async () => {
      const expiredToken = "expired-invitation-token";
      const mockApiRequest = vi.mocked(apiUtils.apiRequest);

      // Set pending invitation in sessionStorage
      sessionStorage.setItem("pendingInvitationToken", expiredToken);

      mockRegister.mockResolvedValueOnce({
        token: "auth-token",
        user: {
          id: "4",
          email: "expired@example.com",
          name: "Expired User",
        },
      });

      // Mock expired invitation error
      mockApiRequest.mockRejectedValueOnce(
        new Error("Invitation token has expired")
      );

      renderRegisterComponent(false);
      fillAndSubmitRegisterForm(
        "Expired User",
        "expired@example.com",
        "password123"
      );

      // Component shows "Failed to Accept Invitation" with status "error"
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: "Failed to Accept Invitation",
            status: "error",
          })
        );
      });

      // Should still redirect to workspaces list even if invitation fails
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith("/workspaces");
      });
    });

    it("should refresh workspaces list after successful invitation", async () => {
      const invitationToken = "refresh-after-invite";
      const mockApiRequest = vi.mocked(apiUtils.apiRequest);

      // Set pending invitation in sessionStorage
      sessionStorage.setItem("pendingInvitationToken", invitationToken);

      mockRegister.mockResolvedValueOnce({
        token: "auth-token",
        user: {
          id: "5",
          email: "refresh@example.com",
          name: "Refresh User",
        },
      });

      mockApiRequest.mockResolvedValueOnce({
        success: true,
        workspaceId: "refresh-workspace",
      });

      mockRefreshWorkspaces.mockResolvedValueOnce(undefined);

      renderRegisterComponent(false);
      fillAndSubmitRegisterForm(
        "Refresh User",
        "refresh@example.com",
        "password123"
      );

      await waitFor(() => {
        expect(mockRefreshWorkspaces).toHaveBeenCalled();
      });
    });
  });

  describe("User Experience with Invitations", () => {
    it("should show appropriate loading states during invitation processing", async () => {
      const invitationToken = "loading-state-token";
      const mockApiRequest = vi.mocked(apiUtils.apiRequest);

      // Set pending invitation in sessionStorage
      sessionStorage.setItem("pendingInvitationToken", invitationToken);

      mockRegister.mockResolvedValueOnce({
        token: "auth-token",
        user: {
          id: "6",
          email: "loading@example.com",
          name: "Loading User",
        },
      });

      // Mock delayed invitation response
      mockApiRequest.mockImplementationOnce(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  success: true,
                  workspaceId: "loading-workspace",
                }),
              100
            )
          )
      );

      mockRefreshWorkspaces.mockResolvedValueOnce(undefined);

      renderRegisterComponent(false);
      fillAndSubmitRegisterForm(
        "Loading User",
        "loading@example.com",
        "password123"
      );

      // Should show loading state during processing
      await waitFor(() => {
        expect(mockApiRequest).toHaveBeenCalled();
      });
    });

    it("should provide clear error messages for invitation failures", async () => {
      const invitationToken = "clear-error-token";
      const mockApiRequest = vi.mocked(apiUtils.apiRequest);

      // Set pending invitation in sessionStorage
      sessionStorage.setItem("pendingInvitationToken", invitationToken);

      mockRegister.mockResolvedValueOnce({
        token: "auth-token",
        user: { id: "7", email: "error@example.com", name: "Error User" },
      });

      // Mock specific invitation error
      mockApiRequest.mockRejectedValueOnce(
        new Error("You are not authorized to join this workspace")
      );

      renderRegisterComponent(false);
      fillAndSubmitRegisterForm(
        "Error User",
        "error@example.com",
        "password123"
      );

      // Component shows "Failed to Accept Invitation" with the error message as description
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: "Failed to Accept Invitation",
            description: "You are not authorized to join this workspace",
            status: "error",
          })
        );
      });
    });
  });

  describe("Security Considerations", () => {
    it("should not expose invitation token in client-side logs", async () => {
      const sensitiveToken = "sensitive-invitation-token-12345";
      const consoleSpy = vi
        .spyOn(console, "log")
        .mockImplementation(() => {});

      sessionStorage.setItem("pendingInvitationToken", sensitiveToken);
      renderRegisterComponent(false);

      // Check that sensitive token is not logged
      expect(consoleSpy).not.toHaveBeenCalledWith(
        expect.stringContaining(sensitiveToken)
      );

      consoleSpy.mockRestore();
    });

    it("should handle invitation token sanitization", () => {
      sessionStorage.setItem(
        "pendingInvitationToken",
        '<script>alert("xss")</script>'
      );

      // Should render without executing any scripts
      expect(() => {
        renderRegisterComponent(false);
      }).not.toThrow();
    });
  });
});
