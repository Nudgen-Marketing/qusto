import type {
  IntegrationPhase,
  ListDimension,
  PolicyRule
} from "@qusto/policy-engine";
import type { DashboardRole } from "./dashboard-repository";

export type DashboardPermission =
  "keys:write" | "policy:write" | "team:write" | "webhook:write";

const adminOnly: readonly DashboardPermission[] = [
  "keys:write",
  "team:write",
  "webhook:write"
];
const webhookEvents = new Set([
  "chain.reverted",
  "policy.denied",
  "settlement.failed",
  "spend.threshold_reached"
]);
const phases = new Set<IntegrationPhase>(["buyer", "seller"]);
const dimensions = new Set<ListDimension>([
  "asset",
  "network",
  "payer",
  "payee",
  "resourceUrl",
  "tool"
]);

export function assertDashboardPermission(
  role: DashboardRole,
  permission: DashboardPermission
): void {
  if (adminOnly.includes(permission) && role !== "admin") {
    throw new Error("Administrator access required");
  }
  if (permission === "policy:write" && role === "viewer") {
    throw new Error("Write access required");
  }
}

export function parseEventTypes(value: string): readonly string[] {
  const parsed = [
    ...new Set(value.split(",").map((item) => item.trim()))
  ].filter(Boolean);
  if (parsed.length === 0)
    throw new Error("At least one webhook event is required");
  for (const event of parsed) {
    if (!webhookEvents.has(event)) {
      throw new Error(`Unsupported webhook event: ${event}`);
    }
  }
  return parsed;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validId(value: unknown): value is string {
  return (
    typeof value === "string" && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(value)
  );
}

function validPhases(value: unknown): value is readonly IntegrationPhase[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((phase) => phases.has(phase as IntegrationPhase))
  );
}

function validAtomic(value: unknown): value is string {
  return (
    typeof value === "string" && /^[0-9]+$/.test(value) && BigInt(value) >= 0n
  );
}

function validValues(value: unknown): value is readonly string[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(
      (item): item is string => typeof item === "string" && item.length <= 2_048
    )
  );
}

function parseRule(value: unknown): PolicyRule {
  if (!isObject(value) || !validId(value.id) || !validPhases(value.phases)) {
    throw new Error("Invalid policy rules");
  }
  if (value.kind === "max-amount" && validAtomic(value.maxAmountAtomic)) {
    return {
      id: value.id,
      kind: value.kind,
      maxAmountAtomic: value.maxAmountAtomic,
      phases: [...value.phases]
    };
  }
  if (
    value.kind === "rolling-limit" &&
    validAtomic(value.maxAmountAtomic) &&
    [3_600, 86_400, 604_800, 2_592_000].includes(Number(value.windowSeconds))
  ) {
    return {
      id: value.id,
      kind: value.kind,
      maxAmountAtomic: value.maxAmountAtomic,
      phases: [...value.phases],
      windowSeconds: Number(value.windowSeconds) as
        3_600 | 86_400 | 604_800 | 2_592_000
    };
  }
  if (
    (value.kind === "allowlist" || value.kind === "denylist") &&
    dimensions.has(value.dimension as ListDimension) &&
    validValues(value.values)
  ) {
    return {
      dimension: value.dimension as ListDimension,
      id: value.id,
      kind: value.kind,
      phases: [...value.phases],
      values: [...value.values]
    };
  }
  throw new Error("Invalid policy rules");
}

export function validatePolicyRules(value: unknown): readonly PolicyRule[] {
  if (!Array.isArray(value)) throw new Error("Policy rules must be an array");
  if (value.length > 100)
    throw new Error("Policy rules cannot exceed 100 entries");
  return value.map(parseRule);
}

export function parsePolicyRules(value: string): readonly PolicyRule[] {
  try {
    return validatePolicyRules(JSON.parse(value) as unknown);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error("Policy rules must be valid JSON");
    }
    throw error;
  }
}
