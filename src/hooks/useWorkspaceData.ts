import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@chakra-ui/react";
import { useWorkspace, Workspace } from "../contexts/WorkspaceContext";

interface UseWorkspaceDataResult {
  workspace: Workspace | null;
  isAdmin: boolean;
  isLoading: boolean;
  error: Error | null;
}

export const useWorkspaceData = (
  workspaceId: string | undefined
): UseWorkspaceDataResult => {
  const { workspaces, setCurrentWorkspace, isLoading: isContextLoading } = useWorkspace();
  const navigate = useNavigate();
  const toast = useToast();

  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Don't proceed if context is loading or ID is missing
    if (isContextLoading || !workspaceId) {
        // If context is done loading but ID is still missing, maybe navigate?
        // Or rely on the component using the hook to handle undefined ID.
        // Setting isLoading to false only if context is done loading and ID is missing.
        if (!isContextLoading && !workspaceId) {
            setIsLoading(false);
            setError(new Error("Workspace ID is missing.")); // Set an error state
        } else {
            // Still waiting for context or ID
            setIsLoading(true);
        }
      return;
    }

    // If workspaces are loaded from context
    if (workspaces) {
      const findWorkspace = workspaces.find((w) => w.id === workspaceId);

      if (findWorkspace) {
        setWorkspace(findWorkspace);
        setIsAdmin(findWorkspace.role === "admin");
        setCurrentWorkspace(findWorkspace); // Update context
        setIsLoading(false);
        setError(null);
      } else {
        // Workspaces loaded, but this one wasn't found (permissions or doesn't exist)
        setError(new Error("Workspace not found or access denied."));
        setIsLoading(false);
        setWorkspace(null);
        setIsAdmin(false);
        // Optionally navigate away or show error message via toast
        toast({
          title: "Workspace Error",
          description: "Workspace not found or you do not have access.",
          status: "error",
          duration: 5000,
          isClosable: true,
        });
         navigate("/workspaces", { replace: true }); // Navigate back
      }
    } else {
        // Workspaces array is null/undefined in context, still loading or error in context
        setIsLoading(true); // Keep loading until workspaces are available
    }
  }, [workspaceId, workspaces, isContextLoading, setCurrentWorkspace, navigate, toast]);

  return { workspace, isAdmin, isLoading, error };
};
