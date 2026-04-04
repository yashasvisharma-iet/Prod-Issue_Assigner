import crypto from 'crypto';

export function verifyGitHubSignature(rawBody, secret, signatureHeader) {
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) return false;
  const expected = `sha256=${crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex')}`;

  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader));
}

export function verifyJiraSignature(rawBody, secret, signatureHeader) {
  if (!signatureHeader) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader));
}

export function buildIdempotencyKey({ source, externalEventId, action, issueId }) {
  const value = `${source}:${externalEventId || 'na'}:${action || 'na'}:${issueId || 'na'}`;
  return crypto.createHash('sha256').update(value).digest('hex');
}
