const { kafka } = require('./config');

const TOPICS = {
  ISSUE_CREATED: process.env.KAFKA_TOPIC_ISSUE_CREATED || 'issues.created.v1',
};

async function ensureTopics() {
  const admin = kafka.admin();
  await admin.connect();

  try {
    await admin.createTopics({
      waitForLeaders: true,
      topics: [
        {
          topic: TOPICS.ISSUE_CREATED,
          numPartitions: 3,
          replicationFactor: 1,
        },
      ],
    });
  } finally {
    await admin.disconnect();
  }
}

module.exports = {
  TOPICS,
  ensureTopics,
};
