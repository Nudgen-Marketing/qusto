import { hostname } from "node:os";

import { PostgresJobRepository } from "./job-repository.js";
import { PostgresMaintenance } from "./maintenance.js";
import { PostgresWorkerOperations } from "./operations.js";
import { createJsonRpcCall } from "./rpc.js";
import { runWorkerBatch } from "./worker-loop.js";

function required(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.length === 0) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function log(level: "error" | "info", message: string, data = {}): void {
  const output = JSON.stringify({
    level,
    message,
    timestamp: new Date().toISOString(),
    ...data
  });
  if (level === "error") console.error(output);
  else console.info(output);
}

async function main(): Promise<void> {
  const databaseUrl = required("DATABASE_URL");
  const workerId =
    process.env.QUSTO_WORKER_ID ?? `${hostname()}:${String(process.pid)}`;
  const repository = new PostgresJobRepository(databaseUrl);
  const maintenance = new PostgresMaintenance(databaseUrl);
  const operations = new PostgresWorkerOperations(databaseUrl);
  const handlers = operations.handlers({
    encryptionKey: required("QUSTO_ENCRYPTION_KEY"),
    maintenance,
    rpc: createJsonRpcCall(required("BASE_RPC_URL"))
  });
  const shutdown = new AbortController();
  const stop = () => shutdown.abort();
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  log("info", "worker.started", { workerId });

  while (!shutdown.signal.aborted) {
    try {
      await operations.ensureScheduledJobs();
      const result = await runWorkerBatch(workerId, repository, handlers, 20);
      if (result.claimed === 0) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    } catch (error) {
      log("error", "worker.batch_failed", {
        error: error instanceof Error ? error.message : "unknown"
      });
      await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
  }

  await Promise.all([
    repository.close(),
    maintenance.close(),
    operations.close()
  ]);
  log("info", "worker.stopped", { workerId });
}

void main().catch((error: unknown) => {
  log("error", "worker.fatal", {
    error: error instanceof Error ? error.message : "unknown"
  });
  process.exitCode = 1;
});
