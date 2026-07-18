import { resolveBaseNetwork, type BaseNetworkConfig } from "@qusto/contracts";

export interface SellerConfig {
  readonly facilitatorUrl: string;
  readonly network: BaseNetworkConfig;
  readonly payTo: `0x${string}`;
  readonly port: number;
  readonly price: "$0.001";
}

export function loadSellerConfig(
  environment: NodeJS.ProcessEnv = process.env
): SellerConfig {
  const payTo = environment.SEPOLIA_E2E_PAY_TO;
  if (payTo === undefined || !/^0x[a-fA-F0-9]{40}$/.test(payTo)) {
    throw new Error("SEPOLIA_E2E_PAY_TO must be a 20-byte EVM address");
  }
  const facilitatorUrl =
    environment.SEPOLIA_E2E_FACILITATOR_URL ?? "https://x402.org/facilitator";
  const facilitator = new URL(facilitatorUrl);
  if (facilitator.protocol !== "https:") {
    throw new Error("SEPOLIA_E2E_FACILITATOR_URL must use HTTPS");
  }
  const portValue = environment.SEPOLIA_E2E_SELLER_PORT ?? "4021";
  const port = Number(portValue);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("SEPOLIA_E2E_SELLER_PORT must be a valid TCP port");
  }
  return {
    facilitatorUrl: facilitator.toString().replace(/\/$/, ""),
    network: resolveBaseNetwork("base-sepolia"),
    payTo: payTo as `0x${string}`,
    port,
    price: "$0.001"
  };
}
