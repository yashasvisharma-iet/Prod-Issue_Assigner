import { consumer } from './lib/kafka.js';
import { env } from './config/env.js';
import { prisma } from './db/prisma.js';
import { assignIssue } from './services/assignment.js';

async function processIssueEvent(messageValue) {
  const event = JSON.parse(messageValue);

  const issue = await prisma.issue.upsert({
    where: {
      source_externalIssueId: {
        source: event.source,
        externalIssueId: event.externalIssueId
      }
    },
    update: {
      title: event.title,
      description: event.description,
      status: event.status,
      priority: event.priority,
      rawPayload: event.payload
    },
    create: {
      source: event.source,
      externalIssueId: event.externalIssueId,
      title: event.title,
      description: event.description,
      status: event.status,
      priority: event.priority,
      createdAtSource: event.createdAtSource ? new Date(event.createdAtSource) : null,
      rawPayload: event.payload
    }
  });

  await assignIssue(issue.id);

  await prisma.webhookEvent.update({
    where: { idempotencyKey: event.idempotencyKey },
    data: { status: 'processed', processedAt: new Date() }
  });
}

async function bootstrap() {
  await consumer.connect();
  await consumer.subscribe({ topic: env.kafkaTopicIssueEvents, fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) return;
      try {
        await processIssueEvent(message.value.toString());
      } catch (error) {
        console.error('Worker processing failed', error);
      }
    }
  });

  console.log('Processor worker is running');
}

bootstrap().catch((error) => {
  console.error('Failed to start worker', error);
  process.exit(1);
});
