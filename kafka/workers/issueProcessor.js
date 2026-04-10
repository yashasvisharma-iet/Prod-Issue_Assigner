const { runConsumer } = require('../consumer');
const { TOPICS, ensureTopics } = require('../topics');
const { buildEngineFromPgClient } = require('../../assignment');

const groupId = process.env.KAFKA_CONSUMER_GROUP || 'issue-assignment-workers';

let cachedEngine = null;
let cachedPgClient = null;

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

  const result = await engine.assignIssue(issue, { method: 'rule' });

  console.log('Issue assignment processed', {
    issueId: issue?.issueId,
    assigned: result.assigned,
    reason: result.reason || null,
    developerId: result.assignment?.developer_id || result.assignment?.developerId || null,
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
