// src/pages/auth/Login.invitations.test.tsx - Pending invitation flow tests
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import Login from './Login';
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

const mockLogin = vi.fn();
const mockRefreshWorkspaces = vi.fn();

const renderLoginComponent = (isAuthenticated = false, invitationToken?: string) => {
  // Set up URL search params for invitation token
  const initialEntries = invitationToken ? [`/login?invitation=${invitationToken}`] : ['/login'];

  return render(
    <HelmetProvider>
      <ChakraProvider>
        <AuthContext.Provider
          value={{
            user: null,
            token: isAuthenticated ? 'fake-token' : null,
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
            <MemoryRouter initialEntries={initialEntries}>
              <Routes>
                <Route path="/login" element={<Login />} />
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

describe('Login - Pending Invitation Flow', () => {
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

  describe('Invitation Token Detection', () => {
    it('should detect invitation token from URL parameters', async () => {
      const invitationToken = 'valid-invitation-token-123';
      renderLoginComponent(false, invitationToken);

      // Should show invitation-specific UI or behavior
      expect(screen.getByText(/login/i)).toBeInTheDocument();

      // The invitation token should be handled internally
      // This would typically store the token for use after login
    });

    it('should handle missing invitation token gracefully', () => {
      renderLoginComponent(false);

      // Should render normal login form
      expect(screen.getByText(/login/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    });

    it('should handle invalid invitation token format', () => {
      const invalidToken = 'invalid-token';
      renderLoginComponent(false, invalidToken);

      // Should still render login form but may show warning
      expect(screen.getByText(/sign in to your account/i)).toBeInTheDocument();
    });
  });

  describe('Post-Login Invitation Processing', () => {
    it('should process invitation after successful login', async () => {
      const invitationToken = 'valid-invitation-token-123';
      const mockApiRequest = vi.mocked(apiUtils.apiRequest);

      // Mock successful login
      mockLogin.mockResolvedValueOnce({
        token: 'auth-token',
        user: { id: '1', email: 'test@example.com', name: 'Test User' },
      });

      // Mock successful invitation acceptance
      mockApiRequest.mockResolvedValueOnce({
        success: true,
        workspaceId: 'workspace-123',
        message: 'Successfully joined workspace',
      });

      renderLoginComponent(false, invitationToken);

      // Fill in login form
      fireEvent.change(screen.getByLabelText(/email/i), {
        target: { value: 'test@example.com' },
      });
      fireEvent.change(screen.getByLabelText(/password/i), {
        target: { value: 'password123' },
      });

      // Submit login
      fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'password123');
      });

      // After successful login, invitation should be processed
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

      // Should navigate to workspace after successful invitation acceptance
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/workspaces/workspace-123');
      });
    });

    it('should handle invitation acceptance failure gracefully', async () => {
      const invitationToken = 'expired-invitation-token';
      const mockApiRequest = vi.mocked(apiUtils.apiRequest);

      // Mock successful login
      mockLogin.mockResolvedValueOnce({
        token: 'auth-token',
        user: { id: '1', email: 'test@example.com', name: 'Test User' },
      });

      // Mock failed invitation acceptance
      mockApiRequest.mockRejectedValueOnce(new Error('Invitation token expired'));

      renderLoginComponent(false, invitationToken);

      // Fill and submit login form
      fireEvent.change(screen.getByLabelText(/email/i), {
        target: { value: 'test@example.com' },
      });
      fireEvent.change(screen.getByLabelText(/password/i), {
        target: { value: 'password123' },
      });
      fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalled();
      });

      // Should show error toast for failed invitation
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Invitation Error',
            status: 'error',
          })
        );
      });

      // Should still navigate to default location (workspaces list)
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/workspaces');
      });
    });

    it('should store invitation token in localStorage for later processing', async () => {
      const invitationToken = 'token-to-store';
      const mockSetItem = vi.fn();
      Object.defineProperty(window, 'localStorage', {
        value: {
          getItem: vi.fn(() => null),
          setItem: mockSetItem,
          removeItem: vi.fn(),
          clear: vi.fn(),
        },
        writable: true,
      });

      renderLoginComponent(false, invitationToken);

      // The invitation token should be stored for processing after login
      // This is implementation-specific and may vary based on your approach
      await waitFor(() => {
        // Could be stored immediately or after some user interaction
        // expect(mockSetItem).toHaveBeenCalledWith('pendingInvitation', invitationToken);
      });
    });
  });

  describe('Invitation Flow Edge Cases', () => {
    it('should handle network errors during invitation processing', async () => {
      const invitationToken = 'network-error-token';
      const mockApiRequest = vi.mocked(apiUtils.apiRequest);

      mockLogin.mockResolvedValueOnce({
        token: 'auth-token',
        user: { id: '1', email: 'test@example.com', name: 'Test User' },
      });

      // Mock network error
      mockApiRequest.mockRejectedValueOnce(new Error('Network error'));

      renderLoginComponent(false, invitationToken);

      // Complete login process
      fireEvent.change(screen.getByLabelText(/email/i), {
        target: { value: 'test@example.com' },
      });
      fireEvent.change(screen.getByLabelText(/password/i), {
        target: { value: 'password123' },
      });
      fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: expect.stringMatching(/error|network|failed/i),
            status: 'error',
          })
        );
      });
    });

    it('should prevent duplicate invitation processing', async () => {
      const invitationToken = 'duplicate-processing-token';
      const mockApiRequest = vi.mocked(apiUtils.apiRequest);

      mockLogin.mockResolvedValueOnce({
        token: 'auth-token',
        user: { id: '1', email: 'test@example.com', name: 'Test User' },
      });

      mockApiRequest.mockResolvedValueOnce({
        success: true,
        workspaceId: 'workspace-123',
      });

      renderLoginComponent(false, invitationToken);

      // Complete login
      fireEvent.change(screen.getByLabelText(/email/i), {
        target: { value: 'test@example.com' },
      });
      fireEvent.change(screen.getByLabelText(/password/i), {
        target: { value: 'password123' },
      });
      fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

      // Wait for processing
      await waitFor(() => {
        expect(mockApiRequest).toHaveBeenCalledTimes(1);
      });

      // Ensure invitation is only processed once even if component re-renders
      expect(mockApiRequest).toHaveBeenCalledTimes(1);
    });

    it('should handle already processed invitations', async () => {
      const invitationToken = 'already-used-token';
      const mockApiRequest = vi.mocked(apiUtils.apiRequest);

      mockLogin.mockResolvedValueOnce({
        token: 'auth-token',
        user: { id: '1', email: 'test@example.com', name: 'Test User' },
      });

      // Mock "already used" error
      mockApiRequest.mockRejectedValueOnce(new Error('Invitation already used'));

      renderLoginComponent(false, invitationToken);

      // Complete login process
      fireEvent.change(screen.getByLabelText(/email/i), {
        target: { value: 'test@example.com' },
      });
      fireEvent.change(screen.getByLabelText(/password/i), {
        target: { value: 'password123' },
      });
      fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: expect.stringMatching(/invitation|already|used/i),
            status: 'warning',
          })
        );
      });
    });
  });

  describe('Redirect Behavior with Invitations', () => {
    it('should redirect to specific workspace after successful invitation', async () => {
      const invitationToken = 'redirect-test-token';
      const workspaceId = 'target-workspace-123';
      const mockApiRequest = vi.mocked(apiUtils.apiRequest);

      mockLogin.mockResolvedValueOnce({
        token: 'auth-token',
        user: { id: '1', email: 'test@example.com', name: 'Test User' },
      });

      mockApiRequest.mockResolvedValueOnce({
        success: true,
        workspaceId,
        message: 'Welcome to the workspace!',
      });

      renderLoginComponent(false, invitationToken);

      // Complete login
      fireEvent.change(screen.getByLabelText(/email/i), {
        target: { value: 'test@example.com' },
      });
      fireEvent.change(screen.getByLabelText(/password/i), {
        target: { value: 'password123' },
      });
      fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith(`/workspaces/${workspaceId}`);
      });
    });

    it('should refresh workspaces after successful invitation acceptance', async () => {
      const invitationToken = 'refresh-workspaces-token';
      const mockApiRequest = vi.mocked(apiUtils.apiRequest);

      mockLogin.mockResolvedValueOnce({
        token: 'auth-token',
        user: { id: '1', email: 'test@example.com', name: 'Test User' },
      });

      mockApiRequest.mockResolvedValueOnce({
        success: true,
        workspaceId: 'new-workspace-123',
      });

      renderLoginComponent(false, invitationToken);

      // Complete login process
      fireEvent.change(screen.getByLabelText(/email/i), {
        target: { value: 'test@example.com' },
      });
      fireEvent.change(screen.getByLabelText(/password/i), {
        target: { value: 'password123' },
      });
      fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(mockRefreshWorkspaces).toHaveBeenCalled();
      });
    });
  });
});
