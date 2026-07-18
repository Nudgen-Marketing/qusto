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
        "X402_PRIVATE_KEY": "<local EVM private key>"
      }
    }
  }
}
```

The private key is read only by the local MCP process and is never sent to Qusto. Production requests block loopback, private, link-local, and non-HTTP destinations, pin validated DNS results, limit redirects, enforce timeouts, and cap response bodies.
