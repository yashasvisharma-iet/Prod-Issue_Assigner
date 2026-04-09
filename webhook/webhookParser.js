"use strict";

const { NormalizedIssueEvent } = require("./webhookDto");

class WebhookParser {
  detectSource(headers = {}, payload = {}) {
    if (headers["x-github-event"] || payload.repository?.full_name) {
      return "github";
    }
    return "unknown";
  }

  parse(headers = {}, payload = {}) {
    const source = this.detectSource(headers, payload);

    if (source === "github") {
      return this.parseGithub(headers, payload);
    }

    throw new Error("Unsupported webhook source; only GitHub issue webhooks are accepted");
  }

  parseGithub(headers, payload) {
    const issue = payload.issue;
    if (!issue) {
      throw new Error("GitHub payload missing issue object");
    }

    return new NormalizedIssueEvent({
      source: "github",
      eventType: headers["x-github-event"] || "issues",
      deliveryId: headers["x-github-delivery"],
      issueId: String(issue.id),
      issueKey: `${payload.repository?.full_name || "unknown"}#${issue.number}`,
      title: issue.title,
      body: issue.body || "",
      labels: (issue.labels || []).map((label) => label.name).filter(Boolean),
      assignee: issue.assignee?.login || null,
      reporter: issue.user?.login || null,
      createdAt: issue.created_at,
      updatedAt: issue.updated_at,
      raw: payload,
    });
  }

}

module.exports = {
  WebhookParser,
};
