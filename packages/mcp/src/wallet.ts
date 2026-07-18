import { createPublicClient, formatUnits, http } from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

const baseUsdc = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const balanceAbi = [
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  }
] as const;

export function createWalletInfo(privateKey: string, rpcUrl: string) {
  if (!/^0x[a-fA-F0-9]{64}$/.test(privateKey)) {
    throw new Error("X402_PRIVATE_KEY must be a 32-byte 0x-prefixed hex value");
  }
  const account = privateKeyToAccount(privateKey as `0x${string}`);
  const client = createPublicClient({ chain: base, transport: http(rpcUrl) });
  return async () => {
    const balance = await client.readContract({
      abi: balanceAbi,
      address: baseUsdc,
      args: [account.address],
      functionName: "balanceOf"
    });
    return {
      address: account.address,
      balanceAtomic: balance.toString(),
      balanceUsdc: formatUnits(balance, 6),
      network: "eip155:8453"
    };
  };
}
