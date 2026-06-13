export * from "./slack";
export * from "./discord";
export * from "./lark";
export {
  sendTelegramMessage,
  uploadTelegramFile,
  getTelegramThreadMessages,
  addTelegramReaction,
  getTelegramBotToken,
  getTelegramBotTokens,
} from "./telegram";
export {
  deliveryStats,
  renderDeliveryStatsForSlack,
  isRateLimitError,
  defaultDumpPath as defaultDeliveryStatsDumpPath,
} from "./shared/delivery-stats";

import { recoverPendingRequests as recoverSlackPendingRequests } from "./slack/client";
import { recoverPendingRequests as recoverDiscordPendingRequests } from "./discord/client";
import { recoverPendingRequests as recoverLarkPendingRequests } from "./lark/client";
import { recoverPendingRequests as recoverTelegramPendingRequests } from "./telegram/client";

export async function recoverPendingRequestsAcrossPlatforms(): Promise<void> {
  await recoverSlackPendingRequests();
  await recoverDiscordPendingRequests();
  await recoverLarkPendingRequests();
  await recoverTelegramPendingRequests();
}
