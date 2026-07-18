import { encodePaymentSignatureHeader } from "@x402/core/http";
import type { PaymentPayload, PaymentRequirements } from "@x402/core/types";
import { ExactEvmScheme } from "@x402/evm";
import { ExactEvmSchemeV1 } from "@x402/evm/exact/v1/client";
import { privateKeyToAccount } from "viem/accounts";
import type { BaseNetworkConfig } from "@qusto/contracts";
import type { X402Signer } from "@qusto/sdk";

export interface LocalX402SignerOptions {
  readonly balanceAtomic?: () => Promise<bigint>;
  readonly network: BaseNetworkConfig;
}

function assertEip712Metadata(extra: Readonly<Record<string, unknown>>): void {
  if (
    typeof extra.name !== "string" ||
    extra.name.length === 0 ||
    typeof extra.version !== "string" ||
    extra.version.length === 0
  ) {
    throw new Error(
      "Payment requirement extra.name and extra.version are required for EIP-712 signing"
    );
  }
}

export function createLocalX402Signer(
  privateKey: string,
  options: LocalX402SignerOptions
): X402Signer {
  if (!/^0x[a-fA-F0-9]{64}$/.test(privateKey)) {
    throw new Error("X402_PRIVATE_KEY must be a 32-byte 0x-prefixed hex value");
  }
  const account = privateKeyToAccount(privateKey as `0x${string}`);
  const v2 = new ExactEvmScheme(account);
  const v1 = new ExactEvmSchemeV1(account);

  return {
    address: account.address,
    async createPaymentPayload({ protocolVersion, requirement, resourceUrl }) {
      if (requirement.network !== options.network.caip2) {
        throw new Error(
          `Payment requirement network ${requirement.network} does not match configured network ${options.network.caip2}`
        );
      }
      if (
        requirement.asset.toLowerCase() !==
        options.network.usdcAddress.toLowerCase()
      ) {
        throw new Error(
          `Payment requirement asset ${requirement.asset} does not match configured Base USDC ${options.network.usdcAddress}`
        );
      }
      assertEip712Metadata(requirement.extra);
      if (
        options.balanceAtomic !== undefined &&
        (await options.balanceAtomic()) < BigInt(requirement.amountAtomic)
      ) {
        throw new Error("Insufficient Base USDC balance for x402 payment");
      }
      if (protocolVersion === 1) {
        const legacyRequirement = {
          asset: requirement.asset,
          description: "Qusto governed x402 payment",
          extra: structuredClone(requirement.extra),
          maxAmountRequired: requirement.amountAtomic,
          maxTimeoutSeconds: requirement.maxTimeoutSeconds,
          mimeType: "application/json",
          network: options.network.name,
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
        extra: structuredClone(requirement.extra),
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
