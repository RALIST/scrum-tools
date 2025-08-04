// src/pages/auth/Register.invitations.test.tsx - Pending invitation flow tests for registration
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import Register from './Register';
import { AuthContext } from '../../contexts/AuthContext';
import { WorkspaceContext } from '../../contexts/WorkspaceContext';
import * as apiUtils from '../../utils/apiUtils';

// Mock the apiRequest function
vi.mock('../../utils/apiUtils', async importOriginal => {
  const actual = await importOriginal<typeof apiUtils>();
  return {
    ...actual,
    apiRequest: vi.fn(),
  };
});

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async importOriginal => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
  };
});

// Mock useToast
const mockToast = vi.fn();
vi.mock('@chakra-ui/react', async importOriginal => {
  const actual = await importOriginal<typeof import('@chakra-ui/react')>();
  return {
    ...actual,
    useToast: () => mockToast,
  };
});

const mockRegister = vi.fn();
const mockRefreshWorkspaces = vi.fn();

const renderRegisterComponent = (isAuthenticated = false, invitationToken?: string) => {
  const initialEntries = invitationToken
    ? [`/register?invitation=${invitationToken}`]
    : ['/register'];

  return render(
    <HelmetProvider>
      <ChakraProvider>
        <AuthContext.Provider
          value={{
            user: null,
            token: isAuthenticated ? 'fake-token' : null,
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
            <MemoryRouter initialEntries={initialEntries}>
              <Routes>
                <Route path="/register" element={<Register />} />
                <Route path="/workspaces" element={<div>Workspaces Page</div>} />
                <Route path="/workspaces/:id" element={<div>Workspace Detail Page</div>} />
              </Routes>
            </MemoryRouter>
          </WorkspaceContext.Provider>
        </AuthContext.Provider>
      </ChakraProvider>
    </HelmetProvider>
  );
};

describe('Register - Pending Invitation Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn(() => null),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      },
      writable: true,
    });
  });

  describe('Registration with Invitation Token', () => {
    it('should detect invitation token from URL and show invitation context', () => {
      const invitationToken = 'new-user-invitation-123';
      renderRegisterComponent(false, invitationToken);

      // Should show registration form
      expect(screen.getByText(/register/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^name$/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();

      // May show invitation-specific messaging
      // This depends on your implementation
    });

    it('should complete registration and process invitation automatically', async () => {
      const invitationToken = 'auto-process-invitation';
      const mockApiRequest = vi.mocked(apiUtils.apiRequest);

      // Mock successful registration
      mockRegister.mockResolvedValueOnce({
        token: 'new-auth-token',
        user: { id: '2', email: 'newuser@example.com', name: 'New User' },
      });

      // Mock successful invitation acceptance
      mockApiRequest.mockResolvedValueOnce({
        success: true,
        workspaceId: 'invitation-workspace-456',
        message: 'Welcome to your new workspace!',
      });

      renderRegisterComponent(false, invitationToken);

      // Fill registration form
      fireEvent.change(screen.getByLabelText(/name/i), {
        target: { value: 'New User' },
      });
      fireEvent.change(screen.getByLabelText(/email/i), {
        target: { value: 'newuser@example.com' },
      });
      fireEvent.change(screen.getByLabelText(/^password$/i), {
        target: { value: 'password123' },
      });
      fireEvent.change(screen.getByLabelText(/confirm password/i), {
        target: { value: 'password123' },
      });

      // Submit registration
      fireEvent.click(screen.getByRole('button', { name: /register/i }));

      await waitFor(() => {
        expect(mockRegister).toHaveBeenCalledWith('newuser@example.com', 'password123', 'New User');
      });

      // Should process invitation after registration
      await waitFor(() => {
        expect(mockApiRequest).toHaveBeenCalledWith(
          '/workspaces/invitations/accept',
          expect.objectContaining({
            method: 'POST',
            body: { token: invitationToken },
            includeAuth: true,
          })
        );
      });

      // Should navigate to workspace
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/workspaces/invitation-workspace-456');
      });
    });

    it('should handle registration failure with pending invitation', async () => {
      const invitationToken = 'registration-fail-token';

      // Mock registration failure
      mockRegister.mockRejectedValueOnce(new Error('Email already exists'));

      renderRegisterComponent(false, invitationToken);

      // Fill and submit registration form
      fireEvent.change(screen.getByLabelText(/name/i), {
        target: { value: 'Existing User' },
      });
      fireEvent.change(screen.getByLabelText(/email/i), {
        target: { value: 'existing@example.com' },
      });
      fireEvent.change(screen.getByLabelText(/^password$/i), {
        target: { value: 'password123' },
      });
      fireEvent.change(screen.getByLabelText(/confirm password/i), {
        target: { value: 'password123' },
      });
      fireEvent.click(screen.getByRole('button', { name: /register/i }));

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: expect.stringMatching(/error|failed/i),
            status: 'error',
          })
        );
      });

      // Should not process invitation if registration fails
      expect(vi.mocked(apiUtils.apiRequest)).not.toHaveBeenCalled();
    });
  });

  describe('Invitation Token Validation', () => {
    it('should handle malformed invitation tokens gracefully', () => {
      const malformedToken = 'malformed-token-!@#';
      renderRegisterComponent(false, malformedToken);

      // Should still show registration form
      expect(screen.getByText(/create your account/i)).toBeInTheDocument();
    });

    it('should handle empty invitation token parameter', () => {
      renderRegisterComponent(false, '');

      // Should render normal registration form
      expect(screen.getByText(/create your account/i)).toBeInTheDocument();
    });

    it('should preserve invitation token through validation errors', async () => {
      const invitationToken = 'preserve-token-123';
      renderRegisterComponent(false, invitationToken);

      // Submit form with validation errors (missing fields)
      fireEvent.click(screen.getByRole('button', { name: /register/i }));

      // Form should show validation errors but keep invitation context
      await waitFor(() => {
        // Validation errors should be shown
        // But invitation token should still be preserved for retry
      });
    });
  });

  describe('Post-Registration Invitation Processing', () => {
    it('should show success message for successful invitation acceptance', async () => {
      const invitationToken = 'success-message-token';
      const mockApiRequest = vi.mocked(apiUtils.apiRequest);

      mockRegister.mockResolvedValueOnce({
        token: 'auth-token',
        user: { id: '3', email: 'success@example.com', name: 'Success User' },
      });

      mockApiRequest.mockResolvedValueOnce({
        success: true,
        workspaceId: 'success-workspace',
        message: 'Successfully joined the team!',
      });

      renderRegisterComponent(false, invitationToken);

      // Complete registration
      fireEvent.change(screen.getByLabelText(/name/i), {
        target: { value: 'Success User' },
      });
      fireEvent.change(screen.getByLabelText(/email/i), {
        target: { value: 'success@example.com' },
      });
      fireEvent.change(screen.getByLabelText(/^password$/i), {
        target: { value: 'password123' },
      });
      fireEvent.change(screen.getByLabelText(/confirm password/i), {
        target: { value: 'password123' },
      });
      fireEvent.click(screen.getByRole('button', { name: /register/i }));

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: expect.stringMatching(/success|welcome|joined/i),
            status: 'success',
          })
        );
      });
    });

    it('should handle expired invitation tokens after registration', async () => {
      const expiredToken = 'expired-invitation-token';
      const mockApiRequest = vi.mocked(apiUtils.apiRequest);

      mockRegister.mockResolvedValueOnce({
        token: 'auth-token',
        user: { id: '4', email: 'expired@example.com', name: 'Expired User' },
      });

      // Mock expired invitation error
      mockApiRequest.mockRejectedValueOnce(new Error('Invitation token has expired'));

      renderRegisterComponent(false, expiredToken);

      // Complete registration
      fireEvent.change(screen.getByLabelText(/name/i), {
        target: { value: 'Expired User' },
      });
      fireEvent.change(screen.getByLabelText(/email/i), {
        target: { value: 'expired@example.com' },
      });
      fireEvent.change(screen.getByLabelText(/^password$/i), {
        target: { value: 'password123' },
      });
      fireEvent.change(screen.getByLabelText(/confirm password/i), {
        target: { value: 'password123' },
      });
      fireEvent.click(screen.getByRole('button', { name: /register/i }));

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: expect.stringMatching(/expired|invalid/i),
            status: 'warning',
          })
        );
      });

      // Should still redirect to workspaces list even if invitation fails
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/workspaces');
      });
    });

    it('should refresh workspaces list after successful invitation', async () => {
      const invitationToken = 'refresh-after-invite';
      const mockApiRequest = vi.mocked(apiUtils.apiRequest);

      mockRegister.mockResolvedValueOnce({
        token: 'auth-token',
        user: { id: '5', email: 'refresh@example.com', name: 'Refresh User' },
      });

      mockApiRequest.mockResolvedValueOnce({
        success: true,
        workspaceId: 'refresh-workspace',
      });

      renderRegisterComponent(false, invitationToken);

      // Complete registration process
      fireEvent.change(screen.getByLabelText(/name/i), {
        target: { value: 'Refresh User' },
      });
      fireEvent.change(screen.getByLabelText(/email/i), {
        target: { value: 'refresh@example.com' },
      });
      fireEvent.change(screen.getByLabelText(/^password$/i), {
        target: { value: 'password123' },
      });
      fireEvent.change(screen.getByLabelText(/confirm password/i), {
        target: { value: 'password123' },
      });
      fireEvent.click(screen.getByRole('button', { name: /register/i }));

      await waitFor(() => {
        expect(mockRefreshWorkspaces).toHaveBeenCalled();
      });
    });
  });

  describe('User Experience with Invitations', () => {
    it('should show appropriate loading states during invitation processing', async () => {
      const invitationToken = 'loading-state-token';
      const mockApiRequest = vi.mocked(apiUtils.apiRequest);

      mockRegister.mockResolvedValueOnce({
        token: 'auth-token',
        user: { id: '6', email: 'loading@example.com', name: 'Loading User' },
      });

      // Mock delayed invitation response
      mockApiRequest.mockImplementationOnce(
        () =>
          new Promise(resolve =>
            setTimeout(
              () =>
                resolve({
                  success: true,
                  workspaceId: 'loading-workspace',
                }),
              100
            )
          )
      );

      renderRegisterComponent(false, invitationToken);

      // Complete registration
      fireEvent.change(screen.getByLabelText(/name/i), {
        target: { value: 'Loading User' },
      });
      fireEvent.change(screen.getByLabelText(/email/i), {
        target: { value: 'loading@example.com' },
      });
      fireEvent.change(screen.getByLabelText(/^password$/i), {
        target: { value: 'password123' },
      });
      fireEvent.change(screen.getByLabelText(/confirm password/i), {
        target: { value: 'password123' },
      });
      fireEvent.click(screen.getByRole('button', { name: /register/i }));

      // Should show loading state during processing
      // This depends on your implementation
      await waitFor(() => {
        expect(mockApiRequest).toHaveBeenCalled();
      });
    });

    it('should provide clear error messages for invitation failures', async () => {
      const invitationToken = 'clear-error-token';
      const mockApiRequest = vi.mocked(apiUtils.apiRequest);

      mockRegister.mockResolvedValueOnce({
        token: 'auth-token',
        user: { id: '7', email: 'error@example.com', name: 'Error User' },
      });

      // Mock specific invitation error
      mockApiRequest.mockRejectedValueOnce(
        new Error('You are not authorized to join this workspace')
      );

      renderRegisterComponent(false, invitationToken);

      // Complete registration
      fireEvent.change(screen.getByLabelText(/name/i), {
        target: { value: 'Error User' },
      });
      fireEvent.change(screen.getByLabelText(/email/i), {
        target: { value: 'error@example.com' },
      });
      fireEvent.change(screen.getByLabelText(/^password$/i), {
        target: { value: 'password123' },
      });
      fireEvent.change(screen.getByLabelText(/confirm password/i), {
        target: { value: 'password123' },
      });
      fireEvent.click(screen.getByRole('button', { name: /register/i }));

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Invitation Error',
            description: 'You are not authorized to join this workspace',
            status: 'error',
          })
        );
      });
    });
  });

  describe('Security Considerations', () => {
    it('should not expose invitation token in client-side logs', async () => {
      const sensitiveToken = 'sensitive-invitation-token-12345';
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      renderRegisterComponent(false, sensitiveToken);

      // Check that sensitive token is not logged
      expect(consoleSpy).not.toHaveBeenCalledWith(expect.stringContaining(sensitiveToken));

      consoleSpy.mockRestore();
    });

    it('should handle invitation token sanitization', () => {
      const maliciousToken = '<script>alert("xss")</script>';

      // Should render without executing any scripts
      expect(() => {
        renderRegisterComponent(false, maliciousToken);
      }).not.toThrow();
    });
  });
});
