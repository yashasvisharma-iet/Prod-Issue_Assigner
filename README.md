# Prod Issue Assigner (Phase 1)

Node.js + Express + PostgreSQL + Prisma + Kafka implementation of the server foundation for intelligent issue assignment.

## What this includes

- Webhook ingestion endpoints:
  - `POST /webhook/github/issues`
  - `POST /webhook/jira/issues`
- Signature verification for GitHub/Jira webhooks (with safe constant-time comparison)
- Canonical event normalization
- Idempotent webhook event persistence (`WebhookEvent` table)
- Kafka producer for decoupled processing
- Kafka consumer worker for issue upsert + placeholder assignment
- Failed queue publish / processing state persisted to DB for observability
- Graceful shutdown hooks for API and worker
- PostgreSQL schema via Prisma for developers, issues, assignments, webhook events

## Project structure

- `src/server.js` - Express server + webhook route mounting
- `src/routes/webhooks.js` - Webhook handlers for GitHub/Jira
- `src/services/normalizer.js` - Provider payload normalization + required field checks
- `src/services/assignment.js` - Placeholder assignment logic (lowest-load available)
- `src/worker.js` - Kafka consumer worker
- `src/lib/signature.js` - HMAC signature verification + idempotency key creation
- `src/lib/kafka.js` - Kafka producer/consumer setup
- `prisma/schema.prisma` - Data model and enums

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy env file:
   ```bash
   cp .env.example .env
   ```
3. Set real values in `.env`.
4. Run Prisma generate/migrations:
   ```bash
   npm run prisma:generate
   npm run prisma:migrate
   ```
5. Start webhook service:
   ```bash
   npm run dev
   ```
6. In another terminal, run worker:
   ```bash
   npm run worker
   ```

## Notes

- This is Phase 1 infra-focused implementation.
- Assignment logic is intentionally placeholder and will evolve in Phase 2.
- For production, run Kafka with retries/DLQ policies and add metrics/tracing.
