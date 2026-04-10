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
node kafka/workers/issueProcessor.js
```

## Notes

- Producer retries are enabled with idempotent semantics to reduce duplicate writes.
- Consumer commits only after message handling returns successfully.
- Message format is versioned (`schemaVersion`) for future compatibility.

## My Notes

## Assignment engine integration

The worker now invokes a hybrid scoring assignment engine after consuming `issue.created` events.

### Required runtime config

```bash
DATABASE_URL=postgres://user:password@localhost:5432/prod_issue_assigner
npm install pg
```

### Assignment method

The engine follows a hybrid scoring flow:

1. Parse issue content (`title`, `description`, `labels`) into keywords/features.
2. Score each available developer using weighted factors:
   - skill match (soft/partial match)
   - weighted current load
   - availability status
3. Select best candidate.
4. If scores tie, pick using round-robin based on oldest recent assignment.
5. Atomically persist assignment in a DB transaction:
   - lock issue row
   - set `issues.assigned_to`
   - insert into `assignments`
   - increment `developers.current_load`

If `DATABASE_URL` is missing or `pg` is not installed, worker logs a warning and safely skips assignment.
