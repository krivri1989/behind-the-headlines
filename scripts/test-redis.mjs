import Redis from "ioredis";

const url = process.env.REDIS_URL;
if (!url) { console.error("REDIS_URL is not set"); process.exit(1); }

console.log("Connecting to Redis at", url.replace(/:[^@]+@/, ":***@"));
const redis = new Redis(url, { connectTimeout: 5000, maxRetriesPerRequest: 3 });

try {
  console.log("Pinging...");
  const reply = await redis.ping();
  console.log("✓ Redis PING:", reply);

  console.log("Setting test key...");
  await redis.set("bth:test", "Redis connection test", "EX", 60);
  const value = await redis.get("bth:test");
  console.log("✓ Test key value:", value);

  console.log("Testing INCR (rate limiter)...");
  const count = await redis.incr("bth:test:counter");
  await redis.expire("bth:test:counter", 60);
  console.log("✓ Counter incremented to:", count);

  await redis.del("bth:test", "bth:test:counter");
  console.log("✓ Cleanup done");

  redis.disconnect();
  console.log("✓ Redis connection test complete");
  process.exit(0);
} catch (error) {
  console.error("✗ Redis error:", error.message);
  process.exit(1);
}
