import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from "react";
import {
  useQuery,
  useMutation,
  UseMutationOptions,
} from "@tanstack/react-query";
import { apiRequest, AuthError } from "../utils/apiUtils";

interface User {
  id: string;
  name: string;
  email: string;
}

// Define types for mutation variables and responses
interface AuthResponse {
  user: User;
  token: string;
}
interface LoginVariables {
  email: string;
  password: string;
}
interface RegisterVariables extends LoginVariables {
  name: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (variables: LoginVariables) => Promise<AuthResponse>;
  register: (variables: RegisterVariables) => Promise<AuthResponse>;
  logout: () => void;
  isLoading: boolean; // Represents initial token check loading
}

export const AuthContext = createContext<AuthContextType | undefined>(
  undefined
);

// Define the generic mutation hook helper function correctly
function useAuthMutation<TVariables>(
  endpoint: string,
  logoutCallback: () => void, // Pass logout as a dependency
  // Correctly type the options parameter
  options?: Omit<
    UseMutationOptions<AuthResponse, Error, TVariables>,
    "mutationFn"
  >
) {
  return useMutation<AuthResponse, Error, TVariables>({
    // Ensure generic types match useMutation signature
    mutationFn: async (variables: TVariables) => {
      // Use apiRequest instead of fetch directly
      // apiRequest handles JSON stringification internally
      return await apiRequest<AuthResponse>(endpoint, {
        method: "POST",
        body: variables, // Pass the variables object directly
        includeAuth: false, // Auth is not needed for login/register endpoints
      });
    },
    onError: (error: Error) => {
      // Explicitly type error
      console.error(`Authentication error (${endpoint}):`, error);
      logoutCallback(); // Call logout on failure
      // Error is automatically thrown by mutateAsync
    },
    // Spread other options correctly
    ...(options || {}),
  });
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isInitialCheckLoading, setIsInitialCheckLoading] = useState(true);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    try {
      localStorage.removeItem("user");
      localStorage.removeItem("token");
      localStorage.removeItem("currentWorkspaceId");
    } catch (e) {
      console.error("Error clearing storage during logout:", e);
    }
    // TODO: Consider invalidating relevant queries on logout
    // queryClient.invalidateQueries(...);
  }, []);

  // --- React Query for token verification ---
  const verifyTokenQueryKey = ["verifyToken"];
  const fetchVerifiedUser = async (): Promise<{ user: User }> => {
    // Check if token exists before making the request
    const currentToken = localStorage.getItem("token");
    if (!currentToken) {
      throw new AuthError("No token found"); // Throw specific error if no token
    }
    return await apiRequest<{ user: User }>("/auth/verify", {
      method: "GET",
      includeAuth: true, // apiRequest will use the token from storage
    });
  };

  const {
    data: verifiedUserData,
    // isLoading: isVerifyLoading, // Not directly used for context's isLoading
    isError: isVerifyError,
    error: verifyError,
    isSuccess: isVerifySuccess,
  } = useQuery<{ user: User }, Error>({
    // Correct error type
    queryKey: verifyTokenQueryKey,
    queryFn: fetchVerifiedUser,
    enabled: !!localStorage.getItem("token"), // Only run if token exists initially
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  });

  useEffect(() => {
    const storedToken = localStorage.getItem("token");
    const storedUserJSON = localStorage.getItem("user");

    if (storedToken) {
      if (isVerifySuccess && verifiedUserData?.user) {
        const fullUser = {
          ...(storedUserJSON ? JSON.parse(storedUserJSON) : {}), // Safely parse stored user
          ...verifiedUserData.user,
        };
        setUser(fullUser);
        setToken(storedToken);
        // Update localStorage only if verified data differs significantly? Optional.
        localStorage.setItem("user", JSON.stringify(fullUser));
        setIsInitialCheckLoading(false);
      } else if (isVerifyError) {
        console.log("Token verification failed, logging out.", verifyError);
        logout();
        setIsInitialCheckLoading(false);
      }
      // If query is still running (isVerifyLoading), isInitialCheckLoading remains true
    } else {
      setIsInitialCheckLoading(false); // No token, not loading
    }
    // Add isVerifyLoading to dependencies? No, rely on isSuccess/isError flags.
  }, [isVerifySuccess, isVerifyError, verifiedUserData, verifyError, logout]);
  // --- End React Query ---

  // --- Use the mutations ---
  const loginMutation = useAuthMutation<LoginVariables>("/auth/login", logout);
  const registerMutation = useAuthMutation<RegisterVariables>(
    "/auth/register",
    logout
  );

  // Expose functions that call mutateAsync and handle state updates
  const login = useCallback(
    async (variables: LoginVariables) => {
      try {
        const data = await loginMutation.mutateAsync(variables);
        // Update state after successful mutation
        setUser(data.user);
        setToken(data.token);
        localStorage.setItem("user", JSON.stringify(data.user));
        localStorage.setItem("token", data.token);
        return data;
      } catch (error) {
        // Error is handled by mutation's onError (logs, calls logout)
        // Re-throw for the component UI
        throw error;
      }
    },
    [loginMutation]
  );

  const register = useCallback(
    async (variables: RegisterVariables) => {
      try {
        const data = await registerMutation.mutateAsync(variables);
        // Update state after successful mutation
        setUser(data.user);
        setToken(data.token);
        localStorage.setItem("user", JSON.stringify(data.user));
        localStorage.setItem("token", data.token);
        return data;
      } catch (error) {
        // Error is handled by mutation's onError (logs, calls logout)
        // Re-throw for the component UI
        throw error;
      }
    },
    [registerMutation]
  );
  // --- End Use Mutations ---

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        isLoading: isInitialCheckLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
