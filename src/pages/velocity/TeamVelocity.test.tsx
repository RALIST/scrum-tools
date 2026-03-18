import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ChakraProvider } from '@chakra-ui/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HelmetProvider } from 'react-helmet-async';
import React from 'react';

import TeamVelocity from './TeamVelocity';
import { AuthContext } from '../../contexts/AuthContext';
import { WorkspaceContext } from '../../contexts/WorkspaceContext';

// --- Mocks ---
const mockNavigate = vi.fn();
const mockToast = vi.fn();

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('@chakra-ui/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@chakra-ui/react')>();
  return {
    ...actual,
    useToast: () => mockToast,
  };
});

vi.mock('../../utils/apiUtils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/apiUtils')>();
  return {
    ...actual,
    apiRequest: vi.fn(),
  };
});

vi.mock('../../components/velocity', () => ({
  VelocityStats: ({ averages }: { averages: unknown }) => (
    <div data-testid="velocity-stats">{JSON.stringify(averages)}</div>
  ),
  TeamSetupForm: (props: {
    teamName: string;
    teamPassword: string;
    isTeamLoaded: boolean;
    errors: Record<string, string | undefined>;
    onNameChange: (v: string) => void;
    onPasswordChange: (v: string) => void;
    onSubmit: () => void;
    onChangeTeam: () => void;
    onAddSprintClick: () => void;
    isLoading: boolean;
  }) => (
    <div data-testid="team-setup-form">
      <span data-testid="form-team-name">{props.teamName}</span>
      <span data-testid="form-errors">{JSON.stringify(props.errors)}</span>
      <button data-testid="form-submit" onClick={props.onSubmit}>
        Submit
      </button>
      <button data-testid="form-change-team" onClick={props.onChangeTeam}>
        Change Team
      </button>
      <button data-testid="form-add-sprint" onClick={props.onAddSprintClick}>
        Add Sprint
      </button>
    </div>
  ),
  WorkspaceTeamHeader: (props: {
    currentWorkspace: unknown;
    workspaceMembers: unknown[];
    isTeamLoaded: boolean;
    onAddSprintClick: () => void;
  }) => (
    <div data-testid="workspace-team-header">
      <span data-testid="header-team-loaded">{String(props.isTeamLoaded)}</span>
      <button data-testid="header-add-sprint" onClick={props.onAddSprintClick}>
        Add Sprint
      </button>
    </div>
  ),
}));

vi.mock('../../components/velocity/VelocityChart', () => ({
  default: () => <div data-testid="velocity-chart">Chart</div>,
}));

vi.mock('../../components/modals', () => ({
  AddSprintModal: (props: { isOpen: boolean; onClose: () => void }) => (
    <div data-testid="add-sprint-modal">
      {props.isOpen ? 'open' : 'closed'}
    </div>
  ),
}));

vi.mock('../../components/PageContainer', () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="page-container">{children}</div>
  ),
}));

vi.mock('../../components/PageHelmet', () => ({
  default: () => <div data-testid="page-helmet" />,
}));

vi.mock('../../components/SeoText', () => ({
  default: () => <div data-testid="seo-text" />,
}));

vi.mock('../../content/teamVelocitySeo', () => ({
  teamVelocitySeo: {
    title: 'Test Velocity Title',
    description: 'Test description',
    keywords: 'test',
    content: {
      heading: 'Team Velocity Tracker',
      subheading: 'Track your velocity',
      features: ['feature1'],
    },
  },
  teamVelocitySeoSections: [],
}));

// --- Test Setup ---
const createQueryClient = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

const defaultAuthValue = {
  user: null as { id: string; name: string; email: string } | null,
  token: null as string | null,
  isAuthenticated: false,
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  isLoading: false,
};

type Workspace = {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  created_at: string;
  role: string;
};

const defaultWorkspaceValue = {
  workspaces: null as Workspace[] | null,
  currentWorkspace: null as Workspace | null,
  setCurrentWorkspace: vi.fn(),
  createWorkspace: vi.fn(),
  updateWorkspace: vi.fn(),
  addWorkspaceMember: vi.fn(),
  removeWorkspaceMember: vi.fn(),
  getWorkspaceMembers: vi.fn(),
  isLoading: false,
  refreshWorkspaces: vi.fn(),
};

const renderComponent = (
  authOverrides: Partial<typeof defaultAuthValue> = {},
  workspaceOverrides: Partial<typeof defaultWorkspaceValue> = {}
) => {
  const queryClient = createQueryClient();
  return render(
    <HelmetProvider>
      <ChakraProvider>
        <AuthContext.Provider value={{ ...defaultAuthValue, ...authOverrides }}>
          <WorkspaceContext.Provider
            value={{ ...defaultWorkspaceValue, ...workspaceOverrides }}
          >
            <QueryClientProvider client={queryClient}>
              <MemoryRouter initialEntries={['/velocity']}>
                <Routes>
                  <Route path="/velocity" element={<TeamVelocity />} />
                </Routes>
              </MemoryRouter>
            </QueryClientProvider>
          </WorkspaceContext.Provider>
        </AuthContext.Provider>
      </ChakraProvider>
    </HelmetProvider>
  );
};

describe('TeamVelocity Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading spinner when auth is loading', () => {
    renderComponent({ isLoading: true });
    // When auth is loading, the component returns a Spinner, not the main content
    expect(screen.queryByText('Team Velocity Tracker')).not.toBeInTheDocument();
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('shows loading spinner when workspace is loading for authenticated user', () => {
    renderComponent(
      { isAuthenticated: true, isLoading: false },
      { isLoading: true }
    );
    expect(screen.queryByText('Team Velocity Tracker')).not.toBeInTheDocument();
  });

  it('renders heading from SEO content', () => {
    renderComponent();
    expect(screen.getByText('Team Velocity Tracker')).toBeInTheDocument();
  });

  it('renders subheading from SEO content', () => {
    renderComponent();
    expect(screen.getByText('Track your velocity')).toBeInTheDocument();
  });

  it('shows TeamSetupForm for unauthenticated users', () => {
    renderComponent({ isAuthenticated: false });
    expect(screen.getByTestId('team-setup-form')).toBeInTheDocument();
    expect(
      screen.queryByTestId('workspace-team-header')
    ).not.toBeInTheDocument();
  });

  it('shows WorkspaceTeamHeader for authenticated users with workspace', () => {
    const workspace = {
      id: 'ws-1',
      name: 'Test Workspace',
      description: null,
      owner_id: 'user-1',
      created_at: '2024-01-01',
      role: 'owner',
    };
    renderComponent(
      {
        isAuthenticated: true,
        user: { id: 'user-1', name: 'Test User', email: 'test@test.com' },
        token: 'fake-token',
      },
      { currentWorkspace: workspace }
    );
    expect(screen.getByTestId('workspace-team-header')).toBeInTheDocument();
    expect(screen.queryByTestId('team-setup-form')).not.toBeInTheDocument();
  });

  it('shows "No sprint data" alert in workspace mode with no data', async () => {
    const workspace = {
      id: 'ws-1',
      name: 'Test Workspace',
      description: null,
      owner_id: 'user-1',
      created_at: '2024-01-01',
      role: 'owner',
    };
    // For workspace mode, the query is enabled but will return empty by default
    // since apiRequest is mocked. The query will settle as error (no mock response).
    // We need to make the query return empty data.
    const { apiRequest } = await import('../../utils/apiUtils');
    (apiRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
      sprints: [],
      averages: null,
    });

    renderComponent(
      {
        isAuthenticated: true,
        user: { id: 'user-1', name: 'Test User', email: 'test@test.com' },
        token: 'fake-token',
      },
      { currentWorkspace: workspace }
    );

    // Wait for the "No sprint data" alert to appear
    const alert = await screen.findByText(
      /No sprint data available/i
    );
    expect(alert).toBeInTheDocument();
  });

  it('renders PageContainer and SeoText', () => {
    renderComponent();
    expect(screen.getByTestId('page-container')).toBeInTheDocument();
    expect(screen.getByTestId('seo-text')).toBeInTheDocument();
  });

  it('renders AddSprintModal in closed state by default', () => {
    renderComponent();
    expect(screen.getByTestId('add-sprint-modal')).toBeInTheDocument();
    expect(screen.getByTestId('add-sprint-modal').textContent).toBe('closed');
  });

  it('shows VelocityStats when data is loaded in workspace mode', async () => {
    const workspace = {
      id: 'ws-1',
      name: 'Test Workspace',
      description: null,
      owner_id: 'user-1',
      created_at: '2024-01-01',
      role: 'owner',
    };
    const { apiRequest } = await import('../../utils/apiUtils');
    (apiRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
      sprints: [
        {
          sprint_id: 's1',
          sprint_name: 'Sprint 1',
          committed_points: 20,
          completed_points: 18,
          start_date: '2024-01-01',
          end_date: '2024-01-14',
          team_id: 't1',
        },
      ],
      averages: {
        average_velocity: 18,
        average_commitment: 20,
        completion_rate: 90,
      },
    });

    renderComponent(
      {
        isAuthenticated: true,
        user: { id: 'user-1', name: 'Test User', email: 'test@test.com' },
        token: 'fake-token',
      },
      { currentWorkspace: workspace }
    );

    const stats = await screen.findByTestId('velocity-stats');
    expect(stats).toBeInTheDocument();
  });
});
