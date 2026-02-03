export type RunMode = "local" | "cloud";

let cachedMode: RunMode | null = null;

function parseModeFromArgs(): RunMode {
  const args = process.argv.slice(2);
  if (args.includes("--cloud")) return "cloud";
  if (args.includes("--local")) return "local";
  return "local";
}

export function getRunMode(): RunMode {
  if (cachedMode) return cachedMode;
  cachedMode = parseModeFromArgs();
  return cachedMode;
}

export function isLocalMode(): boolean {
  return getRunMode() === "local";
}

export function isCloudMode(): boolean {
  return getRunMode() === "cloud";
}
