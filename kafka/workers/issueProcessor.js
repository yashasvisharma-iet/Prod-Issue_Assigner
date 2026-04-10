const { runConsumer } = require('../consumer');
const { TOPICS, ensureTopics } = require('../topics');

const groupId = process.env.KAFKA_CONSUMER_GROUP || 'issue-assignment-workers';

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

  // TODO: replace this with assignment-engine invocation.
  console.log('Processing issue.created event', {
    issueId: issue?.issueId,
    source: issue?.source,
    title: issue?.title,
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
