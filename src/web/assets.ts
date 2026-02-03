export type WebAsset = {
  body: string;
  contentType: string;
  encoding: "base64" | "utf-8";
};

export const webAssets: Record<string, WebAsset> = {};
