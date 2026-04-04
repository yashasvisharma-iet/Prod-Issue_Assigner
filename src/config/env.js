import dotenv from 'dotenv';

dotenv.config();

const required = [
  'DATABASE_URL',
  'KAFKA_BROKERS',
  'KAFKA_TOPIC_ISSUE_EVENTS',
  'GITHUB_WEBHOOK_SECRET',
  'JIRA_WEBHOOK_SECRET'
];

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

export const env = {
  port: Number(process.env.PORT || 3000),
  databaseUrl: process.env.DATABASE_URL,
  kafkaClientId: process.env.KAFKA_CLIENT_ID || 'issue-assigner',
  kafkaBrokers: process.env.KAFKA_BROKERS.split(','),
  kafkaTopicIssueEvents: process.env.KAFKA_TOPIC_ISSUE_EVENTS,
  kafkaConsumerGroup: process.env.KAFKA_CONSUMER_GROUP || 'issue-processor',
  githubWebhookSecret: process.env.GITHUB_WEBHOOK_SECRET,
  jiraWebhookSecret: process.env.JIRA_WEBHOOK_SECRET
};
