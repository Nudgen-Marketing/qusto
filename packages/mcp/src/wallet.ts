import { createPublicClient, formatUnits, http } from "viem";
import { base, baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import type { BaseNetworkConfig } from "@qusto/contracts";

const balanceAbi = [
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  }
] as const;

interface WalletBalanceClient {
  readContract(options: {
    readonly abi: typeof balanceAbi;
    readonly address: `0x${string}`;
    readonly args: readonly [`0x${string}`];
    readonly functionName: "balanceOf";
  }): Promise<unknown>;
}

export interface WalletInfoOptions {
  readonly client?: WalletBalanceClient;
  readonly network: BaseNetworkConfig;
  readonly privateKey: string;
  readonly rpcUrl: string;
}

export function createWalletInfo(options: WalletInfoOptions) {
  const { network, privateKey, rpcUrl } = options;
  if (!/^0x[a-fA-F0-9]{64}$/.test(privateKey)) {
    throw new Error("X402_PRIVATE_KEY must be a 32-byte 0x-prefixed hex value");
  }
  const account = privateKeyToAccount(privateKey as `0x${string}`);
  const chain = network.name === "base" ? base : baseSepolia;
  const client: WalletBalanceClient =
    options.client ?? createPublicClient({ chain, transport: http(rpcUrl) });
  return async () => {
    const balance = await client.readContract({
      abi: balanceAbi,
      address: network.usdcAddress,
      args: [account.address],
      functionName: "balanceOf"
    });
    if (typeof balance !== "bigint") {
      throw new Error("Base USDC balance response is invalid");
    }
    return {
      address: account.address,
      balanceAtomic: balance.toString(),
      balanceUsdc: formatUnits(balance, 6),
      network: network.caip2
    };
  };
}
