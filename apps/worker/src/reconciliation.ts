export type ChainEventType =
  "chain.confirmed" | "chain.finalized" | "chain.reverted";

export type RpcCall = (
  method: string,
  params: readonly unknown[]
) => Promise<unknown>;

interface Receipt {
  readonly blockNumber: string;
  readonly status: string;
}

interface Block {
  readonly number: string;
}

function isReceipt(value: unknown): value is Receipt {
  return (
    typeof value === "object" &&
    value !== null &&
    "blockNumber" in value &&
    typeof value.blockNumber === "string" &&
    "status" in value &&
    typeof value.status === "string"
  );
}

function isBlock(value: unknown): value is Block {
  return (
    typeof value === "object" &&
    value !== null &&
    "number" in value &&
    typeof value.number === "string"
  );
}

export async function reconcileTransaction(
  transactionHash: string,
  rpc: RpcCall
): Promise<readonly ChainEventType[]> {
  const receipt = await rpc("eth_getTransactionReceipt", [transactionHash]);
  if (!isReceipt(receipt)) return [];
  if (receipt.status !== "0x1") return ["chain.reverted"];

  const events: ChainEventType[] = ["chain.confirmed"];
  const finalized = await rpc("eth_getBlockByNumber", ["finalized", false]);
  if (
    isBlock(finalized) &&
    BigInt(finalized.number) >= BigInt(receipt.blockNumber)
  ) {
    events.push("chain.finalized");
  }
  return events;
}
