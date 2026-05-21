export abstract class DomainEvent {
  abstract readonly eventType: string;
  abstract readonly occurredAt: Date;
}
