"use strict";

const { WebhookParser } = require("./webhookParser");
const { WebhookService } = require("./webhookService");
const { WebhookIdempotencyStore } = require("./webhookIdempotency");

function createWebhookController({
  parser = new WebhookParser(),
  service = new WebhookService(),
  idempotencyStore = new WebhookIdempotencyStore(),
  logger = console,
} = {}) {
  return async function handleWebhookIssues(req, res) {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const context = buildRequestContext(req);

    const issueEvent = parseEvent(context, parser, logger, res);
    if (!issueEvent) return;

    if (!isSignatureValid(issueEvent, context, service, res)) return;

    const key = generateIdempotencyKey(issueEvent);
    if (isDuplicate(key, idempotencyStore, res)) return;

    const job = enqueueEvent(issueEvent, service);
    return sendAcceptedResponse(res, job, issueEvent);
  };
}


function buildRequestContext(req) {
  const headers = normalizeHeaders(req.headers);
  const payload = req.body || {};
  const rawBody = req.rawBody || JSON.stringify(payload);

  return { headers, payload, rawBody };
}

function parseEvent(context, parser, logger, res) {
  try {
    return parser.parse(context.headers, context.payload);
  } catch (error) {
    logger.warn("Invalid webhook payload", { error: error.message });
    res.status(400).json({ error: error.message });
    return null;
  }
}

function isSignatureValid(issueEvent, context, service, res) {
  const valid = service.validateSignature({
    source: issueEvent.source,
    headers: context.headers,
    rawBody: context.rawBody,
  });

  if (!valid) {
    res.status(401).json({ error: "Invalid webhook signature/token" });
  }

  return valid;
}

function generateIdempotencyKey(issueEvent) {
  return (
    issueEvent.deliveryId ||
    `${issueEvent.source}:${issueEvent.issueId}:${issueEvent.updatedAt || issueEvent.createdAt}`
  );
}

function isDuplicate(key, store, res) {
  if (store.has(key)) {
    res.status(202).json({ status: "duplicate_ignored", idempotencyKey: key });
    return true;
  }

  store.mark(key);
  return false;
}

function enqueueEvent(issueEvent, service) {
  return service.enqueue(issueEvent);
}

function sendAcceptedResponse(res, job, issueEvent) {
  return res.status(202).json({
    status: "accepted",
    queueJobId: job.id,
    issueKey: issueEvent.issueKey,
    source: issueEvent.source,
  });
}



function normalizeHeaders(headers = {}) {
  const normalized = {};

  for (const [key, value] of Object.entries(headers)) {
    normalized[String(key).toLowerCase()] = value;
  }

  return normalized;
}

module.exports = {
  createWebhookController,
};