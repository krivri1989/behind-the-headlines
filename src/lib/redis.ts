import Redis from "ioredis";

const redisUrl = process.env.REDIS_URL;

let client: Redis | null = null;

function getClient(): Redis {
  if (!redisUrl) throw new Error("REDIS_URL must be set before using Redis.");
  if (!client) {
    client = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: false,
      connectTimeout: 5000,
      commandTimeout: 3000,
    });
    client.on("error", (error) => {
      console.error("[redis] connection error:", error.message);
    });
  }
  return client;
}

export function isRedisConfigured(): boolean {
  return Boolean(redisUrl);
}

export async function redisPing(): Promise<boolean> {
  try {
    const reply = await getClient().ping();
    return reply === "PONG";
  } catch {
    return false;
  }
}

// Cache helpers -----------------------------------------------------------

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const raw = await getClient().get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function cacheSet<T>(key: string, value: T, ttlSeconds = 300): Promise<void> {
  try {
    await getClient().set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch {
    // cache failures should not break the request
  }
}

export async function cacheDel(key: string): Promise<void> {
  try {
    await getClient().del(key);
  } catch {
    // ignore
  }
}

export async function cacheDelByPrefix(prefix: string): Promise<void> {
  try {
    const client = getClient();
    let cursor = "0";
    do {
      const [next, keys] = await client.scan(cursor, "MATCH", `${prefix}*`, "COUNT", 100);
      cursor = next;
      if (keys.length > 0) await client.del(...keys);
    } while (cursor !== "0");
  } catch {
    // ignore
  }
}

// Rate limiter ------------------------------------------------------------

/**
 * Simple fixed-window rate limiter.
 * Returns true if the request is allowed, false if rate-limited.
 */
export async function rateLimit(
  identifier: string,
  limit: number,
  windowSeconds: number,
): Promise<{ allowed: boolean; remaining: number }> {
  try {
    const key = `ratelimit:${identifier}`;
    const client = getClient();
    const count = await client.incr(key);
    if (count === 1) await client.expire(key, windowSeconds);
    return { allowed: count <= limit, remaining: Math.max(0, limit - count) };
  } catch {
    // if Redis is down, allow the request
    return { allowed: true, remaining: limit };
  }
}

// Cache keys --------------------------------------------------------------

export const cacheKeys = {
  siteSettings: "cache:site-settings",
  headerMenu: "cache:menu:header",
  footerMenu: "cache:menu:footer",
  categories: "cache:categories",
  categoryBySlug: (slug: string) => `cache:category:${slug}`,
  publishedArticles: (page: number) => `cache:articles:published:p${page}`,
  categoryArticles: (slug: string, page: number) => `cache:articles:category:${slug}:p${page}`,
  articleBySlug: (slug: string) => `cache:article:${slug}`,
};

// Cache invalidation helpers ---------------------------------------------

export async function invalidateContentCache(): Promise<void> {
  await Promise.all([
    cacheDelByPrefix("cache:articles:"),
    cacheDelByPrefix("cache:article:"),
    cacheDelByPrefix("cache:category:"),
    cacheDel(cacheKeys.categories),
    cacheDel(cacheKeys.siteSettings),
    cacheDel(cacheKeys.headerMenu),
    cacheDel(cacheKeys.footerMenu),
  ]);
}

export async function invalidateSettingsCache(): Promise<void> {
  await cacheDel(cacheKeys.siteSettings);
  await cacheDel("cache:public:settings");
}

export async function invalidateMenuCache(): Promise<void> {
  await cacheDel(cacheKeys.headerMenu);
  await cacheDel(cacheKeys.footerMenu);
  await cacheDel("cache:public:menu-header");
  await cacheDel("cache:public:menu-footer");
}

export async function invalidateCategoriesCache(): Promise<void> {
  await cacheDel(cacheKeys.categories);
  await cacheDelByPrefix("cache:category:");
}

export async function invalidateArticleCache(slug?: string): Promise<void> {
  await cacheDelByPrefix("cache:articles:");
  if (slug) await cacheDel(cacheKeys.articleBySlug(slug));
}

// RSS Job Queue ----------------------------------------------------------

export type RssJob = {
  sourceId: string;
  sourceName: string;
  feedUrl: string;
  attempt: number;
  enqueuedAt: number;
};

const QUEUE_KEY = "rss:queue";
const PROCESSING_KEY = "rss:processing";
const LOCK_PREFIX = "rss:lock:";

/**
 * Enqueue an RSS import job. Uses Redis LREM to avoid duplicate jobs
 * for the same source already in the queue.
 */
export async function enqueueRssJob(sourceId: string, sourceName: string, feedUrl: string): Promise<void> {
  const client = getClient();
  // Remove any existing job for this source to avoid duplicates
  const jobs = await client.lrange(QUEUE_KEY, 0, -1);
  for (const jobStr of jobs) {
    try {
      const job = JSON.parse(jobStr) as RssJob;
      if (job.sourceId === sourceId) {
        await client.lrem(QUEUE_KEY, 0, jobStr);
      }
    } catch { /* skip malformed */ }
  }
  const job: RssJob = { sourceId, sourceName, feedUrl, attempt: 1, enqueuedAt: Date.now() };
  await client.rpush(QUEUE_KEY, JSON.stringify(job));
}

/**
 * Dequeue the next RSS job. Moves it to the processing list.
 * Returns null if the queue is empty.
 */
export async function dequeueRssJob(): Promise<RssJob | null> {
  try {
    const client = getClient();
    // BRPOPLPUSH equivalent: move from queue to processing
    const jobStr = await client.lmove(QUEUE_KEY, PROCESSING_KEY, "LEFT", "RIGHT");
    if (!jobStr) return null;
    return JSON.parse(jobStr) as RssJob;
  } catch {
    return null;
  }
}

/**
 * Acknowledge that a job completed successfully. Remove it from processing.
 */
export async function ackRssJob(job: RssJob): Promise<void> {
  try {
    const client = getClient();
    const jobStr = JSON.stringify(job);
    await client.lrem(PROCESSING_KEY, 0, jobStr);
  } catch { /* ignore */ }
}

/**
 * Re-enqueue a failed job with exponential backoff.
 * If max attempts exceeded, remove from processing and record failure.
 */
export async function requeueFailedJob(job: RssJob, maxAttempts = 3): Promise<boolean> {
  try {
    const client = getClient();
    // Remove from processing
    const jobStr = JSON.stringify(job);
    await client.lrem(PROCESSING_KEY, 0, jobStr);

    if (job.attempt >= maxAttempts) {
      return false; // give up
    }

    // Re-enqueue with incremented attempt
    const requeued: RssJob = {
      ...job,
      attempt: job.attempt + 1,
      enqueuedAt: Date.now(),
    };

    // Delay: 30s * 2^(attempt-1) — 30s, 60s, 120s
    const delaySeconds = 30 * Math.pow(2, job.attempt - 1);
    const delayedJobStr = JSON.stringify(requeued);
    // Use a sorted set as a delay queue with score = execute-at timestamp
    await client.zadd("rss:delayed", Date.now() + delaySeconds * 1000, delayedJobStr);

    return true;
  } catch {
    return false;
  }
}

/**
 * Move expired delayed jobs back to the main queue.
 * Called periodically by the worker.
 */
export async function promoteDelayedJobs(): Promise<number> {
  try {
    const client = getClient();
    const now = Date.now();
    // Get all delayed jobs that are ready
    const ready = await client.zrangebyscore("rss:delayed", 0, now);
    if (ready.length === 0) return 0;

    for (const jobStr of ready) {
      await client.rpush(QUEUE_KEY, jobStr);
      await client.zrem("rss:delayed", jobStr);
    }
    return ready.length;
  } catch {
    return 0;
  }
}

/**
 * Get queue stats for monitoring.
 */
export async function getQueueStats(): Promise<{
  pending: number;
  processing: number;
  delayed: number;
}> {
  try {
    const client = getClient();
    const [pending, processing, delayed] = await Promise.all([
      client.llen(QUEUE_KEY),
      client.llen(PROCESSING_KEY),
      client.zcard("rss:delayed"),
    ]);
    return { pending, processing, delayed };
  } catch {
    return { pending: 0, processing: 0, delayed: 0 };
  }
}

/**
 * Acquire a distributed lock to prevent multiple workers from
 * processing the same source simultaneously.
 */
export async function acquireLock(sourceId: string, ttlSeconds = 300): Promise<boolean> {
  try {
    const client = getClient();
    const result = await client.set(LOCK_PREFIX + sourceId, "locked", "EX", ttlSeconds, "NX");
    return result === "OK";
  } catch {
    return true; // fail-open
  }
}

/**
 * Release a distributed lock.
 */
export async function releaseLock(sourceId: string): Promise<void> {
  try {
    await getClient().del(LOCK_PREFIX + sourceId);
  } catch { /* ignore */ }
}

/**
 * Recover stale jobs from the processing list back to the queue.
 * Called on worker startup to recover jobs from a crashed worker.
 */
export async function recoverStaleJobs(): Promise<number> {
  try {
    const client = getClient();
    const stale = await client.lrange(PROCESSING_KEY, 0, -1);
    for (const jobStr of stale) {
      await client.rpush(QUEUE_KEY, jobStr);
      await client.lrem(PROCESSING_KEY, 0, jobStr);
    }
    return stale.length;
  } catch {
    return 0;
  }
}

// Worker heartbeat -------------------------------------------------------

const HEARTBEAT_KEY = "rss:worker:heartbeat";

/**
 * Record a worker heartbeat with timestamp.
 */
export async function workerHeartbeat(stats: { processed: number; failed: number; sourceId?: string }): Promise<void> {
  try {
    const data = { timestamp: Date.now(), ...stats };
    await getClient().set(HEARTBEAT_KEY, JSON.stringify(data), "EX", 120);
  } catch { /* ignore */ }
}

/**
 * Get the last worker heartbeat.
 */
export async function getWorkerHeartbeat(): Promise<{ timestamp: number; processed: number; failed: number; sourceId?: string } | null> {
  try {
    const raw = await getClient().get(HEARTBEAT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as { timestamp: number; processed: number; failed: number; sourceId?: string };
  } catch {
    return null;
  }
}
