import { Redis } from 'ioredis';

class RedisManager {
  private client: Redis | null = null;
  private isConnected: boolean = false;
  private hasLoggedWarning: boolean = false;

  constructor() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

    try {
      this.client = new Redis(redisUrl, {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        connectTimeout: 2000,
        enableOfflineQueue: false,
        retryStrategy: (times) => {
          // If Redis is not available, back off quietly without spamming errors
          if (times > 3) return null;
          return Math.min(times * 1000, 3000);
        }
      });

      this.client.on('connect', () => {
        this.isConnected = true;
        console.log('⚡ Redis connected (caching & distributed locks enabled)');
      });

      this.client.on('ready', () => {
        this.isConnected = true;
      });

      this.client.on('error', (_err) => {
        this.isConnected = false;
        if (!this.hasLoggedWarning) {
          console.warn('⚠️  Redis unavailable or connection failed. Gracefully falling back to database/in-memory mode.');
          this.hasLoggedWarning = true;
        }
      });

      this.client.on('close', () => {
        this.isConnected = false;
      });

      // Try non-blocking background connection
      this.client.connect().catch((_err) => {
        if (!this.hasLoggedWarning) {
          console.warn('⚠️  Redis unavailable or connection failed. Gracefully falling back to database/in-memory mode.');
          this.hasLoggedWarning = true;
        }
      });
    } catch {
      this.client = null;
      this.isConnected = false;
    }
  }

  get isAvailable(): boolean {
    return this.isConnected && this.client !== null;
  }

  // Safe Get
  async get(key: string): Promise<string | null> {
    if (!this.isAvailable) return null;
    try {
      return await this.client!.get(key);
    } catch {
      return null;
    }
  }

  // Safe Set with TTL
  async set(key: string, value: string, ttlSeconds: number = 300): Promise<void> {
    if (!this.isAvailable) return;
    try {
      await this.client!.set(key, value, 'EX', ttlSeconds);
    } catch {
      // Gracefully continue
    }
  }

  // Safe Del
  async del(key: string): Promise<void> {
    if (!this.isAvailable) return;
    try {
      await this.client!.del(key);
    } catch {
      // Gracefully continue
    }
  }

  /**
   * Distributed Lock Acquisition (SET resource token NX PX ttl)
   * Prevents concurrent race conditions (e.g., duplicate approvals, outbox poller runs)
   */
  async acquireLock(lockKey: string, ttlMs: number = 5000): Promise<string | null> {
    if (!this.isAvailable) {
      // If Redis is not available, return a mock lock token so application proceeds normally
      return 'local-lock-token';
    }

    try {
      const lockValue = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const result = await this.client!.set(lockKey, lockValue, 'PX', ttlMs, 'NX');
      return result === 'OK' ? lockValue : null;
    } catch {
      return 'fallback-lock-token';
    }
  }

  /**
   * Distributed Lock Release using atomic Lua script (releases only if token matches)
   */
  async releaseLock(lockKey: string, lockValue: string): Promise<void> {
    if (!this.isAvailable || lockValue.startsWith('local-lock-') || lockValue.startsWith('fallback-lock-')) {
      return;
    }

    const luaScript = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;

    try {
      await this.client!.eval(luaScript, 1, lockKey, lockValue);
    } catch {
      // Gracefully continue
    }
  }
}

export const redis = new RedisManager();
