import type { EventBus } from "@/application/ports/event-bus.js";
import type { DomainEvent } from "@/domain/shared/domain-event.js";

export class RecordingEventBus implements EventBus {
  published: { events: DomainEvent[]; correlationId: string }[] = [];
  async publishAll(
    events: DomainEvent[],
    correlationId: string,
  ): Promise<void> {
    this.published.push({ events: [...events], correlationId });
  }
  flat(): DomainEvent[] {
    return this.published.flatMap((p) => p.events);
  }
  ofType<T extends DomainEvent>(type: new (...args: never[]) => T): T[] {
    return this.flat().filter((e): e is T => e instanceof type);
  }
}
