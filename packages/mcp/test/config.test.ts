import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { loadMcpConfig } from "../src/config.js";

const temporaryDirectories: string[] = [];
const privateKey = `0x${"11".repeat(32)}`;

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true }))
  );
});

describe("loadMcpConfig", () => {
  it("defaults to Base mainnet and its RPC", () => {
    const config = loadMcpConfig({
      QUSTO_API_KEY: "qsk_fixture",
      QUSTO_BASE_URL: "https://qusto.example.com",
      X402_PRIVATE_KEY: privateKey
    });

    expect(config.baseNetwork.name).toBe("base");
    expect(config.baseRpcUrl).toBe("https://mainnet.base.org");
  });

  it("selects Base Sepolia and reads a private key file", async () => {
    const directory = await mkdtemp(join(tmpdir(), "qusto-mcp-"));
    temporaryDirectories.push(directory);
    const path = join(directory, "wallet-key");
    await writeFile(path, `${privateKey}\n`, { mode: 0o600 });

    const config = loadMcpConfig({
      BASE_NETWORK: "base-sepolia",
      QUSTO_API_KEY: "qsk_fixture",
      QUSTO_BASE_URL: "https://qusto.example.com",
      X402_PRIVATE_KEY_FILE: path
    });

    expect(config.baseNetwork.caip2).toBe("eip155:84532");
    expect(config.baseRpcUrl).toBe("https://sepolia.base.org");
    expect(config.privateKey).toBe(privateKey);
  });

  it("rejects ambiguous private-key configuration", () => {
    expect(() =>
      loadMcpConfig({
        QUSTO_API_KEY: "qsk_fixture",
        QUSTO_BASE_URL: "https://qusto.example.com",
        X402_PRIVATE_KEY: privateKey,
        X402_PRIVATE_KEY_FILE: "/run/secrets/wallet"
      })
    ).toThrow("only one of X402_PRIVATE_KEY or X402_PRIVATE_KEY_FILE");
  });
});
