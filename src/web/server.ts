import { webAssets } from "./assets";
import { defaultDashboardConfig, readLocalSettings, sanitizeDashboardConfig, syncSlackWorkspace, writeLocalSettings } from "./local-settings";
import { log } from "../logger";

const DEFAULT_WEB_HOST = "127.0.0.1";
const DEFAULT_WEB_PORT = 9293;

let webServer: ReturnType<typeof Bun.serve> | null = null;

type JsonResponse = {
  ok: boolean;
  error?: string;
  config?: typeof defaultDashboardConfig;
  workspace?: (typeof defaultDashboardConfig)["workspaces"][number];
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

function decodeAsset(asset: { body: string; encoding: "base64" | "utf-8" }): Uint8Array {
  if (asset.encoding === "base64") {
    return Uint8Array.from(Buffer.from(asset.body, "base64"));
  }
  return new TextEncoder().encode(asset.body);
}

function resolveAssetPath(pathname: string): string {
  if (pathname === "/") return "/index.html";
  if (pathname === "/local-setting") return "/local-setting.html";
  if (pathname.startsWith("/local-setting/")) return "/local-setting.html";
  if (pathname.endsWith("/")) return `${pathname.slice(0, -1)}.html`;
  return pathname;
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

  if (pathname === "/local-setting/config") {
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

  if (pathname === "/local-setting/slack-sync") {
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

  if (Object.keys(webAssets).length === 0) {
    return new Response("Web UI assets not bundled", { status: 404 });
  }

  const resolvedPath = resolveAssetPath(pathname);
  let asset = webAssets[resolvedPath];
  if (!asset) {
    const acceptsHtml = request.headers.get("accept")?.includes("text/html");
    if (acceptsHtml && webAssets["/index.html"]) {
      asset = webAssets["/index.html"];
    }
  }

  if (!asset) return new Response("Not found", { status: 404 });

  return new Response(decodeAsset(asset), {
    status: 200,
    headers: { "content-type": asset.contentType },
  });
}

export function hasEmbeddedWebAssets(): boolean {
  return Object.keys(webAssets).length > 0;
}

export function startLocalWebServer(): void {
  if (webServer) return;
  if (!hasEmbeddedWebAssets()) {
    log.info("Web UI assets not bundled; skipping web UI server");
    return;
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
