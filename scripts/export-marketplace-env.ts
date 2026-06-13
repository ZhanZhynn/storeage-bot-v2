import { readFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const ODE_CONFIG_DIR = join(homedir(), ".config", "ode");
const ODE_CONFIG_FILE = join(ODE_CONFIG_DIR, "ode.json");

function readConfig(): Record<string, unknown> | null {
  try {
    const raw = readFileSync(ODE_CONFIG_FILE, "utf-8");
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function main(): void {
  const config = readConfig();
  if (!config) {
    console.error("Ode config not found at", ODE_CONFIG_FILE);
    process.exit(1);
  }

  const marketplace = config.marketplace as Record<string, Record<string, string>> | undefined;
  if (!marketplace) {
    console.log("# No marketplace credentials configured.");
    process.exit(0);
  }

  const shopee = marketplace.shopee as Record<string, string> | undefined;
  if (shopee) {
    if (shopee.partnerId) console.log(`export BOLTY_SHOPEE_PARTNER_ID=${JSON.stringify(shopee.partnerId)}`);
    if (shopee.partnerKey) console.log(`export BOLTY_SHOPEE_PARTNER_KEY=${JSON.stringify(shopee.partnerKey)}`);
    if (shopee.shopId) console.log(`export BOLTY_SHOPEE_SHOP_ID=${JSON.stringify(shopee.shopId)}`);
    if (shopee.accessToken) console.log(`export BOLTY_SHOPEE_ACCESS_TOKEN=${JSON.stringify(shopee.accessToken)}`);
    if (shopee.refreshToken) console.log(`export BOLTY_SHOPEE_REFRESH_TOKEN=${JSON.stringify(shopee.refreshToken)}`);
    if (shopee.region) console.log(`export BOLTY_SHOPEE_REGION=${JSON.stringify(shopee.region)}`);
    if (shopee.environment) console.log(`export BOLTY_SHOPEE_ENVIRONMENT=${JSON.stringify(shopee.environment)}`);
  }

  const lazada = marketplace.lazada as Record<string, string> | undefined;
  if (lazada) {
    if (lazada.appKey) console.log(`export BOLTY_LAZADA_APP_KEY=${JSON.stringify(lazada.appKey)}`);
    if (lazada.appSecret) console.log(`export BOLTY_LAZADA_APP_SECRET=${JSON.stringify(lazada.appSecret)}`);
    if (lazada.accessToken) console.log(`export BOLTY_LAZADA_ACCESS_TOKEN=${JSON.stringify(lazada.accessToken)}`);
    if (lazada.refreshToken) console.log(`export BOLTY_LAZADA_REFRESH_TOKEN=${JSON.stringify(lazada.refreshToken)}`);
    if (lazada.region) console.log(`export BOLTY_LAZADA_REGION=${JSON.stringify(lazada.region)}`);
  }
}

main();
