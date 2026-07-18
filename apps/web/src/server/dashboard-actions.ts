"use server";

import { randomBytes } from "node:crypto";

import { revalidatePath } from "next/cache";
import {
  createDraft,
  encryptSecret,
  publishDraft,
  rollbackPolicy
} from "@qusto/control-plane";
import { PostgresPolicyAdminRepository } from "@qusto/database/policy-admin";

import {
  assertDashboardPermission,
  parseEventTypes,
  parsePolicyRules
} from "./dashboard-permissions";
import {
  getDashboardRepository,
  requireDashboardContext
} from "./dashboard-runtime";

interface ActionState {
  readonly error?: string;
  readonly secret?: string;
  readonly success?: string;
}

function field(formData: FormData, name: string, max = 2_048): string {
  const value = formData.get(name);
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${name} is required`);
  }
  if (value.length > max) throw new Error(`${name} is too long`);
  return value.trim();
}

function result(error: unknown): ActionState {
  return {
    error: error instanceof Error ? error.message : "Management action failed"
  };
}

export async function createApiKeyAction(
  _previous: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const { context, userId } = await requireDashboardContext();
    assertDashboardPermission(context.role, "keys:write");
    const created = await getDashboardRepository().createProjectApiKey(
      context.environmentId,
      field(formData, "name", 100),
      userId
    );
    revalidatePath("/settings");
    return { secret: created.token, success: "API key created. Copy it now." };
  } catch (error) {
    return result(error);
  }
}

export async function revokeApiKeyAction(formData: FormData): Promise<void> {
  const { context } = await requireDashboardContext();
  assertDashboardPermission(context.role, "keys:write");
  await getDashboardRepository().revokeApiKey(
    context.environmentId,
    field(formData, "keyId", 64)
  );
  revalidatePath("/settings");
}

export async function createInvitationAction(
  _previous: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const { context, userId } = await requireDashboardContext();
    assertDashboardPermission(context.role, "team:write");
    const email = field(formData, "email", 320).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("A valid email address is required");
    }
    const role = field(formData, "role", 20);
    if (!(["admin", "developer", "viewer"] as const).includes(role as never)) {
      throw new Error("Invalid invitation role");
    }
    const invitation = await getDashboardRepository().createInvitation(
      context.organizationId,
      email,
      role as "admin" | "developer" | "viewer",
      userId
    );
    revalidatePath("/team");
    return {
      secret: `${process.env.BETTER_AUTH_URL ?? "http://localhost:3000"}/onboarding?invitation=${encodeURIComponent(invitation.token)}`,
      success: "Invitation created. Share this one-time link securely."
    };
  } catch (error) {
    return result(error);
  }
}

export async function createWebhookAction(
  _previous: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const { context } = await requireDashboardContext();
    assertDashboardPermission(context.role, "webhook:write");
    const url = new URL(field(formData, "url"));
    const localDevelopment =
      process.env.NODE_ENV !== "production" &&
      url.protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(url.hostname);
    if (url.protocol !== "https:" && !localDevelopment) {
      throw new Error("Webhook URLs must use HTTPS");
    }
    const encryptionKey = process.env.QUSTO_ENCRYPTION_KEY;
    if (encryptionKey === undefined) {
      throw new Error("QUSTO_ENCRYPTION_KEY is required");
    }
    const secret = `qwhsec_${randomBytes(32).toString("base64url")}`;
    await getDashboardRepository().createWebhook(
      context.environmentId,
      url.toString(),
      encryptSecret(secret, encryptionKey),
      parseEventTypes(field(formData, "eventTypes"))
    );
    revalidatePath("/webhooks");
    return { secret, success: "Webhook created. Copy its signing secret now." };
  } catch (error) {
    return result(error);
  }
}

export async function retryWebhookAction(formData: FormData): Promise<void> {
  const { context } = await requireDashboardContext();
  assertDashboardPermission(context.role, "webhook:write");
  await getDashboardRepository().retryWebhookDelivery(
    context.environmentId,
    field(formData, "deliveryId", 64)
  );
  revalidatePath("/webhooks");
}

export async function createPolicyDraftAction(
  _previous: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const databaseUrl = process.env.DATABASE_URL;
    if (databaseUrl === undefined) throw new Error("DATABASE_URL is required");
    const { context, userId } = await requireDashboardContext();
    assertDashboardPermission(context.role, "policy:write");
    const repository = new PostgresPolicyAdminRepository(
      databaseUrl,
      context.environmentId
    );
    try {
      await createDraft(
        context.environmentId,
        parsePolicyRules(field(formData, "rules", 64_000)),
        userId,
        repository
      );
    } finally {
      await repository.close();
    }
    revalidatePath("/policies");
    return { success: "Draft policy version created." };
  } catch (error) {
    return result(error);
  }
}

export async function publishPolicyAction(formData: FormData): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl === undefined) throw new Error("DATABASE_URL is required");
  const { context, userId } = await requireDashboardContext();
  assertDashboardPermission(context.role, "policy:write");
  const repository = new PostgresPolicyAdminRepository(
    databaseUrl,
    context.environmentId
  );
  try {
    await publishDraft(field(formData, "policyId", 64), userId, repository);
  } finally {
    await repository.close();
  }
  revalidatePath("/policies");
}

export async function rollbackPolicyAction(formData: FormData): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl === undefined) throw new Error("DATABASE_URL is required");
  const { context, userId } = await requireDashboardContext();
  assertDashboardPermission(context.role, "policy:write");
  const repository = new PostgresPolicyAdminRepository(
    databaseUrl,
    context.environmentId
  );
  try {
    await rollbackPolicy(field(formData, "policyId", 64), userId, repository);
  } finally {
    await repository.close();
  }
  revalidatePath("/policies");
}
