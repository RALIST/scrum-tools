// src/contexts/WorkspaceContext.test.tsx
import { render, screen, waitFor, act, renderHook } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { WorkspaceProvider, useWorkspace } from "./WorkspaceContext";
import { AuthContext } from "./AuthContext";
import type { Workspace } from "./WorkspaceContext";

// --- Mocks ---
vi.mock("../config", () => ({
  default: {
    apiUrl: "http://localhost:3001/api",
    socketUrl: "http://localhost:3001",
    siteUrl: "http://localhost:5173",
  },
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

// --- Helpers ---
const mockWorkspaces: Workspace[] = [
  {
    id: "ws-1",
    name: "Workspace One",
    description: "First workspace",
    owner_id: "user-1",
    created_at: "2024-01-01",
    role: "owner",
  },
  {
    id: "ws-2",
    name: "Workspace Two",
    description: "Second workspace",
    owner_id: "user-1",
    created_at: "2024-01-02",
    role: "member",
  },
];

interface AuthProviderValues {
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

function createWrapper(authValues: AuthProviderValues) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <AuthContext.Provider
        value={{
          user: authValues.isAuthenticated ? { id: "user-1", name: "Test", email: "t@e.com" } : null,
          token: authValues.token,
          isAuthenticated: authValues.isAuthenticated,
          isLoading: authValues.isLoading,
          login: vi.fn(),
          register: vi.fn(),
          logout: vi.fn(),
        }}
      >
        <WorkspaceProvider>{children}</WorkspaceProvider>
      </AuthContext.Provider>
    );
  };
}

function WorkspaceConsumer() {
  const ws = useWorkspace();
  return (
    <div>
      <span data-testid="workspaces">{ws.workspaces ? JSON.stringify(ws.workspaces.map((w) => w.id)) : "null"}</span>
      <span data-testid="current-workspace">{ws.currentWorkspace ? ws.currentWorkspace.id : "null"}</span>
      <span data-testid="is-loading">{String(ws.isLoading)}</span>
      <button onClick={() => ws.setCurrentWorkspace(mockWorkspaces[1])}>SetWorkspace</button>
      <button onClick={() => ws.setCurrentWorkspace(null)}>ClearWorkspace</button>
      <button onClick={() => void ws.createWorkspace("New WS", "desc")}>CreateWorkspace</button>
      <button onClick={() => void ws.updateWorkspace("ws-1", "Updated", "new desc")}>UpdateWorkspace</button>
      <button onClick={() => void ws.addWorkspaceMember("ws-1", "user@e.com", "member")}>AddMember</button>
      <button onClick={() => void ws.removeWorkspaceMember("ws-1", "member-1")}>RemoveMember</button>
      <button onClick={() => void ws.getWorkspaceMembers("ws-1")}>GetMembers</button>
      <button onClick={() => void ws.refreshWorkspaces()}>Refresh</button>
    </div>
  );
}

function makeFetchResponse(body: unknown, ok = true, status = 200) {
  return Promise.resolve({
    ok,
    status,
    json: () => Promise.resolve(body),
  });
}

describe("WorkspaceContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockFetch.mockReset();
  });

  describe("useWorkspace", () => {
    it("throws when used outside WorkspaceProvider", () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

      expect(() => {
        renderHook(() => useWorkspace());
      }).toThrow("useWorkspace must be used within a WorkspaceProvider");

      consoleSpy.mockRestore();
    });
  });

  describe("Initial state", () => {
    it("has null workspaces and null currentWorkspace initially", () => {
      // Not authenticated, so no fetch should happen
      const Wrapper = createWrapper({ token: null, isAuthenticated: false, isLoading: false });

      render(
        <Wrapper>
          <WorkspaceConsumer />
        </Wrapper>
      );

      expect(screen.getByTestId("workspaces").textContent).toBe("null");
      expect(screen.getByTestId("current-workspace").textContent).toBe("null");
    });
  });

  describe("Fetching workspaces when authenticated", () => {
    it("fetches workspaces automatically when authenticated", async () => {
      mockFetch.mockReturnValueOnce(makeFetchResponse(mockWorkspaces));

      const Wrapper = createWrapper({ token: "valid-token", isAuthenticated: true, isLoading: false });

      render(
        <Wrapper>
          <WorkspaceConsumer />
        </Wrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId("workspaces").textContent).not.toBe("null");
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3001/api/workspaces",
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer valid-token",
          }) as Record<string, string>,
        })
      );

      // Should set the first workspace as current by default
      expect(screen.getByTestId("current-workspace").textContent).toBe("ws-1");
    });

    it("restores currentWorkspaceId from localStorage if it matches a fetched workspace", async () => {
      localStorage.setItem("currentWorkspaceId", "ws-2");
      mockFetch.mockReturnValueOnce(makeFetchResponse(mockWorkspaces));

      const Wrapper = createWrapper({ token: "valid-token", isAuthenticated: true, isLoading: false });

      render(
        <Wrapper>
          <WorkspaceConsumer />
        </Wrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId("current-workspace").textContent).toBe("ws-2");
      });
    });
  });

  describe("setCurrentWorkspace", () => {
    it("updates state and localStorage when setting a workspace", async () => {
      mockFetch.mockReturnValueOnce(makeFetchResponse(mockWorkspaces));

      const Wrapper = createWrapper({ token: "valid-token", isAuthenticated: true, isLoading: false });

      render(
        <Wrapper>
          <WorkspaceConsumer />
        </Wrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId("workspaces").textContent).not.toBe("null");
      });

      await act(async () => {
        screen.getByText("SetWorkspace").click();
      });

      expect(screen.getByTestId("current-workspace").textContent).toBe("ws-2");
      expect(localStorage.getItem("currentWorkspaceId")).toBe("ws-2");
    });

    it("clears state and localStorage when setting workspace to null", async () => {
      localStorage.setItem("currentWorkspaceId", "ws-1");
      mockFetch.mockReturnValueOnce(makeFetchResponse(mockWorkspaces));

      const Wrapper = createWrapper({ token: "valid-token", isAuthenticated: true, isLoading: false });

      render(
        <Wrapper>
          <WorkspaceConsumer />
        </Wrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId("workspaces").textContent).not.toBe("null");
      });

      await act(async () => {
        screen.getByText("ClearWorkspace").click();
      });

      expect(screen.getByTestId("current-workspace").textContent).toBe("null");
      expect(localStorage.getItem("currentWorkspaceId")).toBeNull();
    });
  });

  describe("createWorkspace", () => {
    it("calls API and refreshes workspace list on success", async () => {
      // First call: initial fetch of workspaces
      mockFetch.mockReturnValueOnce(makeFetchResponse(mockWorkspaces));

      const Wrapper = createWrapper({ token: "valid-token", isAuthenticated: true, isLoading: false });

      render(
        <Wrapper>
          <WorkspaceConsumer />
        </Wrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId("workspaces").textContent).not.toBe("null");
      });

      const newWorkspace: Workspace = {
        id: "ws-3",
        name: "New WS",
        description: "desc",
        owner_id: "user-1",
        created_at: "2024-01-03",
        role: "owner",
      };

      // Second call: create workspace POST
      mockFetch.mockReturnValueOnce(makeFetchResponse({ workspace: newWorkspace }));
      // Third call: refresh workspaces after creation
      mockFetch.mockReturnValueOnce(makeFetchResponse([...mockWorkspaces, newWorkspace]));

      await act(async () => {
        screen.getByText("CreateWorkspace").click();
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          "http://localhost:3001/api/workspaces",
          expect.objectContaining({
            method: "POST",
            body: JSON.stringify({ name: "New WS", description: "desc" }),
          })
        );
      });
    });
  });

  describe("updateWorkspace", () => {
    it("calls API with PUT method and refreshes workspace list", async () => {
      mockFetch.mockReturnValueOnce(makeFetchResponse(mockWorkspaces));

      const Wrapper = createWrapper({ token: "valid-token", isAuthenticated: true, isLoading: false });

      render(
        <Wrapper>
          <WorkspaceConsumer />
        </Wrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId("workspaces").textContent).not.toBe("null");
      });

      const updatedWorkspace = { ...mockWorkspaces[0], name: "Updated" };

      // PUT call
      mockFetch.mockReturnValueOnce(makeFetchResponse({ workspace: updatedWorkspace }));
      // Refresh call
      mockFetch.mockReturnValueOnce(makeFetchResponse(mockWorkspaces));

      await act(async () => {
        screen.getByText("UpdateWorkspace").click();
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          "http://localhost:3001/api/workspaces/ws-1",
          expect.objectContaining({
            method: "PUT",
            body: JSON.stringify({ name: "Updated", description: "new desc" }),
          })
        );
      });
    });
  });

  describe("addWorkspaceMember", () => {
    it("calls correct API endpoint with POST", async () => {
      mockFetch.mockReturnValueOnce(makeFetchResponse(mockWorkspaces));

      const Wrapper = createWrapper({ token: "valid-token", isAuthenticated: true, isLoading: false });

      render(
        <Wrapper>
          <WorkspaceConsumer />
        </Wrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId("workspaces").textContent).not.toBe("null");
      });

      mockFetch.mockReturnValueOnce(makeFetchResponse({}));

      await act(async () => {
        screen.getByText("AddMember").click();
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          "http://localhost:3001/api/workspaces/ws-1/members",
          expect.objectContaining({
            method: "POST",
            body: JSON.stringify({ email: "user@e.com", role: "member" }),
          })
        );
      });
    });
  });

  describe("removeWorkspaceMember", () => {
    it("calls correct API endpoint with DELETE", async () => {
      mockFetch.mockReturnValueOnce(makeFetchResponse(mockWorkspaces));

      const Wrapper = createWrapper({ token: "valid-token", isAuthenticated: true, isLoading: false });

      render(
        <Wrapper>
          <WorkspaceConsumer />
        </Wrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId("workspaces").textContent).not.toBe("null");
      });

      mockFetch.mockReturnValueOnce(makeFetchResponse({}));

      await act(async () => {
        screen.getByText("RemoveMember").click();
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          "http://localhost:3001/api/workspaces/ws-1/members/member-1",
          expect.objectContaining({
            method: "DELETE",
          })
        );
      });
    });
  });

  describe("getWorkspaceMembers", () => {
    it("calls correct API endpoint and returns members", async () => {
      mockFetch.mockReturnValueOnce(makeFetchResponse(mockWorkspaces));

      const Wrapper = createWrapper({ token: "valid-token", isAuthenticated: true, isLoading: false });

      render(
        <Wrapper>
          <WorkspaceConsumer />
        </Wrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId("workspaces").textContent).not.toBe("null");
      });

      const mockMembers = [
        { id: "m-1", name: "Member 1", email: "m1@e.com", role: "owner" },
        { id: "m-2", name: "Member 2", email: "m2@e.com", role: "member" },
      ];
      mockFetch.mockReturnValueOnce(makeFetchResponse(mockMembers));

      await act(async () => {
        screen.getByText("GetMembers").click();
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          "http://localhost:3001/api/workspaces/ws-1/members",
          expect.objectContaining({
            headers: expect.objectContaining({
              Authorization: "Bearer valid-token",
            }) as Record<string, string>,
          })
        );
      });
    });
  });

  describe("When user logs out", () => {
    it("clears workspaces when isAuthenticated becomes false", async () => {
      mockFetch.mockReturnValueOnce(makeFetchResponse(mockWorkspaces));

      const { rerender } = render(
        <AuthContext.Provider
          value={{
            user: { id: "user-1", name: "Test", email: "t@e.com" },
            token: "valid-token",
            isAuthenticated: true,
            isLoading: false,
            login: vi.fn(),
            register: vi.fn(),
            logout: vi.fn(),
          }}
        >
          <WorkspaceProvider>
            <WorkspaceConsumer />
          </WorkspaceProvider>
        </AuthContext.Provider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("workspaces").textContent).not.toBe("null");
      });

      // Re-render with not authenticated
      rerender(
        <AuthContext.Provider
          value={{
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
            login: vi.fn(),
            register: vi.fn(),
            logout: vi.fn(),
          }}
        >
          <WorkspaceProvider>
            <WorkspaceConsumer />
          </WorkspaceProvider>
        </AuthContext.Provider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("workspaces").textContent).toBe("null");
        expect(screen.getByTestId("current-workspace").textContent).toBe("null");
      });
    });
  });

  describe("refreshWorkspaces when not authenticated", () => {
    it("returns empty array when no token", async () => {
      const Wrapper = createWrapper({ token: null, isAuthenticated: false, isLoading: false });

      render(
        <Wrapper>
          <WorkspaceConsumer />
        </Wrapper>
      );

      await act(async () => {
        screen.getByText("Refresh").click();
      });

      // Should not have called fetch
      expect(mockFetch).not.toHaveBeenCalled();
      expect(screen.getByTestId("workspaces").textContent).toBe("null");
    });
  });
});
