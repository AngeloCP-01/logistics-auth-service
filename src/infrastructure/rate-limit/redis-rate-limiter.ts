import type Redis from "ioredis";
import type {
  RateLimiter,
  RateLimitResult,
} from "../../application/ports/rate-limiter.js";
import { InfrastructureError } from "../shared/errors.js";

export class RedisRateLimiter implements RateLimiter {
  constructor(private readonly redis: Redis) {}

  async recordFailure(key: string, windowSeconds: number): Promise<number> {
    const pipe = this.redis.multi();
    pipe.incr(key);
    pipe.expire(key, windowSeconds);
    const results = await pipe.exec();
    if (!results)
      throw new InfrastructureError(
        "redis_pipeline_null",
        "Redis pipeline returned null",
      );
    return Number(results[0]?.[1] ?? 0);
  }

  async getCount(key: string): Promise<number> {
    const v = await this.redis.get(key);
    return v ? Number(v) : 0;
  }

  async ttl(key: string): Promise<number> {
    const t = await this.redis.ttl(key);
    return t < 0 ? 0 : t;
  }

  async clear(key: string): Promise<void> {
    await this.redis.del(key);
  }

  async cooldown(key: string, windowSeconds: number): Promise<RateLimitResult> {
    const acquired = await this.redis.set(key, "1", "EX", windowSeconds, "NX");
    if (acquired === "OK") return { allowed: true, retryAfterSeconds: 0 };
    const remaining = await this.redis.ttl(key);
    return { allowed: false, retryAfterSeconds: Math.max(1, remaining) };
  }

  async incrementDaily(key: string, limit: number): Promise<RateLimitResult> {
    const pipe = this.redis.multi();
    pipe.incr(key);
    pipe.ttl(key);
    const results = await pipe.exec();
    if (!results)
      throw new InfrastructureError(
        "redis_pipeline_null",
        "Redis pipeline returned null",
      );
    const count = Number(results[0]?.[1] ?? 0);
    let remaining = Number(results[1]?.[1] ?? 0);
    if (remaining < 0) {
      await this.redis.expire(key, 86400);
      remaining = 86400;
    }
    return {
      allowed: count <= limit,
      retryAfterSeconds: Math.max(1, remaining),
    };
  }
}
