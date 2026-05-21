import type {
  RateLimiter,
  RateLimitResult,
} from "@/application/ports/rate-limiter.js";

interface Entry {
  count: number;
  expiresAt: number; // epoch ms; 0 = no TTL
}

export class InMemoryRateLimiter implements RateLimiter {
  private store = new Map<string, Entry>();
  private clockMs = Date.now();

  /** Test hook: advance the limiter's internal clock by N ms. */
  advance(ms: number): void {
    this.clockMs += ms;
  }

  /** Test hook: set the limiter's internal clock. */
  setNow(date: Date): void {
    this.clockMs = date.getTime();
  }

  private getLive(key: string): Entry | null {
    const e = this.store.get(key);
    if (!e) return null;
    if (e.expiresAt !== 0 && e.expiresAt <= this.clockMs) {
      this.store.delete(key);
      return null;
    }
    return e;
  }

  async recordFailure(key: string, windowSeconds: number): Promise<number> {
    const e = this.getLive(key);
    const next = (e?.count ?? 0) + 1;
    this.store.set(key, {
      count: next,
      expiresAt: this.clockMs + windowSeconds * 1000,
    });
    return next;
  }
  async getCount(key: string): Promise<number> {
    return this.getLive(key)?.count ?? 0;
  }
  async ttl(key: string): Promise<number> {
    const e = this.getLive(key);
    if (!e) return 0;
    return Math.max(0, Math.ceil((e.expiresAt - this.clockMs) / 1000));
  }
  async clear(key: string): Promise<void> {
    this.store.delete(key);
  }

  async cooldown(key: string, windowSeconds: number): Promise<RateLimitResult> {
    const e = this.getLive(key);
    if (e)
      return {
        allowed: false,
        retryAfterSeconds: Math.max(
          1,
          Math.ceil((e.expiresAt - this.clockMs) / 1000),
        ),
      };
    this.store.set(key, {
      count: 1,
      expiresAt: this.clockMs + windowSeconds * 1000,
    });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  async incrementDaily(key: string, limit: number): Promise<RateLimitResult> {
    const e = this.getLive(key);
    const isFirst = !e;
    const nextCount = (e?.count ?? 0) + 1;
    const expiresAt = isFirst
      ? this.clockMs + 86400 * 1000
      : (e?.expiresAt ?? 0);
    this.store.set(key, { count: nextCount, expiresAt });
    return {
      allowed: nextCount <= limit,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((expiresAt - this.clockMs) / 1000),
      ),
    };
  }
}
