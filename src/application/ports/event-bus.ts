import type { DomainEvent } from "../../domain/shared/domain-event.js";

export interface EventBus {
  publishAll(events: DomainEvent[], correlationId: string): Promise<void>;
}
