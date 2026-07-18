# @qusto/mcp

An stdio MCP server for governed x402 HTTP payments. It exposes only payment-client tools; policy administration and trace queries stay in the Qusto dashboard.

```json
{
  "mcpServers": {
    "qusto": {
      "command": "npx",
      "args": ["-y", "@qusto/mcp"],
      "env": {
        "QUSTO_BASE_URL": "https://qusto.example.com",
        "QUSTO_API_KEY": "<project environment key>",
        "X402_PRIVATE_KEY": "<local EVM private key>",
        "BASE_NETWORK": "base",
        "BASE_RPC_URL": "https://mainnet.base.org"
      }
    }
  }
}
```

The private key is read only by the local MCP process and is never sent to Qusto. Production requests block loopback, private, link-local, and non-HTTP destinations, pin validated DNS results, limit redirects, enforce timeouts, and cap response bodies.

For Base Sepolia use `BASE_NETWORK=base-sepolia` and `BASE_RPC_URL=https://sepolia.base.org`. The wallet balance check then uses Base Sepolia USDC and refuses to sign mainnet or non-USDC requirements. `X402_PRIVATE_KEY_FILE` may be used instead of `X402_PRIVATE_KEY`; configuring both is rejected.
