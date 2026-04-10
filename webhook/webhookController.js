"use strict";

const { WebhookParser } = require("./webhookParser");
const { WebhookService } = require("./webhookService");
const { WebhookIdempotencyStore } = require("./webhookIdempotency");

function createWebhookController(deps = {}) {
  //resolving deps is basically just  fetching them from service
  const resolvedDeps = resolveControllerDependencies(deps);
  const serviceInstance = resolvedDeps.service || new WebhookService({ IssueEventPublisher: performEventPublishing(resolvedDeps.logger) });
  return async function handleWebhookIssues(req, res) {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const context = buildRequestContext(req);

    const issueEvent = parseEvent(context, resolvedDeps.parser, resolvedDeps.logger, res);
    if (!issueEvent) return;

    if (!isSignatureValid(issueEvent, context, serviceInstance, res)) return;

    const key = generateIdempotencyKey(issueEvent);
    if (isDuplicate(key, resolvedDeps.idempotencyStore, res)) return;

    const job = await enqueueEvent(issueEvent, serviceInstance);
    return sendAcceptedResponse(res, job, issueEvent);
  };
}

function resolveControllerDependencies({  service, parser, idempotencyStore, logger } = {}) {
  return {
    service: resolveService(service, logger),
    parser: parser || new WebhookParser(),
    idempotencyStore: idempotencyStore || new WebhookIdempotencyStore(),
    logger: logger || console,
  };
}

function resolveService(service, logger) {
  if (service) return service;

  return createWebhookService(logger);
}

function createWebhookService(logger) {
  return new WebhookService({
    IssueEventPublisher: resolveIssueEventPublisher(logger),
  });
}

function resolveIssueEventPublisher(logger) {
  try {
    const { publishIssueCreated } = require("../kafka/producer");
    return publishIssueCreated;
  } catch (error) {
    logPublisherUnavailable(logger, error);
    return async function noopPublisher() {};
  }
}


function buildRequestContext(req) {
  const headers = normalizeHeaders(req.headers);
  const payload = req.body || {};
  const rawBody = req.rawBody || JSON.stringify(payload);

  return { headers, payload, rawBody };
}

function parseEvent(context, parser, logger, res) {
  try {
    return parser.parseGithub(context.headers, context.payload);
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

function logPublisherUnavailable(logger, error) {
  logger.warn("Kafka publisher unavailable; proceeding without Kafka enqueue", {
    error: error.message,
  });
}

module.exports = {
  createWebhookController,
};