import { buildIdempotencyKey } from '../lib/signature.js';

export function normalizeGithubIssueEvent(headers, payload) {
  const externalEventId = headers['x-github-delivery'];
  const eventType = headers['x-github-event'] || 'issues';
  const action = payload.action;
  const issue = payload.issue || {};

  return {
    source: 'github',
    externalEventId,
    eventType,
    action,
    externalIssueId: String(issue.id || issue.number || ''),
    title: issue.title || 'Untitled GitHub Issue',
    description: issue.body || null,
    status: issue.state || null,
    priority: null,
    createdAtSource: issue.created_at ? new Date(issue.created_at).toISOString() : null,
    payload,
    idempotencyKey: buildIdempotencyKey({
      source: 'github',
      externalEventId,
      action,
      issueId: issue.id || issue.number
    })
  };
}

export function normalizeJiraIssueEvent(headers, payload) {
  const externalEventId = headers['x-request-id'] || headers['x-atlassian-webhook-identifier'];
  const eventType = headers['x-event-key'] || payload.webhookEvent || 'jira:issue_updated';
  const action = payload.issue_event_type_name || payload.webhookEvent || 'updated';
  const issue = payload.issue || {};
  const fields = issue.fields || {};

  return {
    source: 'jira',
    externalEventId,
    eventType,
    action,
    externalIssueId: String(issue.id || issue.key || ''),
    title: fields.summary || 'Untitled Jira Issue',
    description: fields.description || null,
    status: fields.status?.name || null,
    priority: fields.priority?.name || null,
    createdAtSource: fields.created ? new Date(fields.created).toISOString() : null,
    payload,
    idempotencyKey: buildIdempotencyKey({
      source: 'jira',
      externalEventId,
      action,
      issueId: issue.id || issue.key
    })
  };
}
