import {
  RabbitMQContainer,
  StartedRabbitMQContainer,
} from "@testcontainers/rabbitmq";

export interface TestRabbit {
  container: StartedRabbitMQContainer;
  url: string;
}

export async function startRabbit(): Promise<TestRabbit> {
  const container = await new RabbitMQContainer(
    "rabbitmq:3.13-management",
  ).start();
  return { container, url: container.getAmqpUrl() };
}

export async function stopRabbit(r: TestRabbit): Promise<void> {
  await r.container.stop();
}
