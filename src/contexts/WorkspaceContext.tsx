import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from "react";
import { useAuth } from "./AuthContext";
import config from "../config";

export interface Workspace {
  // Add export here
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  created_at: string;
  role: string;
}

interface WorkspaceContextType {
  workspaces: Workspace[] | null;
  currentWorkspace: Workspace | null;
  setCurrentWorkspace: (workspace: Workspace | null) => void;
  createWorkspace: (name: string, description: string) => Promise<Workspace>;
  updateWorkspace: (
    id: string,
    name: string,
    description: string
  ) => Promise<Workspace>;
  addWorkspaceMember: (
    workspaceId: string,
    email: string,
    role?: string
  ) => Promise<void>;
  removeWorkspaceMember: (
    workspaceId: string,
    memberId: string
  ) => Promise<void>;
  getWorkspaceMembers: (workspaceId: string) => Promise<any[]>;
  isLoading: boolean;
  refreshWorkspaces: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(
  undefined
);

export const WorkspaceProvider = ({ children }: { children: ReactNode }) => {
  const { token, isAuthenticated, isLoading: isAuthLoading } = useAuth();

  // Get the initial ID from localStorage only once at mount
  const storedId = localStorage.getItem("currentWorkspaceId");
  const [workspaces, setWorkspaces] = useState<Workspace[] | null>(null);
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(
    null
  );
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string | null>(
    storedId
  );
  const [isLoading, setIsLoading] = useState(false);

  // Custom setter for currentWorkspace that also updates workspaceId
  // Define this BEFORE the useEffect that uses it
  const updateCurrentWorkspace = useCallback((workspace: Workspace | null) => {
    if (workspace) {
      setCurrentWorkspace(workspace);
      setCurrentWorkspaceId(workspace.id);
    }
    setCurrentWorkspace(workspace); // Set state directly
    if (workspace) {
      setCurrentWorkspaceId(workspace.id);
      localStorage.setItem("currentWorkspaceId", workspace.id); // Save ID to localStorage
    } else {
      setCurrentWorkspaceId(null);
      localStorage.removeItem("currentWorkspaceId"); // Clear ID from localStorage
    }
  }, []);

  // Define refreshWorkspaces before the useEffect that uses it
  // Wrap in useCallback as it's used in useEffect dependencies
  const refreshWorkspaces = useCallback(async () => {
    if (!token) {
      // If no token (logged out), clear workspaces and current workspace
      // This is now handled by the useEffect below, but keep for safety/clarity? Or remove?
      // setWorkspaces(null);
      // updateCurrentWorkspace(null); // Use the updated setter to clear everything
      return []; // Return early if not authenticated
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${config.apiUrl}/workspaces`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch workspaces: ${response.status}`);
      }

      const data = await response.json();
      setWorkspaces(data);

      if (data.length > 0) {
        const matchingWorkspace = data.find(
          (w: Workspace) => w.id === currentWorkspaceId
        );
        if (matchingWorkspace) {
          updateCurrentWorkspace(matchingWorkspace);

          return data;
        } else {
          updateCurrentWorkspace(data[0] || null);
        }
      }

      return data;
    } catch (error) {
      console.error("Error fetching workspaces:", error);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [token, currentWorkspaceId, updateCurrentWorkspace]); // Add dependencies for useCallback

  useEffect(() => {
    if (!isAuthenticated || isAuthLoading) return;
    if (!workspaces) refreshWorkspaces();
  }, [workspaces, isAuthenticated, isAuthLoading, refreshWorkspaces]); // Existing effect to load workspaces

  // Effect to clear workspace when user logs out
  useEffect(() => {
    if (!isAuthenticated && !isAuthLoading) {
      // If user is not authenticated (and auth check is complete)
      updateCurrentWorkspace(null); // Clear the current workspace
      setWorkspaces(null); // Clear the list of workspaces
    }
    // We might need to trigger refreshWorkspaces if isAuthenticated becomes true later
    // but the existing useEffect above should handle initial load.
  }, [isAuthenticated, isAuthLoading, updateCurrentWorkspace]); // Depend on auth state

  // refreshWorkspaces is now defined above the useEffects

  const createWorkspace = async (name: string, description: string) => {
    if (!token) throw new Error("Not authenticated");

    setIsLoading(true);
    try {
      const response = await fetch(`${config.apiUrl}/workspaces`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name, description }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create workspace");
      }

      const data = await response.json();
      await refreshWorkspaces();
      return data.workspace;
    } catch (error) {
      console.error("Error creating workspace:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const updateWorkspace = async (
    id: string,
    name: string,
    description: string
  ) => {
    if (!token) throw new Error("Not authenticated");

    setIsLoading(true);
    try {
      const response = await fetch(`${config.apiUrl}/workspaces/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name, description }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update workspace");
      }

      const data = await response.json();
      await refreshWorkspaces();

      // Update currentWorkspace if it's the one being edited
      if (currentWorkspace && currentWorkspace.id === id) {
        setCurrentWorkspace(data.workspace);
      }

      return data.workspace;
    } catch (error) {
      console.error("Error updating workspace:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const addWorkspaceMember = async (
    workspaceId: string,
    email: string,
    role?: string
  ) => {
    if (!token) throw new Error("Not authenticated");

    setIsLoading(true);
    try {
      const response = await fetch(
        `${config.apiUrl}/workspaces/${workspaceId}/members`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ email, role }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to add member");
      }
    } catch (error) {
      console.error("Error adding member:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const removeWorkspaceMember = async (
    workspaceId: string,
    memberId: string
  ) => {
    if (!token) throw new Error("Not authenticated");

    setIsLoading(true);
    try {
      const response = await fetch(
        `${config.apiUrl}/workspaces/${workspaceId}/members/${memberId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to remove member");
      }
    } catch (error) {
      console.error("Error removing member:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const getWorkspaceMembers = async (workspaceId: string) => {
    if (!token) throw new Error("Not authenticated");

    setIsLoading(true);
    try {
      const response = await fetch(
        `${config.apiUrl}/workspaces/${workspaceId}/members`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to get members");
      }

      return await response.json();
    } catch (error) {
      console.error("Error getting members:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <WorkspaceContext.Provider
      value={{
        workspaces,
        currentWorkspace,
        setCurrentWorkspace: updateCurrentWorkspace,
        createWorkspace,
        updateWorkspace,
        addWorkspaceMember,
        removeWorkspaceMember,
        getWorkspaceMembers,
        isLoading: isLoading && isAuthLoading,
        refreshWorkspaces,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
};

export const useWorkspace = () => {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  }
  return context;
};
