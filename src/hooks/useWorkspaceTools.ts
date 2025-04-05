import { useEffect } from "react";
import { useToast } from "@chakra-ui/react";
import { useQuery, useQueryClient } from "@tanstack/react-query"; // Import useQuery and client
import { apiRequest } from "../utils/apiUtils";

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
  isLoading: boolean; // Combined loading state
  isError: boolean; // Combined error state
  error: Error | null; // Store the first error encountered
  refreshTools: () => void; // Function to manually refresh using queryClient
}

export const useWorkspaceTools = (
  workspaceId: string | undefined
): UseWorkspaceToolsResult => {
  const toast = useToast();
  const queryClient = useQueryClient(); // Get query client instance

  // --- Query for Poker Rooms ---
  const pokerRoomsQueryKey = ["workspacePokerRooms", { workspaceId }];
  const fetchPokerRooms = async (): Promise<WorkspacePokerRoom[]> => {
    if (!workspaceId) return [];
    return await apiRequest<WorkspacePokerRoom[]>(
      `/workspaces/${workspaceId}/rooms`
    );
  };
  const {
    data: pokerRooms = [],
    isLoading: isLoadingPoker,
    isError: isPokerError,
    error: pokerError,
  } = useQuery<WorkspacePokerRoom[], Error>({
    queryKey: pokerRoomsQueryKey,
    queryFn: fetchPokerRooms,
    enabled: !!workspaceId,
  });

  // --- Query for Retro Boards ---
  const retroBoardsQueryKey = ["workspaceRetroBoards", { workspaceId }];
  const fetchRetroBoards = async (): Promise<WorkspaceRetroBoard[]> => {
    if (!workspaceId) return [];
    return await apiRequest<WorkspaceRetroBoard[]>(
      `/workspaces/${workspaceId}/retros`
    );
  };
  const {
    data: retroBoards = [],
    isLoading: isLoadingRetro,
    isError: isRetroError,
    error: retroError,
  } = useQuery<WorkspaceRetroBoard[], Error>({
    queryKey: retroBoardsQueryKey,
    queryFn: fetchRetroBoards,
    enabled: !!workspaceId,
  });

  // --- Query for Velocity Teams ---
  const velocityTeamsQueryKey = ["workspaceVelocityTeams", { workspaceId }];
  const fetchVelocityTeams = async (): Promise<WorkspaceVelocityTeam[]> => {
    if (!workspaceId) return [];
    return await apiRequest<WorkspaceVelocityTeam[]>(
      `/workspaces/${workspaceId}/velocity-teams`
    );
  };
  const {
    data: velocityTeams = [],
    isLoading: isLoadingVelocity,
    isError: isVelocityError,
    error: velocityError,
  } = useQuery<WorkspaceVelocityTeam[], Error>({
    queryKey: velocityTeamsQueryKey,
    queryFn: fetchVelocityTeams,
    enabled: !!workspaceId,
  });

  // --- Combined Loading and Error State ---
  const isLoading = isLoadingPoker || isLoadingRetro || isLoadingVelocity;
  const isError = isPokerError || isRetroError || isVelocityError;
  // Store the first error encountered for simplicity
  const error = pokerError || retroError || velocityError || null;

  // Effect to show toast on any error
  useEffect(() => {
    if (isError && error) {
      console.error("Error loading workspace tools:", error);
      toast({
        title: "Error Loading Tools",
        description: error.message || "Could not fetch workspace tools.",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    }
    // Only show toast once per error occurrence
  }, [isError, error, toast]);

  // --- Refresh Function ---
  const refreshTools = () => {
    // Invalidate all queries related to this workspace's tools
    queryClient.invalidateQueries({ queryKey: ["workspacePokerRooms", { workspaceId }] });
    queryClient.invalidateQueries({ queryKey: ["workspaceRetroBoards", { workspaceId }] });
    queryClient.invalidateQueries({ queryKey: ["workspaceVelocityTeams", { workspaceId }] });
  };

  // Remove old useEffect and fetchTools function

  return {
    pokerRooms,
    retroBoards,
    velocityTeams,
    isLoading,
    isError, // Return combined error state
    error, // Return the first error encountered
    refreshTools, // Return the new refresh function
  };
};
