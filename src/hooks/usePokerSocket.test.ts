import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { usePokerSocket } from "./usePokerSocket";
import { useSocketManager } from "./useSocketManager";

// --- Mocks ---
const mockToast = vi.fn();
const mockEmit = vi.fn();

// Track registered event handlers on the mock socket
type EventHandler = (...args: unknown[]) => void;
let socketEventHandlers: Record<string, EventHandler>;

const createMockSocket = (connected = true) => ({
  id: "socket-123",
  on: vi.fn((event: string, handler: EventHandler) => {
    socketEventHandlers[event] = handler;
  }),
  off: vi.fn(),
  emit: mockEmit,
  connect: vi.fn(),
  active: true,
  connected,
});

let mockSocket: ReturnType<typeof createMockSocket> | null = null;
let mockIsConnected = false;
let mockIsConnecting = false;

vi.mock("./useSocketManager", () => ({
  useSocketManager: vi.fn(),
}));

vi.mock("@chakra-ui/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@chakra-ui/react")>();
  return {
    ...actual,
    useToast: () => mockToast,
  };
});

vi.mock("../utils/logger", () => ({
  createHookLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// --- Test Setup ---
const defaultProps = {
  roomId: "test-room",
  initialUserName: null,
  onRoomJoined: vi.fn(),
  onJoinError: vi.fn(),
};

describe("usePokerSocket", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    socketEventHandlers = {};
    mockSocket = createMockSocket();
    mockIsConnected = true;
    mockIsConnecting = false;

    (useSocketManager as Mock).mockReturnValue({
      socket: mockSocket,
      isConnected: mockIsConnected,
      isConnecting: mockIsConnecting,
    });
  });

  it("returns initial state with participants empty, isJoined false, isRevealed false", () => {
    const { result } = renderHook(() => usePokerSocket(defaultProps));

    expect(result.current.participants).toEqual([]);
    expect(result.current.isJoined).toBe(false);
    expect(result.current.isRevealed).toBe(false);
    expect(result.current.settings).toEqual({
      sequence: "fibonacci",
      hasPassword: false,
    });
  });

  it("emits joinRoom event on socket when joinRoom is called and socket is connected", () => {
    const { result } = renderHook(() => usePokerSocket(defaultProps));

    act(() => {
      result.current.joinRoom("Alice", "secret");
    });

    expect(mockEmit).toHaveBeenCalledWith(
      "joinRoom",
      { roomId: "test-room", userName: "Alice", password: "secret" },
      expect.any(Function)
    );
  });

  it("stores pending join when joinRoom is called but socket is not connected", () => {
    mockSocket = createMockSocket(false);
    (useSocketManager as Mock).mockReturnValue({
      socket: mockSocket,
      isConnected: false,
      isConnecting: true,
    });

    const { result } = renderHook(() => usePokerSocket(defaultProps));

    act(() => {
      result.current.joinRoom("Alice");
    });

    // Should not emit directly since not connected
    expect(mockEmit).not.toHaveBeenCalled();
    // isJoining should be true (pending join stored)
    expect(result.current.isJoining).toBe(true);
  });

  it("updates participants, settings, and isJoined when roomJoined event fires", () => {
    const { result } = renderHook(() => usePokerSocket(defaultProps));

    const roomJoinedData = {
      participants: [
        { id: "p1", name: "Alice", vote: null },
        { id: "p2", name: "Bob", vote: null },
      ],
      settings: { sequence: "tshirt", hasPassword: true },
    };

    act(() => {
      socketEventHandlers["roomJoined"]?.(roomJoinedData);
    });

    expect(result.current.participants).toEqual(roomJoinedData.participants);
    expect(result.current.settings).toEqual({
      sequence: "tshirt",
      hasPassword: true,
    });
    expect(result.current.isJoined).toBe(true);
    expect(defaultProps.onRoomJoined).toHaveBeenCalled();
  });

  it("updates participants when participantUpdate event fires", () => {
    const { result } = renderHook(() => usePokerSocket(defaultProps));

    // First join to establish state
    act(() => {
      socketEventHandlers["roomJoined"]?.({
        participants: [{ id: "p1", name: "Alice", vote: null }],
        settings: { sequence: "fibonacci", hasPassword: false },
      });
    });

    const updatedParticipants = [
      { id: "p1", name: "Alice", vote: "5" },
      { id: "p2", name: "Bob", vote: null },
    ];

    act(() => {
      socketEventHandlers["participantUpdate"]?.({
        participants: updatedParticipants,
      });
    });

    expect(result.current.participants).toEqual(updatedParticipants);
  });

  it("sets isRevealed to true when votesRevealed event fires", () => {
    const { result } = renderHook(() => usePokerSocket(defaultProps));

    expect(result.current.isRevealed).toBe(false);

    act(() => {
      socketEventHandlers["votesRevealed"]?.();
    });

    expect(result.current.isRevealed).toBe(true);
  });

  it("sets isRevealed to false when votesReset event fires", () => {
    const { result } = renderHook(() => usePokerSocket(defaultProps));

    // First set revealed
    act(() => {
      socketEventHandlers["votesRevealed"]?.();
    });
    expect(result.current.isRevealed).toBe(true);

    act(() => {
      socketEventHandlers["votesReset"]?.();
    });

    expect(result.current.isRevealed).toBe(false);
  });

  it("updates settings when settingsUpdated event fires", () => {
    const { result } = renderHook(() => usePokerSocket(defaultProps));

    act(() => {
      socketEventHandlers["settingsUpdated"]?.({
        settings: { sequence: "powers", hasPassword: true },
      });
    });

    expect(result.current.settings).toEqual({
      sequence: "powers",
      hasPassword: true,
    });
  });

  it("emits vote event when vote is called and user is joined", () => {
    const { result } = renderHook(() => usePokerSocket(defaultProps));

    // Join first
    act(() => {
      socketEventHandlers["roomJoined"]?.({
        participants: [{ id: "p1", name: "Alice", vote: null }],
        settings: { sequence: "fibonacci", hasPassword: false },
      });
    });

    mockEmit.mockClear();

    act(() => {
      result.current.vote("8");
    });

    expect(mockEmit).toHaveBeenCalledWith("vote", {
      roomId: "test-room",
      vote: "8",
    });
  });

  it("emits revealVotes and resetVotes events when called and user is joined", () => {
    const { result } = renderHook(() => usePokerSocket(defaultProps));

    // Join first
    act(() => {
      socketEventHandlers["roomJoined"]?.({
        participants: [{ id: "p1", name: "Alice", vote: null }],
        settings: { sequence: "fibonacci", hasPassword: false },
      });
    });

    mockEmit.mockClear();

    act(() => {
      result.current.revealVotes();
    });

    expect(mockEmit).toHaveBeenCalledWith("revealVotes", {
      roomId: "test-room",
    });

    mockEmit.mockClear();

    act(() => {
      result.current.resetVotes();
    });

    expect(mockEmit).toHaveBeenCalledWith("resetVotes", {
      roomId: "test-room",
    });
  });

  it("does not emit events when socket is null or user has not joined", () => {
    (useSocketManager as Mock).mockReturnValue({
      socket: null,
      isConnected: false,
      isConnecting: false,
    });

    const { result } = renderHook(() => usePokerSocket(defaultProps));

    act(() => {
      result.current.vote("5");
      result.current.revealVotes();
      result.current.resetVotes();
      result.current.changeName("New Name");
      result.current.updateSettings({ sequence: "tshirt" });
    });

    expect(mockEmit).not.toHaveBeenCalled();
  });
});
