import type { Job } from "./job-repository.js";

export interface WorkerJobRepository {
  claim(workerId: string, limit: number): Promise<readonly Job[]>;
  complete(job: Job): Promise<void>;
  fail(job: Job, error: unknown): Promise<void>;
  heartbeat(workerId: string): Promise<void>;
}

export type JobHandler = (job: Job) => Promise<void>;

export interface WorkerBatchResult {
  readonly claimed: number;
  readonly completed: number;
  readonly failed: number;
}

export async function runWorkerBatch(
  workerId: string,
  repository: WorkerJobRepository,
  handlers: Readonly<Record<string, JobHandler>>,
  limit = 10
): Promise<WorkerBatchResult> {
  await repository.heartbeat(workerId);
  const jobs = await repository.claim(workerId, limit);
  let completed = 0;
  let failed = 0;
  for (const job of jobs) {
    try {
      const handler = handlers[job.type];
      if (handler === undefined)
        throw new Error(`Unknown job type: ${job.type}`);
      await handler(job);
      await repository.complete(job);
      completed += 1;
    } catch (error) {
      await repository.fail(job, error);
      failed += 1;
    }
  }
  return { claimed: jobs.length, completed, failed };
}
