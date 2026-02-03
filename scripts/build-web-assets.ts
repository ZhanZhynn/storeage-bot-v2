import { readdir, readFile, writeFile, stat } from "fs/promises";
import { join, extname, relative } from "path";

const BUILD_DIR = join(process.cwd(), "web", "build");
const OUTPUT_FILE = join(process.cwd(), "src", "web", "assets.ts");

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".map": "application/json; charset=utf-8",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};

const listFiles = async (dir: string): Promise<string[]> => {
  const entries = await readdir(dir);
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stats = await stat(fullPath);
    if (stats.isDirectory()) {
      files.push(...await listFiles(fullPath));
      continue;
    }
    files.push(fullPath);
  }
  return files;
};

const toAssetPath = (filePath: string) => {
  const rel = relative(BUILD_DIR, filePath).split("\\").join("/");
  return `/${rel}`;
};

const getContentType = (filePath: string) => {
  const ext = extname(filePath).toLowerCase();
  return CONTENT_TYPES[ext] ?? "application/octet-stream";
};

const build = async () => {
  const files = await listFiles(BUILD_DIR);
  const entries = [] as string[];

  for (const filePath of files) {
    const data = await readFile(filePath);
    const assetPath = toAssetPath(filePath);
    const contentType = getContentType(filePath);
    const encoded = data.toString("base64");
    entries.push(`  ${JSON.stringify(assetPath)}: { body: ${JSON.stringify(encoded)}, contentType: ${JSON.stringify(contentType)}, encoding: "base64" }`);
  }

  const source = [
    "export type WebAsset = {",
    "  body: string;",
    "  contentType: string;",
    "  encoding: \"base64\" | \"utf-8\";",
    "};",
    "",
    "export const webAssets: Record<string, WebAsset> = {",
    entries.join(",\n"),
    "};",
    "",
  ].join("\n");

  await writeFile(OUTPUT_FILE, source, "utf-8");
};

await build();
