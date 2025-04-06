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

// TODO: Add tests for apiRequest function
describe('apiRequest', () => {
  it('placeholder test for apiRequest', () => {
    expect(true).toBe(true); // Placeholder
  });
});