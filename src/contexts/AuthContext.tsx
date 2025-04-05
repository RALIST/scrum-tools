import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from "react";
import config from "../config";
import { apiRequest, AuthError } from "../utils/apiUtils"; // Import apiRequest and AuthError
// Removed useWorkspace import

interface User {
  id: string;
  name: string;
  email: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // Removed useWorkspace hook call

  // Define logout first as it might be used in verifyToken
  const logout = useCallback(() => {
    // Use useCallback for logout as well
    setUser(null);
    setToken(null);
    // Removed setCurrentWorkspace(null) call

    try {
      localStorage.removeItem("user");
      localStorage.removeItem("token");
      localStorage.removeItem("currentWorkspaceId"); // Keep this for now
    } catch (e) {
      console.error("Error clearing storage during logout:", e);
    }
  }, []); // Removed setCurrentWorkspace dependency

  const verifyToken = useCallback(
    async (currentToken: string, storedUserJSON: string | null) => {
      setIsLoading(true); // Set loading true at the start of verification
      try {
        // Removed duplicate apiRequest call
        const data = await apiRequest<{ user: User }>("/auth/verify", {
          method: "GET",
          includeAuth: true, // This will use the token from localStorage via getAuthToken
        });
        // If request succeeds and returns user data, update state
        if (data && data.user) {
          const fullUser = {
            ...JSON.parse(storedUserJSON || "{}"),
            ...data.user,
          };
          setUser(fullUser);
          setToken(currentToken);
          localStorage.setItem("user", JSON.stringify(fullUser));
        } else {
          console.warn("/auth/verify did not return expected user data");
          logout();
        }
      } catch (error) {
        if (error instanceof AuthError) {
          console.log("Token verification failed, logging out.");
          logout();
        } else {
          console.error("Error during token verification:", error);
          // Consider logging out on other errors too?
          // logout();
        }
      } finally {
        setIsLoading(false);
      }
    },
    [logout]
  ); // Add logout as dependency

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    const storedToken = localStorage.getItem("token");

    if (storedUser && storedToken) {
      verifyToken(storedToken, storedUser); // Pass storedUser JSON
    } else {
      setIsLoading(false);
    }
  }, [verifyToken]); // useEffect depends on verifyToken

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`${config.apiUrl}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Login failed");
      }

      const data = await response.json();
      setUser(data.user);
      setToken(data.token);

      // Save to localStorage
      localStorage.setItem("user", JSON.stringify(data.user));
      localStorage.setItem("token", data.token);
    } catch (error) {
      // No need to logout here, login component handles error display
      console.error("Login error:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []); // Add useCallback with empty dependency array

  const register = useCallback(
    async (email: string, password: string, name: string) => {
      setIsLoading(true);
      try {
        const response = await fetch(`${config.apiUrl}/auth/register`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email, password, name }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Registration failed");
        }

        const data = await response.json();
        setUser(data.user);
        setToken(data.token);

        // Save to localStorage
        localStorage.setItem("user", JSON.stringify(data.user));
        localStorage.setItem("token", data.token);
      } catch (error) {
        // No need to logout here, register component handles error display
        console.error("Registration error:", error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    []
  ); // Add useCallback with empty dependency array

  // Logout function is now defined above verifyToken using useCallback

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        isLoading,
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
