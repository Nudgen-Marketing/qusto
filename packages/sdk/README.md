# @qusto/sdk

Signer-agnostic x402 governance and lifecycle tracing for Qusto. Applications provide an x402-compatible EVM signer; the SDK never creates, transmits, logs, or stores private keys.

```ts
import { createQusto } from "@qusto/sdk";

const qusto = createQusto({
  apiKey: process.env.QUSTO_API_KEY!,
  baseUrl: process.env.QUSTO_BASE_URL!,
  environment: "production"
});

const governedFetch = qusto.createGovernedFetch({ signer });
const response = await governedFetch("https://paid.example.com/data");
await qusto.shutdown();
```
