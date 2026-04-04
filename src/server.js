import express from 'express';
import morgan from 'morgan';
import { env } from './config/env.js';
import { webhookRouter } from './routes/webhooks.js';

const app = express();

app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf.toString('utf8');
    }
  })
);
app.use(morgan('combined'));

app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'webhook-service' });
});

app.use('/webhook', webhookRouter);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ ok: false, error: 'Internal server error' });
});

app.listen(env.port, () => {
  console.log(`Webhook service running on port ${env.port}`);
});
