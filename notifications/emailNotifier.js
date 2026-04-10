'use strict';

let createTransport;

class EmailNotifier {
  constructor({ logger = console, transport, fromAddress } = {}) {
    this.logger = logger;
    this.transport = transport || buildTransportFromEnv({ logger });
    this.fromAddress = fromAddress || process.env.EMAIL_FROM;
  }

  isEnabled() {
    return Boolean(this.transport && this.fromAddress);
  }

  async sendIssueAssigned({ issue, developer }) {
    if (!this.isEnabled()) {
      return {
        sent: false,
        reason: 'not_configured',
      };
    }

    const to = developer?.email;
    if (!to) {
      return {
        sent: false,
        reason: 'missing_recipient_email',
      };
    }

    const issueId = issue?.id || issue?.issueId || 'unknown';
    const issueTitle = issue?.title || 'Untitled issue';
    const assigneeName = developer?.name || 'Developer';

    const text = [
      '🚀 New Issue Assigned',
      `Issue: #${issueId}`,
      `Title: ${issueTitle}`,
      `Assigned to: ${assigneeName}`,
    ].join('\n');

    const html = [
      '<h2>🚀 New Issue Assigned</h2>',
      `<p><strong>Issue:</strong> #${escapeHtml(String(issueId))}</p>`,
      `<p><strong>Title:</strong> ${escapeHtml(issueTitle)}</p>`,
      `<p><strong>Assigned to:</strong> ${escapeHtml(assigneeName)}</p>`,
    ].join('');

    await this.transport.sendMail({
      from: this.fromAddress,
      to,
      subject: `🚀 New Issue Assigned #${issueId}`,
      text,
      html,
    });

    return {
      sent: true,
      to,
      issueId,
    };
  }
}

function buildTransportFromEnv({ logger = console } = {}) {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !port || !user || !pass) {
    logger.warn('Email notifier disabled. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and EMAIL_FROM.');
    return null;
  }

  createTransport = createTransport || requireNodemailer(logger).createTransport;

  return createTransport({
    host,
    port,
    secure: String(process.env.SMTP_SECURE || '').toLowerCase() === 'true',
    auth: {
      user,
      pass,
    },
  });
}

function requireNodemailer(logger) {
  try {
    return require('nodemailer');
  } catch (error) {
    logger.warn('nodemailer is not installed. Email notifier is disabled.', { error: error.message });
    return {
      createTransport: () => null,
    };
  }
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

module.exports = {
  EmailNotifier,
};
