"use strict";

const { NormalizedIssueEvent } = require("./webhookDto");

class WebhookParser {

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
