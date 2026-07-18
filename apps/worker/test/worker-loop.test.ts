import { describe, expect, it, vi } from "vitest";

import { runWorkerBatch } from "../src/worker-loop.js";
import type { Job } from "../src/job-repository.js";

const job: Job = {
  attempts: 1,
  id: "job-1",
  maxAttempts: 10,
  payload: {},
  type: "test"
};

describe("worker batch", () => {
  it("completes handled jobs and reschedules failures", async () => {
    const repository = {
      claim: vi
        .fn()
        .mockResolvedValue([job, { ...job, id: "job-2", type: "fail" }]),
      complete: vi.fn(),
      fail: vi.fn(),
      heartbeat: vi.fn()
    };
    const handlers = {
      fail: vi.fn().mockRejectedValue(new Error("temporary")),
      test: vi.fn().mockResolvedValue(undefined)
    };

    const result = await runWorkerBatch("worker-1", repository, handlers, 10);

    expect(result).toEqual({ claimed: 2, completed: 1, failed: 1 });
    expect(repository.complete).toHaveBeenCalledOnce();
    expect(repository.fail).toHaveBeenCalledOnce();
    expect(repository.heartbeat).toHaveBeenCalledWith("worker-1");
  });

  it("fails unknown job types without dropping the job", async () => {
    const repository = {
      claim: vi.fn().mockResolvedValue([{ ...job, type: "unknown" }]),
      complete: vi.fn(),
      fail: vi.fn(),
      heartbeat: vi.fn()
    };

    await runWorkerBatch("worker-1", repository, {}, 10);
    expect(repository.fail).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ message: "Unknown job type: unknown" })
    );
  });
});
