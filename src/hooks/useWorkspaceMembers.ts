import { useToast } from '@chakra-ui/react';
import { useState, useEffect, useCallback } from 'react';
import { useWorkspace } from '../contexts/WorkspaceContext';
import type { WorkspaceMemberResponse as Member } from '../contexts/WorkspaceContext';

interface UseWorkspaceMembersResult {
  members: Member[];
  isLoading: boolean;
  error: Error | null;
  refreshMembers: () => Promise<void>; // Function to manually refresh
}

export const useWorkspaceMembers = (workspaceId: string | undefined): UseWorkspaceMembersResult => {
  const { getWorkspaceMembers } = useWorkspace(); // Get function from context
  const toast = useToast();

  const [members, setMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchMembers = useCallback(async () => {
    if (!workspaceId) {
      setMembers([]); // Clear members if no ID
      setIsLoading(false);
      setError(null); // No error if ID is just missing
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const membersList = await getWorkspaceMembers(workspaceId);
      setMembers(membersList); // Set from API response
    } catch (err) {
      console.error('Error loading members:', err);
      setError(err instanceof Error ? err : new Error('Failed to load members'));
      setMembers([]); // Clear members on error
      toast({
        title: 'Error Loading Members',
        description: 'Could not fetch workspace members.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId, getWorkspaceMembers, toast]);

  // Fetch members when workspaceId changes
  useEffect(() => {
    void fetchMembers();
  }, [fetchMembers]); // Depend on the memoized fetch function

  return { members, isLoading, error, refreshMembers: fetchMembers };
};
