"use strict";

const { NormalizedIssueEvent } = require("./webhookDto");

class WebhookParser {
  detectSource(headers = {}, payload = {}) {
    if (headers["x-github-event"] || payload.repository?.full_name) {
      return "github";
    }
    if (headers["x-atlassian-webhook-identifier"] || payload.issue?.key) {
      return "jira";
    }
    return "unknown";
  }

  parse(headers = {}, payload = {}) {
    const source = this.detectSource(headers, payload);

    if (source === "github") {
      return this.parseGithub(headers, payload);
    }

    if (source === "jira") {
      return this.parseJira(headers, payload);
    }

    throw new Error("Unsupported webhook source");
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

  parseJira(headers, payload) {
    const issue = payload.issue;
    if (!issue) {
      throw new Error("Jira payload missing issue object");
    }

    const fields = issue.fields || {};

    return new NormalizedIssueEvent({
      source: "jira",
      eventType: payload.webhookEvent || headers["x-atlassian-webhook-identifier"] || "jira:issue_created",
      deliveryId: headers["x-request-id"] || headers["x-atlassian-webhook-identifier"],
      issueId: String(issue.id),
      issueKey: issue.key,
      title: fields.summary,
      body: fields.description || "",
      labels: fields.labels || [],
      assignee: fields.assignee?.displayName || null,
      reporter: fields.reporter?.displayName || null,
      createdAt: fields.created,
      updatedAt: fields.updated,
      raw: payload,
    });
  }
}

module.exports = {
  WebhookParser,
};
