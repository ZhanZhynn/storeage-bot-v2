import { readDashboardConfig, type DashboardConfig } from "@/config";

export function applyMarketplaceEnvVars(marketplace: DashboardConfig["marketplace"]): void {
  const { shopee, lazada } = marketplace;
  if (shopee.partnerId) process.env.BOLTY_SHOPEE_PARTNER_ID = shopee.partnerId;
  if (shopee.partnerKey) process.env.BOLTY_SHOPEE_PARTNER_KEY = shopee.partnerKey;
  if (shopee.shopId) process.env.BOLTY_SHOPEE_SHOP_ID = shopee.shopId;
  if (shopee.accessToken) process.env.BOLTY_SHOPEE_ACCESS_TOKEN = shopee.accessToken;
  if (shopee.refreshToken) process.env.BOLTY_SHOPEE_REFRESH_TOKEN = shopee.refreshToken;
  if (shopee.region) process.env.BOLTY_SHOPEE_REGION = shopee.region;
  if (shopee.environment) process.env.BOLTY_SHOPEE_ENVIRONMENT = shopee.environment;
  if (lazada.appKey) process.env.BOLTY_LAZADA_APP_KEY = lazada.appKey;
  if (lazada.appSecret) process.env.BOLTY_LAZADA_APP_SECRET = lazada.appSecret;
  if (lazada.accessToken) process.env.BOLTY_LAZADA_ACCESS_TOKEN = lazada.accessToken;
  if (lazada.refreshToken) process.env.BOLTY_LAZADA_REFRESH_TOKEN = lazada.refreshToken;
  if (lazada.region) process.env.BOLTY_LAZADA_REGION = lazada.region;
}

export function applyMarketplaceEnvVarsFromConfig(): void {
  try {
    const config = readDashboardConfig();
    applyMarketplaceEnvVars(config.marketplace);
  } catch {
    // config may not exist yet; silently skip
  }
}
