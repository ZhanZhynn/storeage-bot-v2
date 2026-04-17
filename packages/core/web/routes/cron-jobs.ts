import type { Elysia } from "elysia";
import {
  createCronJob,
  deleteCronJob,
  listCronJobChannelOptions,
  listCronJobs,
  updateCronJob,
} from "@/config/local/cron-jobs";
import { jsonResponse, readJsonBody, runRoute } from "../http";

function getString(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  return typeof value === "string" ? value : "";
}

function getBoolean(payload: Record<string, unknown>, key: string): boolean | undefined {
  const value = payload[key];
  return typeof value === "boolean" ? value : undefined;
}

function parseCronJobPayload(payload: Record<string, unknown>) {
  return {
    title: getString(payload, "title"),
    cronExpression: getString(payload, "cronExpression"),
    channelId: getString(payload, "channelId"),
    messageText: getString(payload, "messageText"),
    enabled: getBoolean(payload, "enabled"),
  };
}

export function registerCronJobRoutes(app: Elysia): void {
  app.get("/api/cron-jobs", async () => {
    return runRoute(
      async () => ({
        jobs: listCronJobs(),
        channels: listCronJobChannelOptions(),
      }),
      (result) => jsonResponse(200, { ok: true, result }),
      { fallbackMessage: "Internal server error", status: 500 }
    );
  });

  app.post("/api/cron-jobs", async ({ request }: { request: Request }) => {
    return runRoute(
      async () => {
        const payload = parseCronJobPayload(await readJsonBody(request));
        const job = createCronJob(payload);
        return {
          job,
          jobs: listCronJobs(),
          channels: listCronJobChannelOptions(),
        };
      },
      (result) => jsonResponse(200, { ok: true, result }),
      { fallbackMessage: "Invalid cron job payload", status: 400 }
    );
  });

  app.put("/api/cron-jobs/:id", async ({ params, request }: { params: { id?: string }; request: Request }) => {
    return runRoute(
      async () => {
        const id = params.id?.trim();
        if (!id) {
          throw new Error("Missing cron job id");
        }
        const payload = parseCronJobPayload(await readJsonBody(request));
        const job = updateCronJob(id, payload);
        return {
          job,
          jobs: listCronJobs(),
          channels: listCronJobChannelOptions(),
        };
      },
      (result) => jsonResponse(200, { ok: true, result }),
      {
        fallbackMessage: "Invalid cron job payload",
        resolveStatus: (message) => {
          if (message === "Missing cron job id") return 400;
          if (message === "Cron job not found") return 404;
          return 400;
        },
      }
    );
  });

  app.delete("/api/cron-jobs/:id", async ({ params }: { params: { id?: string } }) => {
    return runRoute(
      async () => {
        const id = params.id?.trim();
        if (!id) {
          throw new Error("Missing cron job id");
        }
        deleteCronJob(id);
        return {
          jobs: listCronJobs(),
          channels: listCronJobChannelOptions(),
        };
      },
      (result) => jsonResponse(200, { ok: true, result }),
      {
        fallbackMessage: "Failed to delete cron job",
        resolveStatus: (message) => (message === "Missing cron job id" ? 400 : 400),
      }
    );
  });
}
