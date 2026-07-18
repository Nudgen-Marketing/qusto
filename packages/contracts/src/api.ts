import { z } from "zod";

const addressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/);
const atomicAmountSchema = z.string().regex(/^(0|[1-9]\d*)$/);
const identifierSchema = z
  .string()
  .min(16)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/);
const httpUrlSchema = z.url().refine((value) => {
  const protocol = new URL(value).protocol;
  return protocol === "http:" || protocol === "https:";
}, "Only HTTP(S) resource URLs are supported");

export const policyEvaluationRequestSchema = z.object({
  amountAtomic: atomicAmountSchema,
  asset: addressSchema,
  idempotencyKey: identifierSchema,
  network: z.enum(["eip155:8453", "eip155:84532"]),
  payee: addressSchema,
  payer: addressSchema,
  phase: z.enum(["buyer", "seller"]),
  protocolVersion: z.union([z.literal(1), z.literal(2)]),
  resourceUrl: httpUrlSchema,
  scheme: z.literal("exact"),
  tool: z.string().min(1).max(200).optional(),
  traceId: identifierSchema
});

export type PolicyEvaluationRequest = z.infer<
  typeof policyEvaluationRequestSchema
>;

export const traceEventTypeSchema = z.enum([
  "chain.confirmed",
  "chain.finalized",
  "chain.reverted",
  "payment.created",
  "payment.required",
  "policy.allowed",
  "policy.denied",
  "policy.unavailable",
  "settlement.failed",
  "settlement.submitted",
  "settlement.succeeded",
  "verification.failed",
  "verification.succeeded"
]);

export const traceEventSchema = z.object({
  eventId: identifierSchema,
  occurredAt: z.iso.datetime({ offset: true }),
  payload: z.record(z.string(), z.unknown()),
  traceId: identifierSchema,
  type: traceEventTypeSchema
});

export type PublicTraceEvent = z.infer<typeof traceEventSchema>;

export const eventBatchSchema = z.object({
  events: z.array(traceEventSchema).min(1).max(100)
});

export type EventBatch = z.infer<typeof eventBatchSchema>;
