// src/hooks/useSocketManager.test.ts
import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useSocketManager } from "./useSocketManager";

// --- Mocks ---
type EventHandler = (...args: unknown[]) => void;

// Use vi.hoisted so the variables are available inside vi.mock factories
const { mockSocket, mockManagerSocket } = vi.hoisted(() => {
  const mockSocket = {
    on: vi.fn(),
    off: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    connected: false,
    active: false,
    id: "mock-socket-id",
  };

  const mockManagerSocket = vi.fn().mockReturnValue(mockSocket);

  return { mockSocket, mockManagerSocket };
});

vi.mock("socket.io-client", () => {
  class MockManager {
    socket: typeof mockManagerSocket;
    constructor() {
      this.socket = mockManagerSocket;
    }
  }
  return { Manager: MockManager };
});

vi.mock("../config", () => ({
  default: {
    apiUrl: "http://localhost:3001/api",
    socketUrl: "http://localhost:3001",
    siteUrl: "http://localhost:5173",
  },
}));

vi.mock("../utils/logger", () => ({
  createHookLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    trace: vi.fn(),
  }),
}));

// Helper to get registered event handlers from mock
function getEventHandler(eventName: string): EventHandler | undefined {
  const calls = mockSocket.on.mock.calls as [string, EventHandler][];
  const match = calls.find(([name]) => name === eventName);
  return match?.[1];
}

describe("useSocketManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSocket.connected = false;
    mockSocket.active = false;
    mockSocket.id = "mock-socket-id";
    mockManagerSocket.mockReturnValue(mockSocket);
  });

  it("returns initial state with socket null, isConnected false, isConnecting false", () => {
    const { result } = renderHook(() =>
      useSocketManager({
        namespace: "",
        autoConnect: false,
      })
    );

    // Empty namespace means no socket is created
    expect(result.current.socket).toBeNull();
    expect(result.current.isConnected).toBe(false);
    expect(result.current.isConnecting).toBe(false);
  });

  it("creates a Manager and connects when namespace provided and autoConnect is true", () => {
    renderHook(() =>
      useSocketManager({
        namespace: "/poker",
        autoConnect: true,
      })
    );

    // Manager should have been created (or reused)
    expect(mockManagerSocket).toHaveBeenCalledWith("/poker");
    // Socket.connect should be called because autoConnect is true
    expect(mockSocket.connect).toHaveBeenCalled();
  });

  it("does not connect when autoConnect is false", () => {
    renderHook(() =>
      useSocketManager({
        namespace: "/poker",
        autoConnect: false,
      })
    );

    expect(mockManagerSocket).toHaveBeenCalledWith("/poker");
    expect(mockSocket.connect).not.toHaveBeenCalled();
  });

  it("registers connect, disconnect, and connect_error event handlers", () => {
    renderHook(() =>
      useSocketManager({
        namespace: "/poker",
        autoConnect: false,
      })
    );

    const onCalls = mockSocket.on.mock.calls as [string, EventHandler][];
    const eventNames = onCalls.map(([name]) => name);

    expect(eventNames).toContain("connect");
    expect(eventNames).toContain("disconnect");
    expect(eventNames).toContain("connect_error");
  });

  it("calls onConnect callback and updates isConnected when socket connects", () => {
    const onConnect = vi.fn();

    const { result } = renderHook(() =>
      useSocketManager({
        namespace: "/poker",
        autoConnect: false,
        onConnect,
      })
    );

    const connectHandler = getEventHandler("connect");
    expect(connectHandler).toBeDefined();

    act(() => {
      connectHandler!();
    });

    expect(result.current.isConnected).toBe(true);
    expect(result.current.isConnecting).toBe(false);
    expect(onConnect).toHaveBeenCalledTimes(1);
  });

  it("calls onDisconnect callback and updates isConnected on disconnect", () => {
    const onDisconnect = vi.fn();

    const { result } = renderHook(() =>
      useSocketManager({
        namespace: "/poker",
        autoConnect: false,
        onDisconnect,
      })
    );

    // First connect
    const connectHandler = getEventHandler("connect");
    act(() => {
      connectHandler!();
    });
    expect(result.current.isConnected).toBe(true);

    // Then disconnect
    const disconnectHandler = getEventHandler("disconnect");
    expect(disconnectHandler).toBeDefined();

    act(() => {
      disconnectHandler!("io server disconnect");
    });

    expect(result.current.isConnected).toBe(false);
    expect(result.current.isConnecting).toBe(false);
    expect(onDisconnect).toHaveBeenCalledTimes(1);
    expect(onDisconnect).toHaveBeenCalledWith("io server disconnect");
  });

  it("calls onError callback on connect_error", () => {
    const onError = vi.fn();

    const { result } = renderHook(() =>
      useSocketManager({
        namespace: "/poker",
        autoConnect: false,
        onError,
      })
    );

    const errorHandler = getEventHandler("connect_error");
    expect(errorHandler).toBeDefined();

    const testError = new Error("Connection refused");

    act(() => {
      errorHandler!(testError);
    });

    expect(result.current.isConnected).toBe(false);
    expect(result.current.isConnecting).toBe(false);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(testError);
  });

  it("cleans up socket on unmount", () => {
    const { unmount } = renderHook(() =>
      useSocketManager({
        namespace: "/poker",
        autoConnect: true,
      })
    );

    unmount();

    // Should remove event listeners
    expect(mockSocket.off).toHaveBeenCalledWith("connect", expect.any(Function));
    expect(mockSocket.off).toHaveBeenCalledWith("disconnect", expect.any(Function));
    expect(mockSocket.off).toHaveBeenCalledWith("connect_error", expect.any(Function));

    // Should disconnect
    expect(mockSocket.disconnect).toHaveBeenCalled();
  });

  it("creates socket for a different namespace correctly", () => {
    renderHook(() =>
      useSocketManager({
        namespace: "/retro",
        autoConnect: false,
      })
    );

    // mockManagerSocket should have been called with the /retro namespace
    expect(mockManagerSocket).toHaveBeenCalledWith("/retro");
  });

  it("exposes socket after a state change triggers re-render", () => {
    const { result } = renderHook(() =>
      useSocketManager({
        namespace: "/poker",
        autoConnect: false,
      })
    );

    // After connect event triggers a state change, re-render exposes the ref
    const connectHandler = getEventHandler("connect");
    act(() => {
      connectHandler!();
    });

    // After re-render caused by state change, socket ref should be exposed
    expect(result.current.socket).toBe(mockSocket);
  });

  it("sets isConnecting to true when autoConnect triggers connection", () => {
    const { result } = renderHook(() =>
      useSocketManager({
        namespace: "/poker",
        autoConnect: true,
      })
    );

    // isConnecting should be true since we called connect but haven't received the connect event
    expect(result.current.isConnecting).toBe(true);
    expect(result.current.isConnected).toBe(false);
  });

  it("handles already-connected socket", () => {
    // Set socket as already connected before rendering
    mockSocket.connected = true;

    const onConnect = vi.fn();

    const { result } = renderHook(() =>
      useSocketManager({
        namespace: "/poker",
        autoConnect: true,
        onConnect,
      })
    );

    // Should detect existing connection
    expect(result.current.isConnected).toBe(true);
    expect(onConnect).toHaveBeenCalledTimes(1);
  });

  it("does not create socket when namespace is empty string", () => {
    const { result } = renderHook(() =>
      useSocketManager({
        namespace: "",
        autoConnect: true,
      })
    );

    // No manager socket should be called for empty namespace
    expect(mockManagerSocket).not.toHaveBeenCalled();
    expect(result.current.socket).toBeNull();
    expect(result.current.isConnected).toBe(false);
  });
});
