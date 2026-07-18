export class PolicyDeniedError extends Error {
  readonly decisionId: string;
  readonly reasonCodes: readonly string[];

  constructor(decisionId: string, reasonCodes: readonly string[]) {
    super(
      `Qusto denied the x402 payment: ${reasonCodes.join(", ") || "policy denied"}`
    );
    this.name = "PolicyDeniedError";
    this.decisionId = decisionId;
    this.reasonCodes = [...reasonCodes];
  }
}
