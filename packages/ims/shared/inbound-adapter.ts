import type { InboundDecision } from "@/core/model/inbound-decision";
import type { RawInboundEvent } from "@/core/model/raw-inbound-event";

export interface InboundAdapter {
  evaluate(event: RawInboundEvent): InboundDecision;
}
