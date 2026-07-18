import { encodePaymentSignatureHeader } from "@x402/core/http";
import type { PaymentPayload, PaymentRequirements } from "@x402/core/types";
import { ExactEvmScheme } from "@x402/evm";
import { ExactEvmSchemeV1 } from "@x402/evm/exact/v1/client";
import { privateKeyToAccount } from "viem/accounts";
import type { X402Signer } from "@qusto/sdk";

export function createLocalX402Signer(privateKey: string): X402Signer {
  if (!/^0x[a-fA-F0-9]{64}$/.test(privateKey)) {
    throw new Error("X402_PRIVATE_KEY must be a 32-byte 0x-prefixed hex value");
  }
  const account = privateKeyToAccount(privateKey as `0x${string}`);
  const v2 = new ExactEvmScheme(account);
  const v1 = new ExactEvmSchemeV1(account);

  return {
    address: account.address,
    async createPaymentPayload({ protocolVersion, requirement, resourceUrl }) {
      if (protocolVersion === 1) {
        const legacyRequirement = {
          asset: requirement.asset,
          description: "Qusto governed x402 payment",
          extra: {},
          maxAmountRequired: requirement.amountAtomic,
          maxTimeoutSeconds: requirement.maxTimeoutSeconds,
          mimeType: "application/json",
          network: requirement.network,
          outputSchema: {},
          payTo: requirement.payTo,
          resource: resourceUrl,
          scheme: requirement.scheme
        };
        const result = await v1.createPaymentPayload(
          1,
          legacyRequirement as unknown as PaymentRequirements
        );
        return encodePaymentSignatureHeader(
          result as unknown as PaymentPayload
        );
      }
      const accepted: PaymentRequirements = {
        amount: requirement.amountAtomic,
        asset: requirement.asset,
        extra: {},
        maxTimeoutSeconds: requirement.maxTimeoutSeconds,
        network: requirement.network,
        payTo: requirement.payTo,
        scheme: requirement.scheme
      };
      const result = await v2.createPaymentPayload(2, accepted);
      return encodePaymentSignatureHeader({
        ...result,
        accepted,
        resource: { url: resourceUrl }
      });
    }
  };
}
