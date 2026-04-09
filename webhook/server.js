"use strict";

const http = require("http");
const { createWebhookController } = require("./webhookController");

function createResponseAdapter(res) {
  return {
    status(code) {
      res.statusCode = code;
      return this;
    },
    json(payload) {
      if (!res.headersSent) {
        res.setHeader("content-type", "application/json; charset=utf-8");
      }
      res.end(JSON.stringify(payload));
    },
  };
}

function parseJsonBody(body) {
  if (!body) {
    return {};
  }

  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

function startWebhookServer({
  port = Number(process.env.PORT || 3000),
  host = process.env.HOST || "0.0.0.0",
  controller = createWebhookController(),
  logger = console,
} = {}) {
  const server = http.createServer(async (req, res) => {
    if (req.url === "/healthz") {
      return createResponseAdapter(res).status(200).json({ status: "ok" });
    }

    if (req.url !== "/webhook/issues") {
      return createResponseAdapter(res).status(404).json({ error: "Not found" });
    }

    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("error", () => createResponseAdapter(res).status(400).json({ error: "Invalid request body" }));
    req.on("end", async () => {
      const rawBody = Buffer.concat(chunks).toString("utf8");
      const body = parseJsonBody(rawBody);
      if (body === null) {
        return createResponseAdapter(res).status(400).json({ error: "Invalid JSON body" });
      }

      const adaptedReq = {
        method: req.method,
        headers: req.headers,
        body,
        rawBody,
      };

      try {
        await controller(adaptedReq, createResponseAdapter(res));
      } catch (error) {
        logger.error("Unhandled webhook handler error", { error: error.message });
        createResponseAdapter(res).status(500).json({ error: "Internal server error" });
      }
    });
  });

  server.listen(port, host, () => {
    logger.info(`Webhook server listening on http://${host}:${port}`);
  });

  return server;
}

if (require.main === module) {
  startWebhookServer();
}

module.exports = {
  startWebhookServer,
};