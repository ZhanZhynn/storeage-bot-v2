import { homedir } from "os";
import { join, resolve } from "path";

export function normalizeCwd(input: string): string {
  if (!input) return process.cwd();
  if (input === "~") return homedir();
  if (input.startsWith("~/")) {
    return resolve(join(homedir(), input.slice(2)));
  }
  return resolve(input);
}
