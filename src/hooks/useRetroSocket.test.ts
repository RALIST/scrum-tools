import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mocks ---
const mockToast = vi.fn();

vi.mock('@chakra-ui/react', () => ({
  useToast: () => mockToast,
}));

vi.mock('../utils/logger', () => ({
  createHookLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// Build a controllable socket mock
type EventHandler = (...args: unknown[]) => void;
const eventHandlers = new Map<string, Set<EventHandler>>();

const mockEmit = vi.fn();

const mockSocket = {
  on: vi.fn((event: string, handler: EventHandler) => {
    if (!eventHandlers.has(event)) {
      eventHandlers.set(event, new Set());
    }
    eventHandlers.get(event)!.add(handler);
  }),
  off: vi.fn((event: string, handler: EventHandler) => {
    eventHandlers.get(event)?.delete(handler);
  }),
  emit: mockEmit,
  connect: vi.fn(),
  connected: false,
};

let mockIsConnected = false;
let mockIsConnecting = false;
let mockSocketInstance: typeof mockSocket | null = mockSocket;

vi.mock('./useSocketManager', () => ({
  useSocketManager: vi.fn(() => ({
    socket: mockSocketInstance,
    isConnected: mockIsConnected,
    isConnecting: mockIsConnecting,
    manager: null,
  })),
}));

// Helper to simulate a socket event
function simulateSocketEvent(event: string, ...args: unknown[]) {
  const handlers = eventHandlers.get(event);
  if (handlers) {
    for (const handler of handlers) {
      handler(...args);
    }
  }
}

import { useRetroSocket } from './useRetroSocket';

describe('useRetroSocket', () => {
  const defaultProps = {
    boardId: 'board-123',
    onBoardJoined: vi.fn(),
    onJoinError: vi.fn(),
    onNameChanged: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    eventHandlers.clear();
    mockIsConnected = false;
    mockIsConnecting = false;
    mockSocketInstance = mockSocket;
    mockSocket.connected = false;
  });

  it('has correct initial state: board null, hasJoined false, isTimerRunning false', () => {
    const { result } = renderHook(() => useRetroSocket(defaultProps));

    expect(result.current.board).toBeNull();
    expect(result.current.hasJoined).toBe(false);
    expect(result.current.isTimerRunning).toBe(false);
    expect(result.current.timeLeft).toBe(300);
    expect(result.current.hideCards).toBe(false);
  });

  it('joinBoard when connected emits joinRetroBoard event', () => {
    mockIsConnected = true;
    mockSocket.connected = true;

    const { result } = renderHook(() => useRetroSocket(defaultProps));

    act(() => {
      result.current.joinBoard('Test User', 'password123');
    });

    expect(mockEmit).toHaveBeenCalledWith(
      'joinRetroBoard',
      { boardId: 'board-123', name: 'Test User', password: 'password123' },
      expect.any(Function)
    );
  });

  it('joinBoard when not connected stores pending join and calls connect', () => {
    mockIsConnected = false;
    mockSocket.connected = false;

    const { result } = renderHook(() => useRetroSocket(defaultProps));

    act(() => {
      result.current.joinBoard('Test User');
    });

    expect(mockSocket.connect).toHaveBeenCalled();
    expect(result.current.isJoining).toBe(true);
  });

  it('retroBoardJoined event updates board and sets hasJoined true', () => {
    const boardData = {
      id: 'board-123',
      name: 'Test Board',
      created_at: '2024-01-01',
      cards: [],
      timer_running: false,
      time_left: 300,
      default_timer: 300,
      hide_cards_by_default: false,
      hide_author_names: false,
      hasPassword: false,
    };

    const { result } = renderHook(() => useRetroSocket(defaultProps));

    act(() => {
      simulateSocketEvent('retroBoardJoined', boardData);
    });

    expect(result.current.board).toEqual(boardData);
    expect(result.current.hasJoined).toBe(true);
    expect(result.current.isTimerRunning).toBe(false);
    expect(result.current.timeLeft).toBe(300);
    expect(defaultProps.onBoardJoined).toHaveBeenCalled();
  });

  it('retroBoardUpdated event updates board state', () => {
    const updatedBoard = {
      id: 'board-123',
      name: 'Updated Board',
      created_at: '2024-01-01',
      cards: [{ id: 'c1', text: 'Card 1', column_id: 'col1', author_name: 'Author', created_at: '2024-01-01', votes: [] }],
      timer_running: true,
      time_left: 250,
      default_timer: 300,
      hide_cards_by_default: false,
      hide_author_names: false,
      hasPassword: false,
    };

    const { result } = renderHook(() => useRetroSocket(defaultProps));

    act(() => {
      simulateSocketEvent('retroBoardUpdated', updatedBoard);
    });

    expect(result.current.board).toEqual(updatedBoard);
    expect(result.current.isTimerRunning).toBe(true);
    expect(result.current.timeLeft).toBe(250);
  });

  it('timerStarted event sets isTimerRunning and updates timeLeft', () => {
    const { result } = renderHook(() => useRetroSocket(defaultProps));

    act(() => {
      simulateSocketEvent('timerStarted', { timeLeft: 180 });
    });

    expect(result.current.isTimerRunning).toBe(true);
    expect(result.current.timeLeft).toBe(180);
  });

  it('timerStopped event sets isTimerRunning false', () => {
    const { result } = renderHook(() => useRetroSocket(defaultProps));

    // First start the timer
    act(() => {
      simulateSocketEvent('timerStarted', { timeLeft: 180 });
    });
    expect(result.current.isTimerRunning).toBe(true);

    // Then stop it
    act(() => {
      simulateSocketEvent('timerStopped');
    });

    expect(result.current.isTimerRunning).toBe(false);
  });

  it('timerUpdate event updates timeLeft', () => {
    const { result } = renderHook(() => useRetroSocket(defaultProps));

    act(() => {
      simulateSocketEvent('timerUpdate', { timeLeft: 42 });
    });

    expect(result.current.timeLeft).toBe(42);
  });

  it('cardsVisibilityChanged event updates hideCards', () => {
    const { result } = renderHook(() => useRetroSocket(defaultProps));

    act(() => {
      simulateSocketEvent('cardsVisibilityChanged', { hideCards: true });
    });

    expect(result.current.hideCards).toBe(true);
  });

  it('addCard emits addRetroCard event when joined', () => {
    const { result } = renderHook(() => useRetroSocket(defaultProps));

    // First join the board
    act(() => {
      simulateSocketEvent('retroBoardJoined', {
        id: 'board-123',
        name: 'Board',
        created_at: '2024-01-01',
        cards: [],
        timer_running: false,
        time_left: 300,
        default_timer: 300,
        hide_cards_by_default: false,
        hide_author_names: false,
        hasPassword: false,
      });
    });

    mockEmit.mockClear();

    act(() => {
      result.current.addCard('card-1', 'col-1', 'Test card', 'Author');
    });

    expect(mockEmit).toHaveBeenCalledWith('addRetroCard', {
      boardId: 'board-123',
      cardId: 'card-1',
      columnId: 'col-1',
      text: 'Test card',
      authorName: 'Author',
    });
  });

  it('toggleTimer emits startTimer when not running, stopTimer when running', () => {
    const { result } = renderHook(() => useRetroSocket(defaultProps));

    // Join the board first
    act(() => {
      simulateSocketEvent('retroBoardJoined', {
        id: 'board-123',
        name: 'Board',
        created_at: '2024-01-01',
        cards: [],
        timer_running: false,
        time_left: 300,
        default_timer: 300,
        hide_cards_by_default: false,
        hide_author_names: false,
        hasPassword: false,
      });
    });

    mockEmit.mockClear();

    // Timer is not running, should emit startTimer
    act(() => {
      result.current.toggleTimer();
    });
    expect(mockEmit).toHaveBeenCalledWith('startTimer', {
      boardId: 'board-123',
    });

    // Simulate timer started
    act(() => {
      simulateSocketEvent('timerStarted', { timeLeft: 300 });
    });

    mockEmit.mockClear();

    // Timer is running, should emit stopTimer
    act(() => {
      result.current.toggleTimer();
    });
    expect(mockEmit).toHaveBeenCalledWith('stopTimer', {
      boardId: 'board-123',
    });
  });

  it('clears state when socket becomes null', () => {
    const { result, rerender } = renderHook(() => useRetroSocket(defaultProps));

    // First join the board
    act(() => {
      simulateSocketEvent('retroBoardJoined', {
        id: 'board-123',
        name: 'Board',
        created_at: '2024-01-01',
        cards: [],
        timer_running: false,
        time_left: 300,
        default_timer: 300,
        hide_cards_by_default: false,
        hide_author_names: false,
        hasPassword: false,
      });
    });

    expect(result.current.hasJoined).toBe(true);
    expect(result.current.board).not.toBeNull();

    // Simulate socket becoming null
    mockSocketInstance = null;
    rerender();

    expect(result.current.board).toBeNull();
    expect(result.current.hasJoined).toBe(false);
  });
});
