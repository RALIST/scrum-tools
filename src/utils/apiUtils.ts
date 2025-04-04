import config from '../config';

export interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: any;
  headers?: Record<string, string>;
  includeAuth?: boolean;
}

/**
 * Utility function for making API requests with authentication
 */
export const apiRequest = async <T>(endpoint: string, options: ApiOptions = {}): Promise<T> => {
  const {
    method = 'GET',
    body,
    headers = {},
    includeAuth = true
  } = options;

  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers
  };

  // Add auth token if available and requested
  if (includeAuth) {
    const token = getAuthToken();
    if (token) {
      requestHeaders['Authorization'] = `Bearer ${token}`;
    }
  }

  const requestOptions: RequestInit = {
    method,
    headers: requestHeaders
  };

  if (body) {
    requestOptions.body = JSON.stringify(body);
  }

  const response = await fetch(`${config.apiUrl}${endpoint}`, requestOptions);

  // Check for authorization errors specifically
  if (response.status === 401) {
    // Throw a specific error type for auth failures
    throw new AuthError('Authentication failed or token expired');
  }
  
  if (!response.ok) {
    // Explicitly type errorData and ensure 'error' property exists
    let errorData: { error?: string } = {}; 
    try {
        // Try to parse JSON error response from the server
        const parsedError = await response.json();
        // Ensure the parsed data has an 'error' property (or adapt as needed based on your API error structure)
        errorData = typeof parsedError === 'object' && parsedError !== null && 'error' in parsedError 
                    ? parsedError 
                    : { error: 'Unknown error structure' };
    } catch (e) {
        // If response is not JSON, use status text
        errorData = { error: response.statusText };
    }
    // Throw a generic error for other non-OK responses
    throw new Error(errorData.error || `API request failed with status ${response.status}`);
  }

  // Handle cases where the response might be OK but have no content (e.g., 204 No Content)
  if (response.status === 204) {
    return {} as T; // Return an empty object or null/undefined as appropriate
  }

  // Otherwise, parse and return JSON
  return response.json();
};

/**
 * Get the current authentication token if available
 */
export const getAuthToken = (): string | null => {
  return localStorage.getItem('token');
};

/**
 * Check if the current user is authenticated
 */
export const isAuthenticated = (): boolean => {
  return !!localStorage.getItem('token');
};

/**
 * Get current workspace ID if available
 */
export const getCurrentWorkspaceId = (): string | null => {
  return localStorage.getItem('currentWorkspaceId');
};

// Custom Error class for Authentication errors
export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}
