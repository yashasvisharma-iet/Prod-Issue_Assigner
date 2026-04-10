"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");

const { createWebhookController } = require("../webhook/webhookController");
const { WebhookParser } = require("../webhook/webhookParser");
const { WebhookService } = require("../webhook/webhookService");
const { WebhookIdempotencyStore } = require("../webhook/webhookIdempotency");

test("accepts first delivery and ignores duplicate delivery id", async () => {
  const context = createValidWebhookContext();

  const firstResponse = await sendWebhook(context);
  assertAccepted(firstResponse);

  const duplicateResponse = await sendWebhook(context);
  assertDuplicateIgnored(duplicateResponse, context.deliveryId);
});

test("rejects invalid signature", async () => {
  const context = createInvalidSignatureContext();

  const response = await sendWebhook(context);
  assertInvalidSignature(response);
});

/* =======================
   High-Level Flow Helpers
======================= */

async function sendWebhook(context) {
  const res = buildResponseRecorder();
  await context.controller(context.req, res);
  return res;
}

/* =======================
   Context Builders
======================= */

function createValidWebhookContext() {
  const secret = "test-secret";
  const payload = makeGithubPayload();
  const rawBody = JSON.stringify(payload);

  return {
    deliveryId: "delivery-abc",
    req: buildRequest({
      payload,
      rawBody,
      secret,
      deliveryId: "delivery-abc",
    }),
    controller: buildController(secret, true),
  };
}

function createInvalidSignatureContext() {
  const payload = makeGithubPayload();

  return {
    req: {
      method: "POST",
      headers: {
        "x-github-event": "issues",
        "x-github-delivery": "delivery-invalid",
        "x-hub-signature-256": "sha256=deadbeef",
      },
      body: payload,
      rawBody: JSON.stringify(payload),
    },
    controller: buildController("real-secret", false),
  };
}

/* =======================
   Builders
======================= */

function buildController(secret, withIdempotency) {
  const parser = new WebhookParser();
  const service = new WebhookService({ githubWebhookSecret: secret });

  if (!withIdempotency) {
    return createWebhookController({ parser, service });
  }

  const store = new WebhookIdempotencyStore({ ttlMs: 10_000 });

  return createWebhookController({
    parser,
    service,
    idempotencyStore: store,
  });
}

function buildRequest({ payload, rawBody, secret, deliveryId }) {
  return {
    method: "POST",
    headers: buildHeaders(secret, rawBody, deliveryId),
    body: payload,
    rawBody,
  };
}

function buildHeaders(secret, rawBody, deliveryId) {
  return {
    "x-github-event": "issues",
    "x-github-delivery": deliveryId,
    "x-hub-signature-256": sign(secret, rawBody),
  };
}

/* =======================
   Assertions
======================= */

function assertAccepted(res) {
  assert.equal(res.statusCode, 202);
  assert.equal(res.payload.status, "accepted");
}

function assertDuplicateIgnored(res, deliveryId) {
  assert.equal(res.statusCode, 202);
  assert.equal(res.payload.status, "duplicate_ignored");
  assert.equal(res.payload.idempotencyKey, deliveryId);
}

function assertInvalidSignature(res) {
  assert.equal(res.statusCode, 401);
  assert.equal(res.payload.error, "Invalid webhook signature/token");
}

/* =======================
   Utilities
======================= */

function buildResponseRecorder() {
  return {
    statusCode: null,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
  };
}

function makeGithubPayload() {
  return {
    action: "opened",
    repository: { full_name: "acme/api" },
    issue: {
      id: 123,
      number: 7,
      title: "Race condition",
      body: "Intermittent",
      labels: [{ name: "bug" }, { name: "p0" }],
      user: { login: "reporter1" },
      assignee: { login: "owner1" },
      created_at: "2026-04-09T00:00:00.000Z",
      updated_at: "2026-04-09T00:00:00.000Z",
    },
  };
}

function sign(secret, rawBody) {
  const digest = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  return `sha256=${digest}`;
}