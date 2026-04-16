/**
 * Email Service Helper
 * Reusable email utilities for the Apptivia backend
 */

const nodemailer = require('nodemailer');

/**
 * Create a transporter instance with SMTP configuration
 * @returns {Object} Nodemailer transporter
 */
function createTransporter() {
  const {
    SMTP_HOST,
    SMTP_PORT,
    SMTP_USER,
    SMTP_PASS,
    SMTP_SECURE,
  } = process.env;

  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    throw new Error('Email service is not configured. Please set SMTP environment variables.');
  }

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: String(SMTP_SECURE).toLowerCase() === 'true',
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
}

/**
 * Send an email
 * @param {Object} options - Email options
 * @param {string[]} options.recipients - Array of recipient email addresses
 * @param {string} options.subject - Email subject
 * @param {string} options.text - Plain text content
 * @param {string} options.html - HTML content (optional)
 * @returns {Promise<Object>} Send result
 */
async function sendEmail({ recipients, subject, text, html, attachments }) {
  const transporter = createTransporter();
  const SMTP_FROM = process.env.SMTP_FROM || 'noreply@apptivia.app';

  const mailOptions = {
    from: SMTP_FROM,
    to: recipients.join(', '),
    subject,
  };

  if (html) {
    mailOptions.html = html;
    if (text) mailOptions.text = text;
  } else {
    mailOptions.text = text;
  }

  if (attachments && attachments.length > 0) {
    mailOptions.attachments = attachments;
  }

  return await transporter.sendMail(mailOptions);
}

/**
 * Verify SMTP connection with retry logic for transient errors (e.g. STARTTLS 454)
 * @param {number} retries - Number of retry attempts (default 3)
 * @returns {Promise<boolean>} True if connection is successful
 */
async function verifyConnection(retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const transporter = createTransporter();
      await transporter.verify();
      return true;
    } catch (error) {
      const isTransient = error.responseCode >= 400 && error.responseCode < 500;
      if (isTransient && attempt < retries) {
        const delay = attempt * 5000; // 5s, 10s, 15s
        console.log(`SMTP verify attempt ${attempt}/${retries} got ${error.responseCode} — retrying in ${delay / 1000}s`);
        await new Promise(r => setTimeout(r, delay));
      } else if (attempt === retries) {
        console.warn(`SMTP verification failed after ${retries} attempts: ${error.code || error.responseCode || ''} ${error.response || error.message}`);
        return false;
      }
    }
  }
  return false;
}

module.exports = {
  createTransporter,
  sendEmail,
  verifyConnection,
};
