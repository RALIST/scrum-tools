import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useAuth } from './AuthContext';
import config from '../config';

interface Workspace {
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
  updateWorkspace: (id: string, name: string, description: string) => Promise<Workspace>;
  addWorkspaceMember: (workspaceId: string, email: string, role?: string) => Promise<void>;
  removeWorkspaceMember: (workspaceId: string, memberId: string) => Promise<void>;
  getWorkspaceMembers: (workspaceId: string) => Promise<any[]>;
  isLoading: boolean;
  refreshWorkspaces: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export const WorkspaceProvider = ({ children }: { children: ReactNode }) => {
  const { token, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  
  // Get the initial ID from localStorage only once at mount
  const storedId = localStorage.getItem('currentWorkspaceId');
  const [workspaces, setWorkspaces] = useState<Workspace[] | null>(null);
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string | null>(storedId);
  const [isLoading, setIsLoading] = useState(false);
  
  useEffect(() => {
    if (!isAuthenticated || isAuthLoading) return;
    if (!workspaces) refreshWorkspaces();
  }, [workspaces, isAuthenticated]);

  // Custom setter for currentWorkspace that also updates workspaceId
  const updateCurrentWorkspace = useCallback((workspace: Workspace | null) => {
    if (workspace) {
      setCurrentWorkspace(workspace);
      setCurrentWorkspaceId(workspace.id);
    }
  }, []);

  const refreshWorkspaces = async () => {
    if (!token) return [];
    
    setIsLoading(true);
    try {
      const response = await fetch(`${config.apiUrl}/workspaces`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch workspaces: ${response.status}`);
      }
      
      const data = await response.json();
      setWorkspaces(data);
      
      if (data.length > 0) {
        const matchingWorkspace = data.find((w: Workspace) => w.id === currentWorkspaceId);
        if (matchingWorkspace) {
          updateCurrentWorkspace(matchingWorkspace);

          return data;
        } else {
          updateCurrentWorkspace(data[0] || null);
        }
      }
      
      return data;
    } catch (error) {
      console.error('Error fetching workspaces:', error);
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  const createWorkspace = async (name: string, description: string) => {
    if (!token) throw new Error('Not authenticated');
    
    setIsLoading(true);
    try {
      const response = await fetch(`${config.apiUrl}/workspaces`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name, description })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create workspace');
      }
      
      const data = await response.json();
      await refreshWorkspaces();
      return data.workspace;
    } catch (error) {
      console.error('Error creating workspace:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const updateWorkspace = async (id: string, name: string, description: string) => {
    if (!token) throw new Error('Not authenticated');
    
    setIsLoading(true);
    try {
      const response = await fetch(`${config.apiUrl}/workspaces/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name, description })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update workspace');
      }
      
      const data = await response.json();
      await refreshWorkspaces();
      
      // Update currentWorkspace if it's the one being edited
      if (currentWorkspace && currentWorkspace.id === id) {
        setCurrentWorkspace(data.workspace);
      }
      
      return data.workspace;
    } catch (error) {
      console.error('Error updating workspace:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const addWorkspaceMember = async (workspaceId: string, email: string, role?: string) => {
    if (!token) throw new Error('Not authenticated');
    
    setIsLoading(true);
    try {
      const response = await fetch(`${config.apiUrl}/workspaces/${workspaceId}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ email, role })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add member');
      }
    } catch (error) {
      console.error('Error adding member:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const removeWorkspaceMember = async (workspaceId: string, memberId: string) => {
    if (!token) throw new Error('Not authenticated');
    
    setIsLoading(true);
    try {
      const response = await fetch(`${config.apiUrl}/workspaces/${workspaceId}/members/${memberId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to remove member');
      }
    } catch (error) {
      console.error('Error removing member:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const getWorkspaceMembers = async (workspaceId: string) => {
    if (!token) throw new Error('Not authenticated');
    
    setIsLoading(true);
    try {
      const response = await fetch(`${config.apiUrl}/workspaces/${workspaceId}/members`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get members');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error getting members:', error);
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
        isLoading: (isLoading && isAuthLoading),
        refreshWorkspaces
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
};

export const useWorkspace = () => {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
};