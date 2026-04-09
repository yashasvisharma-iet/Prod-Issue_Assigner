"use strict";

const crypto = require("crypto");
const { AssignmentJob } = require("./webhookDto");

class WebhookService {
  constructor({
    githubWebhookSecret = process.env.GITHUB_WEBHOOK_SECRET,
    jiraWebhookToken = process.env.JIRA_WEBHOOK_TOKEN,
    queueConsumer,
  } = {}) {
    this.githubWebhookSecret = githubWebhookSecret;
    this.jiraWebhookToken = jiraWebhookToken;
    this.queueConsumer = queueConsumer;
    this.queue = [];
  }

  validateSignature({ source, headers = {}, rawBody = "" }) {
    if (source === "github") {
      return this.validateGithubSignature(headers, rawBody);
    }

    if (source === "jira") {
      return this.validateJiraToken(headers);
    }

    return false;
  }

  validateGithubSignature(headers, rawBody) {
    if (!this.githubWebhookSecret) {
      throw new Error("Missing GITHUB_WEBHOOK_SECRET");
    }

    const signature = headers["x-hub-signature-256"];
    if (!signature) {
      return false;
    }

    const digest = `sha256=${crypto
      .createHmac("sha256", this.githubWebhookSecret)
      .update(rawBody)
      .digest("hex")}`;

    return this.safeCompare(signature, digest);
  }

  validateJiraToken(headers) {
    if (!this.jiraWebhookToken) {
      // Fallback mode for local development if token is not configured.
      return true;
    }

    const token = headers["x-jira-webhook-token"] || headers.authorization?.replace(/^Bearer\s+/i, "");
    if (!token) {
      return false;
    }

    return this.safeCompare(token, this.jiraWebhookToken);
  }

  enqueue(issueEvent) {
    const job = new AssignmentJob({
      id: crypto.randomUUID(),
      receivedAt: new Date().toISOString(),
      issueEvent,
    });

    this.queue.push(job);

    if (this.queueConsumer) {
      Promise.resolve(this.queueConsumer(job)).catch(() => {
        // Intentionally swallowed at this phase; failures are retried by future queue infrastructure.
      });
    }

    return job;
  }

  safeCompare(a, b) {
    const aBuf = Buffer.from(String(a));
    const bBuf = Buffer.from(String(b));

    if (aBuf.length !== bBuf.length) {
      return false;
    }

    return crypto.timingSafeEqual(aBuf, bBuf);
  }
}

module.exports = {
  WebhookService,
};
