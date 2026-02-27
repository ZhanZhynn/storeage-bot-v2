import type { RawInboundEvent } from "@/core/model/raw-inbound-event";

export interface CommandService {
  handle(event: RawInboundEvent, commandName: string, args: string[]): Promise<void>;
}
