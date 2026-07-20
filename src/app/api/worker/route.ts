import { NextResponse } from "next/server";
import { getWorkerHeartbeat, getQueueStats } from "@/lib/redis";
import { requireAdmin, errorStatus } from "@/lib/auth";

export async function GET() {
  try {
    await requireAdmin();
    const [heartbeat, queueStats] = await Promise.all([
      getWorkerHeartbeat(),
      getQueueStats(),
    ]);

    const isRunning = heartbeat && Date.now() - heartbeat.timestamp < 120_000;

    return NextResponse.json({
      status: isRunning ? "running" : "stopped",
      lastHeartbeat: heartbeat?.timestamp || null,
      lastHeartbeatAgo: heartbeat ? `${Math.round((Date.now() - heartbeat.timestamp) / 1000)}s ago` : null,
      processed: heartbeat?.processed || 0,
      failed: heartbeat?.failed || 0,
      currentSource: heartbeat?.sourceId || null,
      queue: queueStats,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch worker status" },
      { status: errorStatus(error) },
    );
  }
}
