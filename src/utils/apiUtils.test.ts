// src/utils/apiUtils.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { getAuthToken, isAuthenticated, getCurrentWorkspaceId, AuthError } from './apiUtils'; // Import AuthError too

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('apiUtils localStorage helpers', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorageMock.clear();
  });

  // --- getAuthToken ---
  describe('getAuthToken', () => {
    it('should return the token from localStorage if it exists', () => {
      localStorageMock.setItem('token', 'test-token-123');
      expect(getAuthToken()).toBe('test-token-123');
    });

    it('should return null if the token does not exist in localStorage', () => {
      expect(getAuthToken()).toBeNull();
    });
  });

  // --- isAuthenticated ---
  describe('isAuthenticated', () => {
    it('should return true if a token exists in localStorage', () => {
      localStorageMock.setItem('token', 'test-token-123');
      expect(isAuthenticated()).toBe(true);
    });

    it('should return false if no token exists in localStorage', () => {
      expect(isAuthenticated()).toBe(false);
    });
  });

  // --- getCurrentWorkspaceId ---
  describe('getCurrentWorkspaceId', () => {
    it('should return the workspace ID from localStorage if it exists', () => {
      localStorageMock.setItem('currentWorkspaceId', 'ws-abc-456');
      expect(getCurrentWorkspaceId()).toBe('ws-abc-456');
    });

    it('should return null if the workspace ID does not exist in localStorage', () => {
      expect(getCurrentWorkspaceId()).toBeNull();
    });
  });

  // --- AuthError ---
   describe('AuthError', () => {
    it('should be an instance of Error', () => {
      const error = new AuthError('Test Auth Error');
      expect(error).toBeInstanceOf(Error);
    });

    it('should have the correct name property', () => {
      const error = new AuthError('Test Auth Error');
      expect(error.name).toBe('AuthError');
    });

    it('should have the correct message property', () => {
      const message = 'Specific authentication failure';
      const error = new AuthError(message);
      expect(error.message).toBe(message);
    });
  });
});

// Tests for apiRequest function
import { vi } from 'vitest';
import { apiRequest } from './apiUtils';

vi.mock('../config', () => ({
  default: {
    apiUrl: 'http://localhost:3001/api',
  },
}));

describe('apiRequest', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.restoreAllMocks();
  });

  const mockFetch = (response: Partial<Response>) => {
    const fn = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({}),
      ...response,
    });
    global.fetch = fn;
    return fn;
  };

  it('makes GET request to correct URL', async () => {
    const fetchMock = mockFetch({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({ data: 'test' }),
    });

    await apiRequest('/rooms');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3001/api/rooms',
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('includes auth token when includeAuth is true and token exists', async () => {
    localStorageMock.setItem('token', 'my-jwt-token');
    const fetchMock = mockFetch({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({}),
    });

    await apiRequest('/rooms', { includeAuth: true });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer my-jwt-token',
        }),
      })
    );
  });

  it('does not include auth token when includeAuth is false', async () => {
    localStorageMock.setItem('token', 'my-jwt-token');
    const fetchMock = mockFetch({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({}),
    });

    await apiRequest('/rooms', { includeAuth: false });

    const calledHeaders = fetchMock.mock.calls[0][1].headers;
    expect(calledHeaders).not.toHaveProperty('Authorization');
  });

  it('sends POST request with JSON body', async () => {
    const fetchMock = mockFetch({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({ id: '123' }),
    });

    const body = { name: 'New Room', description: 'A test room' };
    await apiRequest('/rooms', { method: 'POST', body });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(body),
      })
    );
  });

  it('appends query parameters to URL', async () => {
    const fetchMock = mockFetch({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue([]),
    });

    await apiRequest('/rooms', {
      queryParams: { page: 1, active: true, search: 'test' },
    });

    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toContain('?');
    expect(calledUrl).toContain('page=1');
    expect(calledUrl).toContain('active=true');
    expect(calledUrl).toContain('search=test');
  });

  it('throws AuthError on 401 response', async () => {
    mockFetch({
      ok: false,
      status: 401,
    });

    await expect(apiRequest('/protected')).rejects.toThrow(AuthError);
    await expect(apiRequest('/protected')).rejects.toThrow(
      'Authentication failed or token expired'
    );
  });

  it('throws Error with server error message on non-OK response', async () => {
    mockFetch({
      ok: false,
      status: 500,
      json: vi.fn().mockResolvedValue({ error: 'Internal server error' }),
    });

    await expect(apiRequest('/rooms')).rejects.toThrow('Internal server error');
  });

  it('returns empty object for 204 responses', async () => {
    mockFetch({
      ok: true,
      status: 204,
    });

    const result = await apiRequest('/rooms/123', { method: 'DELETE' });
    expect(result).toEqual({});
  });

  it('parses and returns JSON response', async () => {
    const responseData = { id: '123', name: 'Test Room', participants: 5 };
    mockFetch({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue(responseData),
    });

    const result = await apiRequest('/rooms/123');
    expect(result).toEqual(responseData);
  });

  it('includes custom headers', async () => {
    const fetchMock = mockFetch({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({}),
    });

    await apiRequest('/rooms', {
      headers: { 'X-Custom-Header': 'custom-value' },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'X-Custom-Header': 'custom-value',
        }),
      })
    );
  });
});