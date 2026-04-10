const { Kafka, logLevel } = require('kafkajs');

const DEFAULT_CLIENT_ID = 'prod-issue-assigner';
const DEFAULT_BROKER = 'localhost:9092';

function readBrokers() {
  const brokers = process.env.KAFKA_BROKERS || DEFAULT_BROKER;
  return brokers
    .split(',')
    .map((broker) => broker.trim())
    .filter(Boolean);
}

const kafka = new Kafka({
  clientId: process.env.KAFKA_CLIENT_ID || DEFAULT_CLIENT_ID,
  brokers: readBrokers(),
  logLevel: process.env.NODE_ENV === 'production' ? logLevel.ERROR : logLevel.INFO,
});

module.exports = {
  kafka,
  readBrokers,
};
