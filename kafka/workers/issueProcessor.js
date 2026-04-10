const { runConsumer } = require('../consumer');
const { TOPICS, ensureTopics } = require('../topics');
const { buildEngineFromPgClient } = require('../../assignment');
const { EmailNotifier } = require('../../notifications/emailNotifier');

const groupId = process.env.KAFKA_CONSUMER_GROUP || 'issue-assignment-workers';

let cachedEngine = null;
let cachedPgClient = null;
let cachedNotifier = null;

async function getAssignmentEngine() {
  if (cachedEngine) {
    return cachedEngine;
  }

  if (!process.env.DATABASE_URL) {
    console.warn('DATABASE_URL is not configured; assignment engine is disabled.');
    return null;
  }

  let Client;
  try {
    ({ Client } = require('pg'));
  } catch (error) {
    console.warn('pg dependency not installed; assignment engine is disabled.', {
      error: error.message,
    });
    return null;
  }

  cachedPgClient = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  await cachedPgClient.connect();
  cachedEngine = buildEngineFromPgClient(cachedPgClient);
  return cachedEngine;
}


function getEmailNotifier() {
  if (!cachedNotifier) {
    cachedNotifier = new EmailNotifier({ logger: console });
  }

  return cachedNotifier;
}

async function handleIssueCreatedEvent(message) {
  const issueEvent = message.payload;

  if (!issueEvent || issueEvent.eventType !== 'issue.created') {
    console.warn('Skipping unexpected Kafka event', {
      offset: message.offset,
      payload: issueEvent,
    });
    return;
  }

  const issue = issueEvent.data;
  const engine = await getAssignmentEngine();

  if (!engine) {
    console.log('Received issue.created event (assignment skipped)', {
      issueId: issue?.issueId,
      source: issue?.source,
      title: issue?.title,
      offset: message.offset,
    });
    return;
  }

  await upsertIssueFromEvent(issue);
  const result = await engine.assignIssue(issue, { method: 'rule' });

  const notification = await sendAssignmentNotification({
    assigned: result.assigned,
    issue,
    candidate: result.candidate,
  });

  console.log('Issue assignment processed', {
    issueId: issue?.issueId,
    assigned: result.assigned,
    reason: result.reason || null,
    developerId: result.assignment?.developer_id || result.assignment?.developerId || null,
    notification,
    offset: message.offset,
  });
}

async function start() {
  await ensureTopics();

  await runConsumer({
    groupId,
    topic: TOPICS.ISSUE_CREATED,
    onMessage: handleIssueCreatedEvent,
  });

  console.log('Issue processor consumer started', {
    groupId,
    topic: TOPICS.ISSUE_CREATED,
  });
}

start().catch((error) => {
  console.error('Issue processor crashed', error);
  process.exit(1);
});

async function upsertIssueFromEvent(issue = {}) {
  if (!cachedPgClient) {
    throw new Error('Database client is not initialized');
  }

  const issueId = issue.issueId || issue.id;
  if (!issueId) {
    throw new Error('Issue payload is missing issueId');
  }

  await cachedPgClient.query(
    `INSERT INTO issues (
      id,
      title,
      description,
      source,
      status,
      created_at,
      updated_at
    ) VALUES ($1, $2, $3, $4, 'open', COALESCE($5, NOW()), COALESCE($6, NOW()))
    ON CONFLICT (id) DO UPDATE
      SET title = EXCLUDED.title,
          description = EXCLUDED.description,
          source = EXCLUDED.source,
          updated_at = EXCLUDED.updated_at`,
    [
      issueId,
      issue.title || '',
      issue.description || issue.body || '',
      issue.source || null,
      issue.createdAt || null,
      issue.updatedAt || null,
    ]
  );
}


async function sendAssignmentNotification({ assigned, issue, candidate }) {
  if (!assigned) {
    return {
      sent: false,
      reason: 'not_assigned',
    };
  }

  const notifier = getEmailNotifier();

  try {
    return await notifier.sendIssueAssigned({
      issue,
      developer: candidate?.developer,
    });
  } catch (error) {
    console.error('Failed to send assignment email notification', {
      issueId: issue?.issueId || issue?.id || null,
      developerId: candidate?.developer?.id || null,
      error: error.message,
    });

    return {
      sent: false,
      reason: 'send_failed',
      error: error.message,
    };
  }
}
