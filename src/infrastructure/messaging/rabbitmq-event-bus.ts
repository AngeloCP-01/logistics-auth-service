import amqp from "amqplib";
import type { Channel, ChannelModel } from "amqplib";

import type { EventBus } from "../../application/ports/event-bus.js";
import type { DomainEvent } from "../../domain/shared/domain-event.js";
import { InfrastructureError } from "../shared/errors.js";
import { mapDomainEvent } from "./event-mappers.js";

const EXCHANGE = "logistics.events";

export class RabbitMqEventBus implements EventBus {
  private connection: ChannelModel | null = null;
  private channel: Channel | null = null;

  constructor(private readonly url: string) {}

  async connect(): Promise<void> {
    this.connection = await amqp.connect(this.url);
    this.channel = await this.connection.createChannel();
    await this.channel.assertExchange(EXCHANGE, "topic", { durable: true });
  }

  async close(): Promise<void> {
    if (this.channel) await this.channel.close();
    if (this.connection) await this.connection.close();
    this.channel = null;
    this.connection = null;
  }

  async publishAll(
    events: DomainEvent[],
    correlationId: string,
  ): Promise<void> {
    if (!this.channel)
      throw new InfrastructureError(
        "rabbit_not_connected",
        "RabbitMqEventBus.connect() must be called first",
      );
    for (const e of events) {
      const out = mapDomainEvent(e, correlationId);
      const body = Buffer.from(JSON.stringify(out.envelope));
      const ok = this.channel.publish(EXCHANGE, out.routingKey, body, {
        contentType: "application/json",
        persistent: true,
        messageId: out.envelope.eventId as string,
        correlationId,
        timestamp: Math.floor(Date.now() / 1000),
      });
      if (!ok) await new Promise((res) => this.channel!.once("drain", res));
    }
  }
}
