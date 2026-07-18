import { describe, expect, it } from "vitest";

import {
  createDraft,
  publishDraft,
  rollbackPolicy,
  type PolicyAdminRepository,
  type PolicyVersion
} from "../src/policy-admin.js";

class MemoryPolicyRepository implements PolicyAdminRepository {
  readonly audits: string[] = [];
  readonly versions: PolicyVersion[] = [];
  activeVersionId?: string;

  async appendAudit(action: string): Promise<void> {
    this.audits.push(action);
  }

  async createVersion(version: PolicyVersion): Promise<PolicyVersion> {
    this.versions.push(version);
    return version;
  }

  async findVersion(id: string): Promise<PolicyVersion | undefined> {
    return this.versions.find((version) => version.id === id);
  }

  async getNextVersion(): Promise<number> {
    return this.versions.length + 1;
  }

  async setActiveVersion(id: string): Promise<void> {
    this.activeVersionId = id;
  }

  async transaction<T>(operation: () => Promise<T>): Promise<T> {
    return operation();
  }
}

const rule = {
  id: "max-payment",
  kind: "max-amount" as const,
  maxAmountAtomic: "1000000",
  phases: ["buyer" as const, "seller" as const]
};

describe("policy administration", () => {
  it("creates a mutable draft, then publishes an immutable active version", async () => {
    const repository = new MemoryPolicyRepository();
    const draft = await createDraft("env-1", [rule], "user-1", repository, {
      randomId: () => "draft-1"
    });

    const published = await publishDraft(draft.id, "user-1", repository, {
      now: () => new Date("2026-07-18T00:00:00.000Z")
    });

    expect(draft.status).toBe("draft");
    expect(published.status).toBe("published");
    expect(published.publishedAt).toBe("2026-07-18T00:00:00.000Z");
    expect(repository.activeVersionId).toBe(draft.id);
    expect(repository.audits).toEqual([
      "policy.draft.created",
      "policy.published"
    ]);
  });

  it("rolls back by cloning a prior version into a new published version", async () => {
    const repository = new MemoryPolicyRepository();
    repository.versions.push({
      createdBy: "user-1",
      environmentId: "env-1",
      id: "old",
      rules: [rule],
      status: "published",
      version: 1
    });

    const rolledBack = await rollbackPolicy("old", "user-2", repository, {
      randomId: () => "rollback",
      now: () => new Date(0)
    });

    expect(rolledBack).toMatchObject({
      id: "rollback",
      status: "published",
      version: 2
    });
    expect(rolledBack.rules).not.toBe(repository.versions[0]?.rules);
    expect(repository.activeVersionId).toBe("rollback");
    expect(repository.audits).toContain("policy.rolled_back");
  });
});
