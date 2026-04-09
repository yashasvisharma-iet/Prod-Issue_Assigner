# Parallel Processing Layer (Phase 4.4)

This folder implements the queue system for issue ingestion/processing using **Apache Kafka** and **Node.js**.

## Why this exists

The webhook endpoint should stay fast and resilient during traffic spikes (for example, 500 issues arriving at once). Kafka decouples ingestion from assignment processing:

1. Webhook receives issue event
2. Event is published to Kafka topic
3. Worker consumers process events asynchronously

## Folder structure

```text
parallel/
  README.md
  kafka/
    config.js           # Shared Kafka client config
    topics.js           # Topic constants and bootstrap helper
    producer.js         # Producer used by webhook/server side
    consumer.js         # Generic consumer runner
    index.js            # Public exports for integration
    workers/
      issueProcessor.js # Processing worker for issue-created events
```

## Install dependency

From repository root:

```bash
npm install kafkajs
```

## Environment variables

```bash
KAFKA_CLIENT_ID=prod-issue-assigner
KAFKA_BROKERS=localhost:9092
KAFKA_TOPIC_ISSUE_CREATED=issues.created.v1
KAFKA_CONSUMER_GROUP=issue-assignment-workers
```

- `KAFKA_BROKERS` is a comma-separated list.

## Example integration in webhook controller/service

```js
const { publishIssueCreated } = require('../parallel/kafka');

await publishIssueCreated({
  issueId: issue.id,
  source: issue.source,
  title: issue.title,
  description: issue.description,
  createdAt: issue.created_at,
});
```

## Run worker

```bash
node parallel/kafka/workers/issueProcessor.js
```

## Notes

- Producer retries are enabled with idempotent semantics to reduce duplicate writes.
- Consumer commits only after message handling returns successfully.
- Message format is versioned (`schemaVersion`) for future compatibility.
