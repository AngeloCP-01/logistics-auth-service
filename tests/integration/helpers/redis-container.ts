import { RedisContainer, StartedRedisContainer } from "@testcontainers/redis";
import { Redis } from "ioredis";

export interface TestRedis {
  container: StartedRedisContainer;
  client: Redis;
  url: string;
}

export async function startRedis(): Promise<TestRedis> {
  const container = await new RedisContainer("redis:7-alpine").start();
  const url = container.getConnectionUrl();
  const client = new Redis(url);
  return { container, client, url };
}

export async function stopRedis(r: TestRedis): Promise<void> {
  await r.client.quit();
  await r.container.stop();
}
