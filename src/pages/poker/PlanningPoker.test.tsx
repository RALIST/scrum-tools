import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ChakraProvider } from "@chakra-ui/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HelmetProvider } from "react-helmet-async";
import React from "react";

import PlanningPoker from "./PlanningPoker";
import { AuthContext } from "../../contexts/AuthContext";
import { WorkspaceContext } from "../../contexts/WorkspaceContext";

// --- Mocks ---
const mockNavigate = vi.fn();
const mockToast = vi.fn();

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("@chakra-ui/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@chakra-ui/react")>();
  return {
    ...actual,
    useToast: () => mockToast,
  };
});

vi.mock("../../utils/apiUtils", () => ({
  apiRequest: vi.fn().mockResolvedValue([]),
  AuthError: class AuthError extends Error {},
}));

vi.mock("../../components/poker/CreateRoomModal", () => ({
  CreateRoomModal: (props: { isOpen: boolean }) => (
    <div data-testid="create-room-modal">
      Modal isOpen: {props.isOpen.toString()}
    </div>
  ),
}));

vi.mock("../../components/poker/PokerLandingActions", () => ({
  PokerLandingActions: (props: {
    onShowRoomList: () => void;
    onCreateModalOpen: () => void;
  }) => (
    <div data-testid="poker-landing-actions">
      <button onClick={props.onShowRoomList}>Show Room List</button>
      <button onClick={props.onCreateModalOpen}>Create Room</button>
    </div>
  ),
}));

vi.mock("../../components/poker/RoomListTable", () => ({
  RoomListTable: (props: { title: string }) => (
    <div data-testid="room-list-table">Table: {props.title}</div>
  ),
}));

vi.mock("../../components/SeoText", () => ({
  default: () => <div data-testid="seo-text" />,
}));

vi.mock("../../components/PageContainer", () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="page-container">{children}</div>
  ),
}));

vi.mock("../../components/PageHelmet", () => ({
  default: () => null,
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

const defaultWorkspaceValue = {
  workspaces: [] as Array<{
    id: string;
    name: string;
    description: string | null;
    owner_id: string;
    created_at: string;
    role: string;
  }>,
  currentWorkspace: null as {
    id: string;
    name: string;
    description: string | null;
    owner_id: string;
    created_at: string;
    role: string;
  } | null,
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
    <QueryClientProvider client={queryClient}>
      <HelmetProvider>
        <ChakraProvider>
          <AuthContext.Provider
            value={{ ...defaultAuthValue, ...authOverrides }}
          >
            <WorkspaceContext.Provider
              value={{ ...defaultWorkspaceValue, ...workspaceOverrides }}
            >
              <MemoryRouter initialEntries={["/planning-poker"]}>
                <Routes>
                  <Route
                    path="/planning-poker"
                    element={<PlanningPoker />}
                  />
                </Routes>
              </MemoryRouter>
            </WorkspaceContext.Provider>
          </AuthContext.Provider>
        </ChakraProvider>
      </HelmetProvider>
    </QueryClientProvider>
  );
};

describe("PlanningPoker Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the heading 'Online Planning Poker'", () => {
    renderComponent();
    expect(
      screen.getByRole("heading", {
        name: /online planning poker/i,
      })
    ).toBeInTheDocument();
  });

  it("shows spinner when authenticated and workspaces are loading (null)", () => {
    renderComponent(
      { isAuthenticated: true, user: { id: "u1", name: "User", email: "u@test.com" } },
      { workspaces: null as unknown as typeof defaultWorkspaceValue.workspaces }
    );

    // When authenticated and workspaces is null, should show spinner instead of main content
    expect(
      screen.queryByRole("heading", { name: /online planning poker/i })
    ).not.toBeInTheDocument();
  });

  it("shows landing actions when not showing room list", () => {
    renderComponent();
    expect(screen.getByTestId("poker-landing-actions")).toBeInTheDocument();
    expect(screen.queryByTestId("room-list-table")).not.toBeInTheDocument();
  });

  it("toggles to room list view when 'Show Room List' is clicked", async () => {
    renderComponent();

    expect(screen.getByTestId("poker-landing-actions")).toBeInTheDocument();
    expect(screen.queryByTestId("room-list-table")).not.toBeInTheDocument();

    const showListButton = screen.getByRole("button", {
      name: /show room list/i,
    });
    await userEvent.click(showListButton);

    await waitFor(() => {
      expect(screen.getByTestId("room-list-table")).toBeInTheDocument();
    });
    expect(
      screen.queryByTestId("poker-landing-actions")
    ).not.toBeInTheDocument();
  });

  it("shows 'Public Rooms' heading when no workspace is selected", async () => {
    renderComponent();

    const showListButton = screen.getByRole("button", {
      name: /show room list/i,
    });
    await userEvent.click(showListButton);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /public rooms/i })
      ).toBeInTheDocument();
    });
  });

  it("shows workspace room heading when workspace is selected", async () => {
    const workspace = {
      id: "ws-1",
      name: "My Team",
      description: null,
      owner_id: "u1",
      created_at: "2024-01-01",
      role: "owner",
    };

    renderComponent(
      {
        isAuthenticated: true,
        user: { id: "u1", name: "User", email: "u@test.com" },
      },
      {
        workspaces: [workspace],
        currentWorkspace: workspace,
      }
    );

    const showListButton = screen.getByRole("button", {
      name: /show room list/i,
    });
    await userEvent.click(showListButton);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /rooms in my team/i })
      ).toBeInTheDocument();
    });
  });

  it("hides room list and shows landing actions when Back button is clicked", async () => {
    renderComponent();

    // Show room list
    await userEvent.click(
      screen.getByRole("button", { name: /show room list/i })
    );
    await waitFor(() => {
      expect(screen.getByTestId("room-list-table")).toBeInTheDocument();
    });

    // Click Back
    await userEvent.click(screen.getByRole("button", { name: /back/i }));

    await waitFor(() => {
      expect(screen.getByTestId("poker-landing-actions")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("room-list-table")).not.toBeInTheDocument();
  });

  it("renders the SEO text section", () => {
    renderComponent();
    expect(screen.getByTestId("seo-text")).toBeInTheDocument();
  });
});
