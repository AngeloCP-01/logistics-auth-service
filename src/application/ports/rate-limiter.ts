export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

export interface RateLimiter {
  /**
   * Sliding-window failure counter. Increment and return the new count.
   * Sets EXPIRE on every increment (window resets on each failure).
   */
  recordFailure(key: string, windowSeconds: number): Promise<number>;
  /** Read current count (no side effect). */
  getCount(key: string): Promise<number>;
  /** Read remaining TTL in seconds for the given key, or 0 if no key. */
  ttl(key: string): Promise<number>;
  /** Delete a counter (admin unlock / login success). */
  clear(key: string): Promise<void>;

  /**
   * Cooldown lock: SET key=1 EX windowSeconds NX.
   * Returns { allowed: true, retryAfterSeconds: 0 } if the lock was acquired;
   * { allowed: false, retryAfterSeconds: <ttl> } otherwise.
   */
  cooldown(key: string, windowSeconds: number): Promise<RateLimitResult>;

  /**
   * Increment + check daily cap. INCR then EXPIRE (only if first increment).
   * Returns { allowed: count <= limit, retryAfterSeconds: ttl }.
   */
  incrementDaily(key: string, limit: number): Promise<RateLimitResult>;
}
