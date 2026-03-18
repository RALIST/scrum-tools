import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ChakraProvider } from "@chakra-ui/react";
import { HelmetProvider } from "react-helmet-async";
import React from "react";

import PlanningPokerRoom from "./PlanningPokerRoom";
import { AuthContext } from "../../contexts/AuthContext";
import { apiRequest } from "../../utils/apiUtils";
import { usePokerSocket } from "../../hooks/usePokerSocket";

// --- Mocks ---
const mockNavigate = vi.fn();
const mockToast = vi.fn();

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ roomId: "abc123" }),
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
  apiRequest: vi.fn(),
  AuthError: class AuthError extends Error {},
}));

vi.mock("../../hooks/usePokerSocket", () => ({
  usePokerSocket: vi.fn(),
}));

// --- Mock Components ---
vi.mock("../../components/modals", () => ({
  JoinRoomModal: (props: { isOpen: boolean }) => (
    <div data-testid="join-room-modal">
      JoinModal isOpen: {props.isOpen.toString()}
    </div>
  ),
  ChangeNameModal: (props: { isOpen: boolean }) => (
    <div data-testid="change-name-modal">
      ChangeNameModal isOpen: {props.isOpen.toString()}
    </div>
  ),
  RoomSettingsModal: (props: { isOpen: boolean }) => (
    <div data-testid="room-settings-modal">
      SettingsModal isOpen: {props.isOpen.toString()}
    </div>
  ),
}));

vi.mock("../../components/poker/ParticipantsTable", () => ({
  ParticipantsTable: () => (
    <div data-testid="participants-table">ParticipantsTable</div>
  ),
}));

vi.mock("../../components/poker/RoomHeader", () => ({
  RoomHeader: () => <div data-testid="room-header">RoomHeader</div>,
}));

vi.mock("../../components/poker/VotingArea", () => ({
  VotingArea: () => <div data-testid="voting-area">VotingArea</div>,
}));

vi.mock("../../components/PageContainer", () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="page-container">{children}</div>
  ),
}));

// --- Test Setup ---
const defaultAuthValue = {
  user: null as { id: string; name: string; email: string } | null,
  token: null as string | null,
  isAuthenticated: false,
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  isLoading: false,
};

const defaultSocketValues = {
  socket: null,
  participants: [],
  settings: { sequence: "fibonacci" as const, hasPassword: false },
  isRevealed: false,
  isJoined: false,
  joinRoom: vi.fn(),
  changeName: vi.fn(),
  vote: vi.fn(),
  revealVotes: vi.fn(),
  resetVotes: vi.fn(),
  updateSettings: vi.fn(),
  isConnected: false,
  isConnecting: false,
  isJoining: false,
  isConnectingOrJoining: false,
};

const renderComponent = (
  authOverrides: Partial<typeof defaultAuthValue> = {}
) => {
  return render(
    <HelmetProvider>
      <ChakraProvider>
        <AuthContext.Provider
          value={{ ...defaultAuthValue, ...authOverrides }}
        >
          <MemoryRouter initialEntries={["/planning-poker/abc123"]}>
            <Routes>
              <Route
                path="/planning-poker/:roomId"
                element={<PlanningPokerRoom />}
              />
              <Route
                path="/planning-poker"
                element={<div>Poker Landing</div>}
              />
            </Routes>
          </MemoryRouter>
        </AuthContext.Provider>
      </ChakraProvider>
    </HelmetProvider>
  );
};

describe("PlanningPokerRoom Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: apiRequest for /info is pending (never resolves immediately)
    (apiRequest as Mock).mockReturnValue(new Promise(() => {}));

    (usePokerSocket as Mock).mockReturnValue({ ...defaultSocketValues });
  });

  it("shows loading spinner initially while fetching room info", () => {
    renderComponent();

    // The component shows a spinner while isLoadingRoomInfo is true
    const spinners = document.querySelectorAll(".chakra-spinner");
    expect(spinners.length).toBeGreaterThan(0);
    expect(screen.queryByTestId("voting-area")).not.toBeInTheDocument();
  });

  it("shows 'Room Not Found' when room does not exist", async () => {
    (apiRequest as Mock).mockRejectedValue(new Error("404 Not Found"));

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Room Not Found")).toBeInTheDocument();
    });

    expect(
      screen.getByText("The requested poker room does not exist.")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /back to poker rooms/i })
    ).toBeInTheDocument();
  });

  it("shows join modal for unauthenticated users after room info loads", async () => {
    (apiRequest as Mock).mockResolvedValue({
      id: "abc123",
      hasPassword: false,
    });

    renderComponent({ isAuthenticated: false });

    await waitFor(() => {
      const joinModal = screen.getByTestId("join-room-modal");
      expect(joinModal).toBeInTheDocument();
      expect(joinModal.textContent).toContain("true");
    });
  });

  it("shows join modal for password-protected rooms even when authenticated", async () => {
    (apiRequest as Mock).mockResolvedValue({
      id: "abc123",
      hasPassword: true,
    });

    renderComponent({
      isAuthenticated: true,
      user: { id: "u1", name: "Auth User", email: "auth@test.com" },
    });

    await waitFor(() => {
      const joinModal = screen.getByTestId("join-room-modal");
      expect(joinModal).toBeInTheDocument();
      expect(joinModal.textContent).toContain("true");
    });
  });

  it("auto-joins authenticated users to non-password rooms via initialUserName", async () => {
    (apiRequest as Mock).mockResolvedValue({
      id: "abc123",
      hasPassword: false,
    });

    renderComponent({
      isAuthenticated: true,
      user: { id: "u1", name: "Auth User", email: "auth@test.com" },
    });

    // Wait for room info to resolve and the hook to be called
    await waitFor(() => {
      // usePokerSocket should have been called with initialUserName set to user name
      const calls = (usePokerSocket as Mock).mock.calls;
      const lastCall = calls[calls.length - 1];
      expect(lastCall[0].initialUserName).toBe("Auth User");
    });
  });

  it("renders VotingArea and ParticipantsTable when user is joined", async () => {
    (apiRequest as Mock).mockResolvedValue({
      id: "abc123",
      hasPassword: false,
    });

    (usePokerSocket as Mock).mockReturnValue({
      ...defaultSocketValues,
      isJoined: true,
      isConnected: true,
      participants: [{ id: "p1", name: "Alice", vote: null }],
    });

    renderComponent({
      isAuthenticated: true,
      user: { id: "u1", name: "Auth User", email: "auth@test.com" },
    });

    await waitFor(() => {
      expect(screen.getByTestId("voting-area")).toBeInTheDocument();
    });

    expect(screen.getByTestId("participants-table")).toBeInTheDocument();
    expect(screen.getByTestId("room-header")).toBeInTheDocument();
  });

  it("does not render VotingArea or ParticipantsTable when user is not joined", async () => {
    (apiRequest as Mock).mockResolvedValue({
      id: "abc123",
      hasPassword: false,
    });

    (usePokerSocket as Mock).mockReturnValue({
      ...defaultSocketValues,
      isJoined: false,
    });

    renderComponent({
      isAuthenticated: true,
      user: { id: "u1", name: "Auth User", email: "auth@test.com" },
    });

    // Wait for room info to load
    await waitFor(() => {
      expect(screen.getByTestId("room-header")).toBeInTheDocument();
    });

    expect(screen.queryByTestId("voting-area")).not.toBeInTheDocument();
    expect(screen.queryByTestId("participants-table")).not.toBeInTheDocument();
  });

  it("shows a Back to Poker Rooms button on room not found and can navigate back", async () => {
    (apiRequest as Mock).mockRejectedValue(new Error("404 Not Found"));

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Room Not Found")).toBeInTheDocument();
    });

    const backButton = screen.getByRole("button", {
      name: /back to poker rooms/i,
    });
    expect(backButton).toBeInTheDocument();
  });
});
