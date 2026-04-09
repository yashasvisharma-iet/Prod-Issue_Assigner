const { kafka } = require('./config');
const { TOPICS } = require('./topics');

const producer = kafka.producer({
  idempotent: true,
  maxInFlightRequests: 1,
  retry: {
    retries: 5,
  },
});

let connected = false;

async function connectProducer() {
  if (connected) {
    return;
  }

  await producer.connect();
  connected = true;
}

async function disconnectProducer() {
  if (!connected) {
    return;
  }

  await producer.disconnect();
  connected = false;
}

function serializeIssueCreated(payload) {
  return JSON.stringify({
    schemaVersion: 1,
    eventType: 'issue.created',
    emittedAt: new Date().toISOString(),
    data: payload,
  });
}

async function publishIssueCreated(issuePayload) {
  await connectProducer();

  const key = issuePayload.issueId ? String(issuePayload.issueId) : null;

  await producer.send({
    topic: TOPICS.ISSUE_CREATED,
    messages: [
      {
        key,
        value: serializeIssueCreated(issuePayload),
      },
    ],
  });
}

module.exports = {
  connectProducer,
  disconnectProducer,
  publishIssueCreated,
};
