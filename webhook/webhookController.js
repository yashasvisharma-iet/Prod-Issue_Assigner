"use strict";

const { WebhookParser } = require("./webhookParser");
const { WebhookService } = require("./webhookService");
const { WebhookIdempotencyStore } = require("./webhookIdempotency");

function normalizeHeaders(headers = {}) {
  const normalized = {};
  for (const [key, value] of Object.entries(headers)) {
    normalized[String(key).toLowerCase()] = value;
  }
  return normalized;
}

function createWebhookController({
  parser = new WebhookParser(),
  service = new WebhookService(),
  idempotencyStore = new WebhookIdempotencyStore(),
  logger = console,
} = {}) {
  /**
   * Express-compatible handler for POST /webhook/issues
   * Note: configure express raw-body capture to preserve signature validation fidelity.
   */
  return async function webhookIssuesHandler(req, res) {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const headers = normalizeHeaders(req.headers);
    const payload = req.body || {};
    const rawBody = req.rawBody || JSON.stringify(payload);

    let issueEvent;
    try {
      issueEvent = parser.parse(headers, payload);
    } catch (error) {
      logger.warn("Invalid webhook payload", { error: error.message });
      return res.status(400).json({ error: error.message });
    }

    const signatureValid = service.validateSignature({
      source: issueEvent.source,
      headers,
      rawBody,
    });

    if (!signatureValid) {
      return res.status(401).json({ error: "Invalid webhook signature/token" });
    }

    const idempotencyKey =
      issueEvent.deliveryId ||
      `${issueEvent.source}:${issueEvent.issueId}:${issueEvent.updatedAt || issueEvent.createdAt}`;

    if (idempotencyStore.has(idempotencyKey)) {
      return res.status(202).json({ status: "duplicate_ignored", idempotencyKey });
    }

    idempotencyStore.mark(idempotencyKey);
    const job = service.enqueue(issueEvent);

    return res.status(202).json({
      status: "accepted",
      queueJobId: job.id,
      issueKey: issueEvent.issueKey,
      source: issueEvent.source,
    });
  };
}

module.exports = {
  createWebhookController,
};
