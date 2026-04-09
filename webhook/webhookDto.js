"use strict";

/**
 * Canonical issue event consumed by downstream assignment stages.
 */
class NormalizedIssueEvent {
  constructor({
    source,
    eventType,
    deliveryId,
    issueId,
    issueKey,
    title,
    body,
    labels = [],
    assignee,
    reporter,
    createdAt,
    updatedAt,
    raw,
  }) {
    this.source = source;
    this.eventType = eventType;
    this.deliveryId = deliveryId;
    this.issueId = issueId;
    this.issueKey = issueKey;
    this.title = title;
    this.body = body;
    this.labels = labels;
    this.assignee = assignee;
    this.reporter = reporter;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
    this.raw = raw;
  }
}

/**
 * Queue payload for phase-1 processing pipeline.
 */
class AssignmentJob {
  constructor({ id, receivedAt, issueEvent }) {
    this.id = id;
    this.receivedAt = receivedAt;
    this.issueEvent = issueEvent;
  }
}

module.exports = {
  AssignmentJob,
  NormalizedIssueEvent,
};
