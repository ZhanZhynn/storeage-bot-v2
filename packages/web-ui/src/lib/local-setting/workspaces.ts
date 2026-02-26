import type { DashboardConfig } from "../localConfig";

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function getWorkspacePath(workspace: DashboardConfig["workspaces"][number]): string {
  return `/workspace/${encodeURIComponent(getWorkspaceRouteKey(workspace))}`;
}

function getWorkspaceIdSuffix(workspaceId: string): string {
  const compact = workspaceId.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!compact) return "0000";
  return compact.slice(-4).padStart(4, "0");
}

export function getWorkspaceRouteKey(workspace: DashboardConfig["workspaces"][number]): string {
  const nameSlug = slugify(workspace.name) || "workspace";
  return `${nameSlug}-${getWorkspaceIdSuffix(workspace.id)}`;
}

export function getSelectedWorkspace(
  workspaceName: string | undefined,
  workspaces: DashboardConfig["workspaces"]
): DashboardConfig["workspaces"][number] | null {
  if (!workspaces.length) return null;
  if (!workspaceName) return workspaces[0] ?? null;
  const normalizedWorkspaceName = decodeURIComponent(workspaceName);

  const byId = workspaces.find((workspace: DashboardConfig["workspaces"][number]) => workspace.id === normalizedWorkspaceName);
  if (byId) return byId;

  const byRouteKey = workspaces.find(
    (workspace: DashboardConfig["workspaces"][number]) => getWorkspaceRouteKey(workspace) === normalizedWorkspaceName
  );
  if (byRouteKey) return byRouteKey;

  return (
    workspaces.find((workspace: DashboardConfig["workspaces"][number]) => slugify(workspace.name) === normalizedWorkspaceName) ??
    workspaces[0] ??
    null
  );
}
