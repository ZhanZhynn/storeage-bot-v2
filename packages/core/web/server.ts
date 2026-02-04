import { existsSync } from "fs";
import { join, resolve, sep } from "path";
import {
  readLocalSettings,
  syncSlackWorkspace,
  writeLocalSettings,
} from "./local-settings";
import {
  defaultDashboardConfig,
  sanitizeDashboardConfig,
} from "@ode/config";
import { handleSlackActionPayload } from "@ode/ims";
import { log } from "@ode/utils";

const DEFAULT_WEB_HOST = "127.0.0.1";
const DEFAULT_WEB_PORT = 9293;
const DEFAULT_WEB_BUILD_DIR = join(process.cwd(), "packages", "web-ui", "build");

let webServer: ReturnType<typeof Bun.serve> | null = null;

type JsonResponse = {
  ok: boolean;
  error?: string;
  config?: typeof defaultDashboardConfig;
  workspace?: (typeof defaultDashboardConfig)["workspaces"][number];
  providers?: unknown;
  result?: unknown;
};

function parsePort(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function getWebHost(): string {
  return process.env.ODE_WEB_HOST?.trim() || DEFAULT_WEB_HOST;
}

function getWebPort(): number {
  return parsePort(process.env.ODE_WEB_PORT?.trim(), DEFAULT_WEB_PORT);
}

function jsonResponse(status: number, payload: JsonResponse): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function resolveAssetPath(pathname: string): string {
  if (pathname === "/") return "/index.html";
  if (pathname === "/local-setting") return "/local-setting.html";
  if (pathname.startsWith("/local-setting/")) return "/local-setting.html";
  if (pathname.endsWith("/")) return `${pathname.slice(0, -1)}.html`;
  return pathname;
}

function getWebBuildDir(): string {
  return process.env.ODE_WEB_BUILD_DIR?.trim() || DEFAULT_WEB_BUILD_DIR;
}

function normalizePath(pathname: string): string {
  if (!pathname.startsWith("/")) return `/${pathname}`;
  return pathname;
}

function resolveFilePath(buildDir: string, pathname: string): string | null {
  const normalized = normalizePath(pathname).replace(/\0/g, "");
  const resolved = resolve(buildDir, `.${normalized}`);
  if (!resolved.startsWith(`${buildDir}${sep}`) && resolved !== buildDir) {
    return null;
  }
  return resolved;
}

function getContentType(pathname: string): string {
  const lower = pathname.toLowerCase();
  if (lower.endsWith(".html")) return "text/html; charset=utf-8";
  if (lower.endsWith(".css")) return "text/css; charset=utf-8";
  if (lower.endsWith(".js")) return "application/javascript; charset=utf-8";
  if (lower.endsWith(".json")) return "application/json; charset=utf-8";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".ico")) return "image/x-icon";
  if (lower.endsWith(".woff2")) return "font/woff2";
  if (lower.endsWith(".woff")) return "font/woff";
  if (lower.endsWith(".ttf")) return "font/ttf";
  if (lower.endsWith(".otf")) return "font/otf";
  if (lower.endsWith(".map")) return "application/json; charset=utf-8";
  return "application/octet-stream";
}

async function handleRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const pathname = url.pathname;

  if (pathname === "/") {
    return new Response(null, {
      status: 307,
      headers: { location: "/local-setting" },
    });
  }

  if (pathname.startsWith("/local-setting/opencode/") || pathname.startsWith("/local-setting/slack-bot/")) {
    return new Response(null, {
      status: 307,
      headers: { location: "/local-setting" },
    });
  }

  if (pathname === "/api/config") {
    if (request.method === "GET") {
      const config = await readLocalSettings();
      return jsonResponse(200, { ok: true, config });
    }
    if (request.method === "PUT") {
      try {
        const payload = await request.json();
        const sanitized = sanitizeDashboardConfig(payload);
        await writeLocalSettings(sanitized);
        return jsonResponse(200, { ok: true, config: sanitized });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Invalid payload";
        return jsonResponse(400, { ok: false, error: message });
      }
    }
    return jsonResponse(405, { ok: false, error: "Method not allowed" });
  }

  if (pathname === "/api/slack-sync") {
    if (request.method !== "POST") {
      return jsonResponse(405, { ok: false, error: "Method not allowed" });
    }
    try {
      const payload = (await request.json()) as Record<string, unknown>;
      const workspaceId = typeof payload.workspaceId === "string" ? payload.workspaceId : "";
      if (!workspaceId) {
        return jsonResponse(400, { ok: false, error: "Missing workspaceId" });
      }
      const workspace = await syncSlackWorkspace(workspaceId);
      return jsonResponse(200, { ok: true, workspace });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Slack sync failed";
      return jsonResponse(500, { ok: false, error: message });
    }
  }

  if (pathname === "/api/opencode-sync") {
    if (request.method !== "POST") {
      return jsonResponse(405, { ok: false, error: "Method not allowed" });
    }
    try {
      const payload = (await request.json()) as Record<string, unknown>;
      const serverUrl = typeof payload.serverUrl === "string" ? payload.serverUrl.trim() : "";
      if (!serverUrl) {
        return jsonResponse(400, { ok: false, error: "Missing serverUrl" });
      }
      const endpoint = new URL("/config/providers", serverUrl).toString();
      const response = await fetch(endpoint);
      if (!response.ok) {
        return jsonResponse(400, { ok: false, error: `${response.status} ${response.statusText}`.trim() });
      }
      const providers = await response.json();
      return jsonResponse(200, { ok: true, providers });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Provider sync failed";
      return jsonResponse(500, { ok: false, error: message });
    }
  }

  if (pathname === "/api/action") {
    if (request.method !== "POST") {
      return jsonResponse(405, { ok: false, error: "Method not allowed" });
    }

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return jsonResponse(400, { ok: false, error: "Invalid JSON payload" });
    }

    const response = await handleSlackActionPayload(payload);
    return jsonResponse(response.ok ? 200 : 400, response);
  }

  const buildDir = getWebBuildDir();
  if (!existsSync(buildDir)) {
    return new Response("Web UI build not found", { status: 404 });
  }

  const resolvedPath = resolveAssetPath(pathname);
  let filePath = resolveFilePath(buildDir, resolvedPath);
  if (!filePath) return new Response("Not found", { status: 404 });

  let file = Bun.file(filePath);
  if (!(await file.exists())) {
    const acceptsHtml = request.headers.get("accept")?.includes("text/html");
    if (acceptsHtml) {
      filePath = resolveFilePath(buildDir, "/index.html");
      if (!filePath) return new Response("Not found", { status: 404 });
      file = Bun.file(filePath);
    }
  }

  if (!(await file.exists())) return new Response("Not found", { status: 404 });

  return new Response(file, {
    status: 200,
    headers: { "content-type": getContentType(filePath) },
  });
}

export function hasWebUiBuild(): boolean {
  return existsSync(getWebBuildDir());
}

export function startLocalWebServer(): void {
  if (webServer) return;
  if (!hasWebUiBuild()) {
    log.info("Web UI build not found; serving API only", { buildDir: getWebBuildDir() });
  }

  const host = getWebHost();
  const port = getWebPort();

  webServer = Bun.serve({
    hostname: host,
    port,
    fetch: handleRequest,
  });

  log.info("Web UI server started", { host, port });
}

export function stopLocalWebServer(): void {
  if (!webServer) return;
  webServer.stop();
  webServer = null;
  log.info("Web UI server stopped");
}
