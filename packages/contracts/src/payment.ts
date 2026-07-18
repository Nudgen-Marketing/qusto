import { z } from "zod";

const atomicAmountSchema = z.string().regex(/^(0|[1-9]\d*)$/);
const addressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/);
const baseNetworkSchema = z
  .enum(["base", "base-sepolia", "eip155:8453", "eip155:84532"])
  .transform((network): "eip155:8453" | "eip155:84532" => {
    if (network === "base" || network === "eip155:8453") {
      return "eip155:8453";
    }

    return "eip155:84532";
  });

const commonRequirementShape = {
  asset: addressSchema,
  maxTimeoutSeconds: z.number().int().positive().max(3_600),
  network: baseNetworkSchema,
  payTo: addressSchema,
  scheme: z.literal("exact")
} as const;

const v1RequirementSchema = z.object({
  ...commonRequirementShape,
  maxAmountRequired: atomicAmountSchema,
  resource: z.url()
});

const v2RequirementSchema = z.object({
  ...commonRequirementShape,
  amount: atomicAmountSchema
});

const v1PaymentRequiredSchema = z.object({
  accepts: z.array(v1RequirementSchema).min(1),
  x402Version: z.literal(1)
});

const v2PaymentRequiredSchema = z.object({
  accepts: z.array(v2RequirementSchema).min(1),
  resource: z.object({ url: z.url() }),
  x402Version: z.literal(2)
});

export interface CanonicalPaymentRequirement {
  readonly amountAtomic: string;
  readonly asset: string;
  readonly maxTimeoutSeconds: number;
  readonly network: "eip155:8453" | "eip155:84532";
  readonly payTo: string;
  readonly scheme: "exact";
}

export interface CanonicalPaymentRequired {
  readonly protocolVersion: 1 | 2;
  readonly requirements: readonly CanonicalPaymentRequirement[];
  readonly resourceUrl: string;
}

export function normalizePaymentRequired(input: unknown): CanonicalPaymentRequired {
  const version = z.object({ x402Version: z.union([z.literal(1), z.literal(2)]) }).parse(input)
    .x402Version;

  if (version === 1) {
    const parsed = v1PaymentRequiredSchema.parse(input);

    return {
      protocolVersion: 1,
      requirements: parsed.accepts.map(({ maxAmountRequired, resource: _resource, ...item }) => ({
        amountAtomic: maxAmountRequired,
        ...item
      })),
      resourceUrl: parsed.accepts[0]!.resource
    };
  }

  const parsed = v2PaymentRequiredSchema.parse(input);

  return {
    protocolVersion: 2,
    requirements: parsed.accepts.map(({ amount, ...item }) => ({
      amountAtomic: amount,
      ...item
    })),
    resourceUrl: parsed.resource.url
  };
}
