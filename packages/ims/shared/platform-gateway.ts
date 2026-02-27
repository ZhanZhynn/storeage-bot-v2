import type { RawInboundEvent } from "@/core/model/raw-inbound-event";

export interface PlatformGateway {
  start(onEvent: (event: RawInboundEvent) => Promise<void>): Promise<void>;
  stop(): Promise<void>;
}
