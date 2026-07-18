import { ArrowRight, KeyRound, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { CodeSnippet } from "./code-snippet";

const sdkInstall = "pnpm add @qusto/sdk";

const sdkExample = `import { createQusto } from "@qusto/sdk";

const qusto = createQusto({
  apiKey: process.env.QUSTO_API_KEY!,
  baseUrl: process.env.QUSTO_BASE_URL!,
  environment: "production"
});

const governedFetch = qusto.createGovernedFetch({ signer });
const response = await governedFetch("https://paid.example.com/data");
await qusto.shutdown();`;

const mcpExample = `{
  "mcpServers": {
    "qusto": {
      "command": "npx",
      "args": ["-y", "@qusto/mcp"],
      "env": {
        "QUSTO_BASE_URL": "https://qusto.example.com",
        "QUSTO_API_KEY": "<your-environment-api-key>",
        "X402_PRIVATE_KEY": "<your-local-wallet-private-key>",
        "BASE_NETWORK": "base",
        "BASE_RPC_URL": "https://mainnet.base.org"
      }
    }
  }
}`;

export function GettingStartedGuide() {
  return (
    <div className="getting-started">
      <header className="guide-intro">
        <h2>Send your first governed request</h2>
        <p>
          Connect an application or agent, apply a policy, and inspect the full
          payment lifecycle in Qusto.
        </p>
      </header>

      <ol className="guide-steps">
        <li>
          <span className="guide-step-number">1</span>
          <section className="guide-step-content">
            <div className="guide-step-heading">
              <div>
                <h3>Create an API key</h3>
                <p>
                  Generate an environment-scoped key. Qusto displays the secret
                  once, so copy it directly into your secret manager.
                </p>
              </div>
              <Link className="guide-action" href="/settings">
                Create API key <ArrowRight aria-hidden="true" />
              </Link>
            </div>
            <div className="guide-note">
              <KeyRound aria-hidden="true" />
              Use a separate key for each environment and integration.
            </div>
          </section>
        </li>

        <li>
          <span className="guide-step-number">2</span>
          <section className="guide-step-content">
            <div className="guide-step-heading">
              <div>
                <h3>Choose an integration</h3>
                <p>
                  Use the SDK in an application or run the MCP payment client
                  for an AI agent.
                </p>
              </div>
            </div>
            <div className="integration-grid">
              <article className="integration-option">
                <header>
                  <h4>TypeScript SDK</h4>
                  <p>Instrument buyer or seller application code.</p>
                </header>
                <CodeSnippet
                  code={sdkInstall}
                  label="Copy SDK installation command"
                  language="Shell"
                />
                <CodeSnippet
                  code={sdkExample}
                  label="Copy SDK integration example"
                  language="TypeScript"
                />
              </article>
              <article className="integration-option">
                <header>
                  <h4>MCP payment client</h4>
                  <p>Give an agent a governed x402 fetch tool.</p>
                </header>
                <CodeSnippet
                  code={mcpExample}
                  label="Copy MCP configuration"
                  language="JSON"
                />
              </article>
            </div>
          </section>
        </li>

        <li>
          <span className="guide-step-number">3</span>
          <section className="guide-step-content">
            <div className="guide-step-heading">
              <div>
                <h3>Review your policy</h3>
                <p>
                  Confirm the active limits for this environment before the
                  integration can authorize a payment.
                </p>
              </div>
              <Link className="guide-action" href="/policies">
                Open policies <ArrowRight aria-hidden="true" />
              </Link>
            </div>
          </section>
        </li>

        <li>
          <span className="guide-step-number">4</span>
          <section className="guide-step-content">
            <div className="guide-step-heading">
              <div>
                <h3>Verify the trace</h3>
                <p>
                  Make a request to an x402 endpoint, then confirm its policy
                  decision, signing, and settlement events.
                </p>
              </div>
              <Link className="guide-action" href="/traces">
                View traces <ArrowRight aria-hidden="true" />
              </Link>
            </div>
          </section>
        </li>
      </ol>

      <aside className="guide-security" aria-label="Security guidance">
        <ShieldCheck aria-hidden="true" />
        <div>
          <h3>Keep credentials at the boundary</h3>
          <p>
            Store production credentials in environment variables or a secret
            manager. Wallet private keys stay in your local MCP process and are
            never sent to Qusto.
          </p>
        </div>
      </aside>
    </div>
  );
}
