export interface McpConfig {
  readonly allowPrivateAddresses: boolean;
  readonly apiKey: string;
  readonly baseRpcUrl: string;
  readonly baseUrl: string;
  readonly environment: "development" | "production" | "staging";
  readonly privateKey: string;
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
  return {
    allowPrivateAddresses:
      environmentName === "development" &&
      environment.QUSTO_MCP_ALLOW_PRIVATE === "true",
    apiKey: required(environment, "QUSTO_API_KEY"),
    baseRpcUrl: environment.BASE_RPC_URL ?? "https://mainnet.base.org",
    baseUrl: required(environment, "QUSTO_BASE_URL"),
    environment: environmentName as McpConfig["environment"],
    privateKey: required(environment, "X402_PRIVATE_KEY")
  };
}
