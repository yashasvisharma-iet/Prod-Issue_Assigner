import express from 'express';
import morgan from 'morgan';
import { env } from './config/env.js';
import { webhookRouter } from './routes/webhooks.js';

const app = express();

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf.toString('utf8');
    }
  })
);
app.use(morgan('combined'));

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'webhook-service' });
});

app.use('/webhook', webhookRouter);

app.use((_req, res) => {
  res.status(404).json({ ok: false, error: 'Route not found' });
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ ok: false, error: 'Internal server error' });
});

const server = app.listen(env.port, () => {
  console.log(`Webhook service running on port ${env.port}`);
});

async function shutdown() {
  await new Promise((resolve) => server.close(resolve));
}

process.on('SIGINT', async () => {
  await shutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await shutdown();
  process.exit(0);
});
