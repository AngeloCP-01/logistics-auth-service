import { RedisRateLimiter } from "@/infrastructure/rate-limit/redis-rate-limiter.js";
import {
  startRedis,
  stopRedis,
  type TestRedis,
} from "@tests/integration/helpers/redis-container.js";

let redis: TestRedis;
beforeAll(async () => {
  redis = await startRedis();
}, 60000);
afterAll(async () => {
  if (redis) await stopRedis(redis);
});
beforeEach(async () => {
  await redis.client.flushall();
});

describe("RedisRateLimiter", () => {
  it("recordFailure increments and sets TTL", async () => {
    const rl = new RedisRateLimiter(redis.client);
    const c1 = await rl.recordFailure("test:k", 900);
    const c2 = await rl.recordFailure("test:k", 900);
    expect(c1).toBe(1);
    expect(c2).toBe(2);
    const ttl = await rl.ttl("test:k");
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(900);
  });

  it("clear removes the counter", async () => {
    const rl = new RedisRateLimiter(redis.client);
    await rl.recordFailure("test:k", 900);
    await rl.clear("test:k");
    expect(await rl.getCount("test:k")).toBe(0);
  });

  it("cooldown blocks the second SET within the window", async () => {
    const rl = new RedisRateLimiter(redis.client);
    const first = await rl.cooldown("test:cd", 5);
    const second = await rl.cooldown("test:cd", 5);
    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(false);
    expect(second.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("incrementDaily blocks once limit is exceeded", async () => {
    const rl = new RedisRateLimiter(redis.client);
    for (let i = 1; i <= 10; i++) {
      const r = await rl.incrementDaily("test:daily", 10);
      expect(r.allowed).toBe(true);
    }
    const over = await rl.incrementDaily("test:daily", 10);
    expect(over.allowed).toBe(false);
  });
});
