"use strict";

const crypto = require("crypto");
const { AssignmentJob } = require("./webhookDto");

class WebhookService {
  constructor({
    githubWebhookSecret = process.env.GITHUB_WEBHOOK_SECRET,
    queueConsumer,
    IssueEventPublisher,
  } = {}) {
    this.githubWebhookSecret = githubWebhookSecret;
    this.queueConsumer = queueConsumer;
    this.IssueEventPublisher = IssueEventPublisher;
    this.queue = [];
  }

  validateSignature({ source, headers = {}, rawBody = "" }) {
    return source === "github" && this.validateGithubSignature(headers, rawBody);
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

  async enqueue(issueEvent) {
    const job = new AssignmentJob({
      id: crypto.randomUUID(),
      receivedAt: new Date().toISOString(),
      issueEvent,
    });

    this.queue.push(job);
    await this.publishIssueEvent(issueEvent);

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
  async publishIssueEvent(issueEvent) {
    const payload = this.buildEventPayload(issueEvent);
    await this.IssueEventPublisher(payload);
  }

  buildEventPayload(issueEvent) {
    return {
      issueId: issueEvent.issueId,
      source: issueEvent.source,
      title: issueEvent.title,
      description: issueEvent.body,
      labels: issueEvent.labels,
      assignee: issueEvent.assignee,
      reporter: issueEvent.reporter,
      createdAt: issueEvent.createdAt,
      updatedAt: issueEvent.updatedAt,
    };
  }


}

module.exports = {
  WebhookService,
};
