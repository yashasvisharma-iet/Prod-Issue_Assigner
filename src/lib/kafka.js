import { Kafka } from 'kafkajs';
import { env } from '../config/env.js';

const kafka = new Kafka({
  clientId: env.kafkaClientId,
  brokers: env.kafkaBrokers
});

export const producer = kafka.producer();
export const consumer = kafka.consumer({ groupId: env.kafkaConsumerGroup });

let producerConnected = false;

export async function ensureProducer() {
  if (!producerConnected) {
    await producer.connect();
    producerConnected = true;
  }
}

export async function publishIssueEvent(event) {
  await ensureProducer();
  await producer.send({
    topic: env.kafkaTopicIssueEvents,
    messages: [{ key: event.idempotencyKey, value: JSON.stringify(event) }]
  });
}
