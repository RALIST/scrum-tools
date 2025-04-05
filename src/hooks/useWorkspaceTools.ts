import { useState, useEffect, useCallback } from "react";
import { useToast } from "@chakra-ui/react";
import { apiRequest } from "../utils/apiUtils"; // Import apiRequest

// Interfaces for tool data (can be moved to a types file)
interface WorkspacePokerRoom {
  id: string;
  name: string;
  participantCount: number;
  createdAt: string;
  hasPassword?: boolean;
  sequence?: string;
}

interface WorkspaceRetroBoard {
  id: string;
  name: string;
  cardCount: number;
  createdAt: string;
  hasPassword?: boolean;
}

interface WorkspaceVelocityTeam {
  id: string;
  name: string;
  createdAt: string;
  avgVelocityPreview?: number | null;
}

interface UseWorkspaceToolsResult {
  pokerRooms: WorkspacePokerRoom[];
  retroBoards: WorkspaceRetroBoard[];
  velocityTeams: WorkspaceVelocityTeam[];
  isLoading: boolean;
  error: Error | null;
  refreshTools: () => Promise<void>; // Function to manually refresh
}

export const useWorkspaceTools = (
  workspaceId: string | undefined
): UseWorkspaceToolsResult => {
  const toast = useToast();

  const [pokerRooms, setPokerRooms] = useState<WorkspacePokerRoom[]>([]);
  const [retroBoards, setRetroBoards] = useState<WorkspaceRetroBoard[]>([]);
  const [velocityTeams, setVelocityTeams] = useState<WorkspaceVelocityTeam[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchTools = useCallback(async () => {
    if (!workspaceId) {
        setPokerRooms([]);
        setRetroBoards([]);
        setVelocityTeams([]);
        setIsLoading(false);
        setError(null);
        return;
    }

    setIsLoading(true);
    setError(null);
    try {
      // Use Promise.all to fetch tools concurrently
      const [roomsData, boardsData, teamsData] = await Promise.all([
        apiRequest<WorkspacePokerRoom[]>(`/workspaces/${workspaceId}/rooms`),
        apiRequest<WorkspaceRetroBoard[]>(`/workspaces/${workspaceId}/retros`),
        apiRequest<WorkspaceVelocityTeam[]>(`/workspaces/${workspaceId}/velocity-teams`),
      ]);
      setPokerRooms(roomsData || []);
      setRetroBoards(boardsData || []);
      setVelocityTeams(teamsData || []);
    } catch (err) {
      console.error("Error loading workspace tools:", err);
      setError(err instanceof Error ? err : new Error("Failed to load tools"));
      setPokerRooms([]);
      setRetroBoards([]);
      setVelocityTeams([]);
      toast({
        title: "Error Loading Tools",
        description: "Could not fetch workspace tools.",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId, toast]);

  // Fetch tools when workspaceId changes
  useEffect(() => {
    fetchTools();
  }, [fetchTools]); // Depend on the memoized fetch function

  return {
    pokerRooms,
    retroBoards,
    velocityTeams,
    isLoading,
    error,
    refreshTools: fetchTools,
  };
};
