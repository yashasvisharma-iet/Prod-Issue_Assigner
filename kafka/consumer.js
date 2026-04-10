const { kafka } = require('./config');

async function runConsumer({ groupId, topic, onMessage }) {
  const consumer = kafka.consumer({
    groupId,
    retry: {
      retries: 8,
    },
  });

  await consumer.connect();
  await consumer.subscribe({ topic, fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ topic: messageTopic, partition, message }) => {
      const rawValue = message.value ? message.value.toString('utf8') : null;
      let parsed;

      try {
        parsed = rawValue ? JSON.parse(rawValue) : null;
      } catch (error) {
        console.error('Invalid JSON in Kafka message', {
          topic: messageTopic,
          partition,
          offset: message.offset,
          error: error.message,
        });
        return;
      }

      await onMessage({
        topic: messageTopic,
        partition,
        offset: message.offset,
        key: message.key ? message.key.toString('utf8') : null,
        payload: parsed,
      });
    },
  });

  return consumer;
}

module.exports = {
  runConsumer,
};
