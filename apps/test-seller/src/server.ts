import express, { type Express } from "express";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";

import type { SellerConfig } from "./config.js";

export function createSellerApp(config: SellerConfig): Express {
  const app = express();
  const facilitator = new HTTPFacilitatorClient({
    url: config.facilitatorUrl
  });
  const resourceServer = new x402ResourceServer(facilitator).register(
    config.network.caip2,
    new ExactEvmScheme()
  );

  app.disable("x-powered-by");
  app.get("/health", (_request, response) => {
    response.json({ network: config.network.caip2, ok: true });
  });
  app.use(
    paymentMiddleware(
      {
        "GET /weather": {
          accepts: {
            network: config.network.caip2,
            payTo: config.payTo,
            price: config.price,
            scheme: "exact"
          },
          description: "Base Sepolia x402 weather fixture"
        }
      },
      resourceServer
    )
  );
  app.get("/weather", (_request, response) => {
    response.json({ temperatureCelsius: 29, weather: "sunny" });
  });
  return app;
}
