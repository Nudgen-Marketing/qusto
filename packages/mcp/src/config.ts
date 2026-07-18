import { readFileSync } from "node:fs";

import { resolveBaseNetwork, type BaseNetworkConfig } from "@qusto/contracts";

export interface McpConfig {
  readonly allowPrivateAddresses: boolean;
  readonly apiKey: string;
  readonly baseNetwork: BaseNetworkConfig;
  readonly baseRpcUrl: string;
  readonly baseUrl: string;
  readonly environment: "development" | "production" | "staging";
  readonly privateKey: string;
}

function privateKey(environment: NodeJS.ProcessEnv): string {
  const inline = environment.X402_PRIVATE_KEY;
  const path = environment.X402_PRIVATE_KEY_FILE;
  if (inline !== undefined && path !== undefined) {
    throw new Error(
      "Set only one of X402_PRIVATE_KEY or X402_PRIVATE_KEY_FILE"
    );
  }
  if (inline !== undefined && inline.length > 0) return inline;
  if (path !== undefined && path.length > 0) {
    const value = readFileSync(path, "utf8").trim();
    if (value.length > 0) return value;
  }
  throw new Error("X402_PRIVATE_KEY or X402_PRIVATE_KEY_FILE is required");
}

function required(environment: NodeJS.ProcessEnv, name: string): string {
  const value = environment[name];
  if (value === undefined || value.length === 0)
    throw new Error(`${name} is required`);
  return value;
}

export function loadMcpConfig(environment = process.env): McpConfig {
  const environmentName = environment.QUSTO_ENVIRONMENT ?? "production";
  if (
    !(["development", "staging", "production"] as const).includes(
      environmentName as never
    )
  ) {
    throw new Error(
      "QUSTO_ENVIRONMENT must be development, staging, or production"
    );
  }
  const baseNetwork = resolveBaseNetwork(environment.BASE_NETWORK);
  return {
    allowPrivateAddresses:
      environmentName === "development" &&
      environment.QUSTO_MCP_ALLOW_PRIVATE === "true",
    apiKey: required(environment, "QUSTO_API_KEY"),
    baseNetwork,
    baseRpcUrl: environment.BASE_RPC_URL ?? baseNetwork.defaultRpcUrl,
    baseUrl: required(environment, "QUSTO_BASE_URL"),
    environment: environmentName as McpConfig["environment"],
    privateKey: privateKey(environment)
  };
}
