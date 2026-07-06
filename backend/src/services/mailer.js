const nodemailer = require('nodemailer');
const log = require('../utils/logger').child('mailer');

function getTransport() {
  if (!process.env.SMTP_HOST) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
}

async function sendResetEmail(to, token) {
  const transport = getTransport();
  const base = (process.env.BASE_URL || 'http://localhost:8080').replace(/\/$/, '');
  const link = `${base}/reset-password?token=${token}`;
  if (!transport) {
    // SMTP not configured — log the link so the admin can pass it on manually.
    log.info(`SMTP not configured — password reset link for ${to}: ${link}`);
    return { logged: true, link };
  }
  await transport.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject: 'Reset your Legacy Vault password',
    text: `A password reset was requested for your Legacy Vault account.\n\nReset it here (link valid for 1 hour):\n${link}\n\nIf you didn't ask for this, you can ignore this email.`,
  });
  return { sent: true };
}

module.exports = { sendResetEmail };
