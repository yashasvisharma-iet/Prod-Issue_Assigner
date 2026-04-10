"use strict";

const express = require("express");
const { createWebhookController } = require("./webhookController");


function startWebhookServer({
  port = Number(process.env.PORT || 3000),
  host = process.env.HOST || "0.0.0.0",
  controller = createWebhookController(),
  logger = console,
} = {}) {
  const app = express();

  app.get("/healthz", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  app.all("/webhook/issues", express.text({ type: "*/*" }), async (req, res) => {
    const rawBody = typeof req.body === "string" ? req.body : "";
    const body = parseJsonBody(rawBody);
    if (body === null) {
      return res.status(400).json({ error: "Invalid JSON body" });
    }
    const deliveryId = req.headers["x-github-delivery"];
    logger.info("Webhook received", {
      deliveryId,
    });

    const request = {
      method: req.method,
      headers: req.headers,
      body,
      rawBody,
    };

    try {
      await controller(request, res);
      logger.info("Webhook processed successfully", {
        action: body?.action,
        sender: body?.sender?.login,
        issue: {
            id: body?.issue?.id,
            number: body?.issue?.number,
            title: body?.issue?.title,
        },
        statusCode: res.statusCode,
        });
    } catch (error) {
      logger.error("Unhandled webhook handler error", { error: error.message });
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  app.use((_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  const server = app.listen(port, host, () => {
    logger.info(`Webhook server listening on http://${host}:${port}`);
  });

  return server;
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

if (require.main === module) {
  startWebhookServer();
}

module.exports = {
  startWebhookServer,
};
