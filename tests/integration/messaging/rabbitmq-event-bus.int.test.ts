import amqp from "amqplib";

import { Email } from "@/domain/shared/email.js";
import { UserId } from "@/domain/shared/ids.js";
import { UserRegistered } from "@/domain/user/events.js";
import { RabbitMqEventBus } from "@/infrastructure/messaging/rabbitmq-event-bus.js";
import {
  startRabbit,
  stopRabbit,
  type TestRabbit,
} from "@tests/integration/helpers/rabbitmq-container.js";

let rabbit: TestRabbit;
beforeAll(async () => {
  rabbit = await startRabbit();
}, 120000);
afterAll(async () => {
  if (rabbit) await stopRabbit(rabbit);
});

describe("RabbitMqEventBus", () => {
  it("publishes user.registered to the topic exchange, consumable by a temp queue", async () => {
    const bus = new RabbitMqEventBus(rabbit.url);
    await bus.connect();

    const conn = await amqp.connect(rabbit.url);
    const ch = await conn.createChannel();
    await ch.assertExchange("logistics.events", "topic", { durable: true });
    const q = await ch.assertQueue("", { exclusive: true });
    await ch.bindQueue(q.queue, "logistics.events", "user.registered");

    const userId = UserId.generate();
    const email = Email.of("a@b.com");
    const evt = new UserRegistered(userId, email, "customer", new Date());
    await bus.publishAll([evt], "corr-1");

    const received = await new Promise<unknown>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error("no message in 5s")),
        5000,
      );
      ch.consume(
        q.queue,
        (msg) => {
          if (!msg) return;
          clearTimeout(timeout);
          ch.ack(msg);
          resolve(JSON.parse(msg.content.toString()));
        },
        { noAck: false },
      );
    });

    expect(received).toMatchObject({
      eventType: "user.registered",
      producer: "auth-service",
      correlationId: "corr-1",
      data: { userId, email: "a@b.com", role: "customer" },
    });

    await ch.close();
    await conn.close();
    await bus.close();
  });
});
