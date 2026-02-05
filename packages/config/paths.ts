import { join, resolve } from "path";

const isNodeRuntime =
  typeof process !== "undefined" &&
  typeof process.versions === "object" &&
  Boolean(process.versions.node);

const homeDir = isNodeRuntime
  ? process.env.HOME || process.env.USERPROFILE || ""
  : "";

const cwd = isNodeRuntime && typeof process.cwd === "function" ? process.cwd() : "/";

export function normalizeCwd(input: string): string {
  if (!input) return cwd;
  if (input === "~") return homeDir || cwd;
  if (input.startsWith("~/")) {
    return resolve(join(homeDir || cwd, input.slice(2)));
  }
  return resolve(input);
}
