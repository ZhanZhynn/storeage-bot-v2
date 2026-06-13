<script lang="ts">
  import { Button, Card, Input, Label } from "$lib/components/ui";
  import { locale } from "$lib/i18n";
  import { localSettingStore } from "$lib/local-setting/store";
  import { Eye, EyeOff, Store, ShoppingCart } from "lucide-svelte";

  function t(en: string, zh: string): string {
    return $locale === "zh-CN" ? zh : en;
  }

  let showShopeePartnerKey = $state(false);
  let showShopeeAccessToken = $state(false);
  let showShopeeRefreshToken = $state(false);
  let showLazadaAppSecret = $state(false);
  let showLazadaAccessToken = $state(false);
  let showLazadaRefreshToken = $state(false);

  const marketplace = $derived($localSettingStore.config.marketplace);

  function updateShopee(field: string, event: Event): void {
    const value = (event.currentTarget as HTMLInputElement).value;
    localSettingStore.updateConfig((config) => ({
      ...config,
      marketplace: {
        ...config.marketplace,
        shopee: { ...config.marketplace.shopee, [field]: value },
      },
    }));
  }

  function updateLazada(field: string, event: Event): void {
    const value = (event.currentTarget as HTMLInputElement).value;
    localSettingStore.updateConfig((config) => ({
      ...config,
      marketplace: {
        ...config.marketplace,
        lazada: { ...config.marketplace.lazada, [field]: value },
      },
    }));
  }
</script>

<div class="space-y-6">
  <div class="flex items-center justify-between">
    <div>
      <h2 class="text-lg font-semibold">{t("Marketplace Credentials", "市场凭据")}</h2>
      <p class="text-sm text-[hsl(var(--muted-foreground))]">{t("Shopee & Lazada API credentials. Saved on daemon restart or explicit Save.", "Shopee 和 Lazada API 凭据。重新启动守护程序或显式保存后生效。")}</p>
    </div>
    <Button
      on:click={() => void localSettingStore.saveConfig()}
      disabled={$localSettingStore.isSaving}
    >
      {$localSettingStore.isSaving ? t("Saving...", "保存中...") : t("Save", "保存")}
    </Button>
  </div>

  <Card className="p-5">
    <div class="mb-4 flex items-center gap-2">
      <Store class="h-5 w-5 text-[hsl(var(--muted-foreground))]" />
      <div>
        <h2 class="text-lg font-semibold">{t("Shopee", "Shopee")}</h2>
        <p class="text-sm text-[hsl(var(--muted-foreground))]">{t("Shopee API credentials", "Shopee API 凭据")}</p>
      </div>
    </div>

    <div class="grid gap-4 md:grid-cols-2">
      <div class="grid gap-2">
        <Label for="shopee-partner-id">{t("Partner ID", "Partner ID")}</Label>
        <Input id="shopee-partner-id" value={marketplace.shopee.partnerId} on:input={(e) => updateShopee("partnerId", e)} placeholder="123456" />
      </div>
      <div class="grid gap-2">
        <Label for="shopee-partner-key">{t("Partner Key", "Partner Key")}</Label>
        <div class="relative">
          <Input id="shopee-partner-key" type={showShopeePartnerKey ? "text" : "password"} value={marketplace.shopee.partnerKey} on:input={(e) => updateShopee("partnerKey", e)} autocomplete="new-password" />
          <button type="button" class="absolute right-2 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" onclick={() => showShopeePartnerKey = !showShopeePartnerKey}>
            {#if showShopeePartnerKey}<EyeOff class="h-4 w-4" />{:else}<Eye class="h-4 w-4" />{/if}
          </button>
        </div>
      </div>
      <div class="grid gap-2">
        <Label for="shopee-shop-id">{t("Shop ID", "Shop ID")}</Label>
        <Input id="shopee-shop-id" value={marketplace.shopee.shopId} on:input={(e) => updateShopee("shopId", e)} placeholder="123456" />
      </div>
      <div class="grid gap-2">
        <Label for="shopee-access-token">{t("Access Token", "Access Token")}</Label>
        <div class="relative">
          <Input id="shopee-access-token" type={showShopeeAccessToken ? "text" : "password"} value={marketplace.shopee.accessToken} on:input={(e) => updateShopee("accessToken", e)} autocomplete="new-password" />
          <button type="button" class="absolute right-2 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" onclick={() => showShopeeAccessToken = !showShopeeAccessToken}>
            {#if showShopeeAccessToken}<EyeOff class="h-4 w-4" />{:else}<Eye class="h-4 w-4" />{/if}
          </button>
        </div>
      </div>
      <div class="grid gap-2">
        <Label for="shopee-refresh-token">{t("Refresh Token", "Refresh Token")}</Label>
        <div class="relative">
          <Input id="shopee-refresh-token" type={showShopeeRefreshToken ? "text" : "password"} value={marketplace.shopee.refreshToken} on:input={(e) => updateShopee("refreshToken", e)} autocomplete="new-password" />
          <button type="button" class="absolute right-2 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" onclick={() => showShopeeRefreshToken = !showShopeeRefreshToken}>
            {#if showShopeeRefreshToken}<EyeOff class="h-4 w-4" />{:else}<Eye class="h-4 w-4" />{/if}
          </button>
        </div>
      </div>
      <div class="grid gap-2">
        <Label for="shopee-region">{t("Region", "地区")}</Label>
        <Input id="shopee-region" value={marketplace.shopee.region} on:input={(e) => updateShopee("region", e)} placeholder="MY" />
      </div>
      <div class="grid gap-2">
        <Label for="shopee-environment">{t("Environment", "环境")}</Label>
        <Input id="shopee-environment" value={marketplace.shopee.environment} on:input={(e) => updateShopee("environment", e)} placeholder="production" />
      </div>
    </div>
  </Card>

  <Card className="p-5">
    <div class="mb-4 flex items-center gap-2">
      <ShoppingCart class="h-5 w-5 text-[hsl(var(--muted-foreground))]" />
      <div>
        <h2 class="text-lg font-semibold">{t("Lazada", "Lazada")}</h2>
        <p class="text-sm text-[hsl(var(--muted-foreground))]">{t("Lazada API credentials", "Lazada API 凭据")}</p>
      </div>
    </div>

    <div class="grid gap-4 md:grid-cols-2">
      <div class="grid gap-2">
        <Label for="lazada-app-key">{t("App Key", "App Key")}</Label>
        <Input id="lazada-app-key" value={marketplace.lazada.appKey} on:input={(e) => updateLazada("appKey", e)} placeholder="123456" />
      </div>
      <div class="grid gap-2">
        <Label for="lazada-app-secret">{t("App Secret", "App Secret")}</Label>
        <div class="relative">
          <Input id="lazada-app-secret" type={showLazadaAppSecret ? "text" : "password"} value={marketplace.lazada.appSecret} on:input={(e) => updateLazada("appSecret", e)} autocomplete="new-password" />
          <button type="button" class="absolute right-2 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" onclick={() => showLazadaAppSecret = !showLazadaAppSecret}>
            {#if showLazadaAppSecret}<EyeOff class="h-4 w-4" />{:else}<Eye class="h-4 w-4" />{/if}
          </button>
        </div>
      </div>
      <div class="grid gap-2">
        <Label for="lazada-access-token">{t("Access Token", "Access Token")}</Label>
        <div class="relative">
          <Input id="lazada-access-token" type={showLazadaAccessToken ? "text" : "password"} value={marketplace.lazada.accessToken} on:input={(e) => updateLazada("accessToken", e)} autocomplete="new-password" />
          <button type="button" class="absolute right-2 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" onclick={() => showLazadaAccessToken = !showLazadaAccessToken}>
            {#if showLazadaAccessToken}<EyeOff class="h-4 w-4" />{:else}<Eye class="h-4 w-4" />{/if}
          </button>
        </div>
      </div>
      <div class="grid gap-2">
        <Label for="lazada-refresh-token">{t("Refresh Token", "Refresh Token")}</Label>
        <div class="relative">
          <Input id="lazada-refresh-token" type={showLazadaRefreshToken ? "text" : "password"} value={marketplace.lazada.refreshToken} on:input={(e) => updateLazada("refreshToken", e)} autocomplete="new-password" />
          <button type="button" class="absolute right-2 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" onclick={() => showLazadaRefreshToken = !showLazadaRefreshToken}>
            {#if showLazadaRefreshToken}<EyeOff class="h-4 w-4" />{:else}<Eye class="h-4 w-4" />{/if}
          </button>
        </div>
      </div>
      <div class="grid gap-2">
        <Label for="lazada-region">{t("Region", "地区")}</Label>
        <Input id="lazada-region" value={marketplace.lazada.region} on:input={(e) => updateLazada("region", e)} placeholder="MY" />
      </div>
    </div>
  </Card>
</div>
