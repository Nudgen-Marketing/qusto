import { loadSellerConfig } from "./config.js";
import { createSellerApp } from "./server.js";

function log(level: "error" | "info", message: string, data = {}): void {
  const output = JSON.stringify({
    level,
    message,
    timestamp: new Date().toISOString(),
    ...data
  });
  if (level === "error") console.error(output);
  else console.info(output);
}

function main(): void {
  const config = loadSellerConfig();
  const server = createSellerApp(config).listen(config.port, "0.0.0.0", () => {
    log("info", "test_seller.started", {
      network: config.network.caip2,
      port: config.port,
      price: config.price
    });
  });
  const stop = () => {
    server.close((error) => {
      if (error !== undefined) {
        log("error", "test_seller.stop_failed", { error: error.message });
        process.exitCode = 1;
      }
    });
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
}

try {
  main();
} catch (error) {
  log("error", "test_seller.fatal", {
    error: error instanceof Error ? error.message : "unknown"
  });
  process.exitCode = 1;
}
