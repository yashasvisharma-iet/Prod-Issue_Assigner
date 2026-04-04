import crypto from 'crypto';

function safeCompare(a, b) {
  const aBuf = Buffer.from(a || '', 'utf8');
  const bBuf = Buffer.from(b || '', 'utf8');
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

export function verifyGitHubSignature(rawBody, secret, signatureHeader) {
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) return false;
  const expected = `sha256=${crypto.createHmac('sha256', secret).update(rawBody).digest('hex')}`;
  return safeCompare(expected, signatureHeader);
}

export function verifyJiraSignature(rawBody, secret, signatureHeader) {
  if (!signatureHeader) return false;

  const normalizedHeader = String(signatureHeader).startsWith('sha256=')
    ? String(signatureHeader)
    : `sha256=${signatureHeader}`;

  const expected = `sha256=${crypto.createHmac('sha256', secret).update(rawBody).digest('hex')}`;
  return safeCompare(expected, normalizedHeader);
}

export function buildIdempotencyKey({ source, externalEventId, action, issueId }) {
  const value = `${source}:${externalEventId || 'na'}:${action || 'na'}:${issueId || 'na'}`;
  return crypto.createHash('sha256').update(value).digest('hex');
}
