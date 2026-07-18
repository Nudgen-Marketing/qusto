export type BaseNetworkName = "base" | "base-sepolia";
export type BaseNetworkId = "eip155:8453" | "eip155:84532";

export interface BaseNetworkConfig {
  readonly caip2: BaseNetworkId;
  readonly chainId: 8453 | 84532;
  readonly defaultRpcUrl: string;
  readonly name: BaseNetworkName;
  readonly usdcAddress: `0x${string}`;
}

const networks = {
  base: {
    caip2: "eip155:8453",
    chainId: 8453,
    defaultRpcUrl: "https://mainnet.base.org",
    name: "base",
    usdcAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
  },
  "base-sepolia": {
    caip2: "eip155:84532",
    chainId: 84532,
    defaultRpcUrl: "https://sepolia.base.org",
    name: "base-sepolia",
    usdcAddress: "0x036CbD53842c5426634e7929541eC2318f3dCF7e"
  }
} as const satisfies Readonly<Record<BaseNetworkName, BaseNetworkConfig>>;

export function resolveBaseNetwork(value = "base"): BaseNetworkConfig {
  if (value === "base" || value === "eip155:8453") return networks.base;
  if (value === "base-sepolia" || value === "eip155:84532") {
    return networks["base-sepolia"];
  }
  throw new Error("BASE_NETWORK must be base or base-sepolia");
}
