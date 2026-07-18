import { randomUUID } from "node:crypto";

import type { PolicyRule } from "@qusto/policy-engine";

export interface PolicyVersion {
  readonly createdBy: string;
  readonly environmentId: string;
  readonly id: string;
  readonly publishedAt?: string;
  readonly publishedBy?: string;
  readonly rules: readonly PolicyRule[];
  readonly status: "draft" | "published" | "archived";
  readonly version: number;
}

export interface PolicyAdminRepository {
  appendAudit(
    action: string,
    details?: Readonly<Record<string, unknown>>
  ): Promise<void>;
  createVersion(version: PolicyVersion): Promise<PolicyVersion>;
  findVersion(id: string): Promise<PolicyVersion | undefined>;
  getNextVersion(environmentId: string): Promise<number>;
  setActiveVersion(id: string): Promise<void>;
  transaction<T>(operation: () => Promise<T>): Promise<T>;
}

interface PolicyAdminOptions {
  readonly now?: () => Date;
  readonly randomId?: () => string;
}

function cloneRules(rules: readonly PolicyRule[]): readonly PolicyRule[] {
  return structuredClone(rules);
}

export async function createDraft(
  environmentId: string,
  rules: readonly PolicyRule[],
  actorUserId: string,
  repository: PolicyAdminRepository,
  options: PolicyAdminOptions = {}
): Promise<PolicyVersion> {
  const draft: PolicyVersion = {
    createdBy: actorUserId,
    environmentId,
    id: (options.randomId ?? randomUUID)(),
    rules: cloneRules(rules),
    status: "draft",
    version: await repository.getNextVersion(environmentId)
  };
  const created = await repository.createVersion(draft);
  await repository.appendAudit("policy.draft.created", {
    actorUserId,
    environmentId,
    policyVersionId: created.id
  });
  return created;
}

export async function publishDraft(
  draftId: string,
  actorUserId: string,
  repository: PolicyAdminRepository,
  options: PolicyAdminOptions = {}
): Promise<PolicyVersion> {
  return repository.transaction(async () => {
    const draft = await repository.findVersion(draftId);
    if (draft?.status !== "draft") {
      throw new Error("Policy draft not found");
    }
    const published: PolicyVersion = {
      ...draft,
      publishedAt: (options.now ?? (() => new Date()))().toISOString(),
      publishedBy: actorUserId,
      rules: cloneRules(draft.rules),
      status: "published"
    };
    await repository.createVersion(published);
    await repository.setActiveVersion(published.id);
    await repository.appendAudit("policy.published", {
      actorUserId,
      policyVersionId: published.id
    });
    return published;
  });
}

export async function rollbackPolicy(
  sourceVersionId: string,
  actorUserId: string,
  repository: PolicyAdminRepository,
  options: PolicyAdminOptions = {}
): Promise<PolicyVersion> {
  return repository.transaction(async () => {
    const source = await repository.findVersion(sourceVersionId);
    if (source?.status !== "published") {
      throw new Error("Published policy version not found");
    }
    const rolledBack: PolicyVersion = {
      createdBy: actorUserId,
      environmentId: source.environmentId,
      id: (options.randomId ?? randomUUID)(),
      publishedAt: (options.now ?? (() => new Date()))().toISOString(),
      publishedBy: actorUserId,
      rules: cloneRules(source.rules),
      status: "published",
      version: await repository.getNextVersion(source.environmentId)
    };
    await repository.createVersion(rolledBack);
    await repository.setActiveVersion(rolledBack.id);
    await repository.appendAudit("policy.rolled_back", {
      actorUserId,
      policyVersionId: rolledBack.id,
      sourceVersionId
    });
    return rolledBack;
  });
}
