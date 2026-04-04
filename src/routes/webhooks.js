import express from 'express';
import { prisma } from '../db/prisma.js';
import { publishIssueEvent } from '../lib/kafka.js';
import { verifyGitHubSignature, verifyJiraSignature } from '../lib/signature.js';
import { env } from '../config/env.js';
import { normalizeGithubIssueEvent, normalizeJiraIssueEvent } from '../services/normalizer.js';

export const webhookRouter = express.Router();

async function persistAndQueue(event, signatureValid) {
  const existing = await prisma.webhookEvent.findUnique({ where: { idempotencyKey: event.idempotencyKey } });
  if (existing) {
    return { duplicate: true, status: 200, body: { ok: true, duplicate: true } };
  }

  await prisma.webhookEvent.create({
    data: {
      source: event.source,
      externalEventId: event.externalEventId,
      eventType: event.eventType,
      action: event.action,
      signatureValid,
      idempotencyKey: event.idempotencyKey,
      status: 'received',
      payload: event.payload
    }
  });

  await publishIssueEvent(event);

  await prisma.webhookEvent.update({
    where: { idempotencyKey: event.idempotencyKey },
    data: { status: 'queued' }
  });

  return { duplicate: false, status: 202, body: { ok: true, queued: true } };
}

webhookRouter.post('/github/issues', async (req, res) => {
  const rawBody = req.rawBody || JSON.stringify(req.body || {});
  const signature = req.headers['x-hub-signature-256'];
  const signatureValid = verifyGitHubSignature(rawBody, env.githubWebhookSecret, signature);

  if (!signatureValid) {
    return res.status(401).json({ ok: false, error: 'Invalid GitHub signature' });
  }

  const event = normalizeGithubIssueEvent(req.headers, req.body);
  const result = await persistAndQueue(event, signatureValid);
  return res.status(result.status).json(result.body);
});

webhookRouter.post('/jira/issues', async (req, res) => {
  const rawBody = req.rawBody || JSON.stringify(req.body || {});
  const signature = req.headers['x-jira-signature'] || req.headers['x-hub-signature'];
  const signatureValid = verifyJiraSignature(rawBody, env.jiraWebhookSecret, signature);

  if (!signatureValid) {
    return res.status(401).json({ ok: false, error: 'Invalid Jira signature' });
  }

  const event = normalizeJiraIssueEvent(req.headers, req.body);
  const result = await persistAndQueue(event, signatureValid);
  return res.status(result.status).json(result.body);
});
