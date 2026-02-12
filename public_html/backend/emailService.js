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
async function sendEmail({ recipients, subject, text, html }) {
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

  return await transporter.sendMail(mailOptions);
}

/**
 * Verify SMTP connection
 * @returns {Promise<boolean>} True if connection is successful
 */
async function verifyConnection() {
  try {
    const transporter = createTransporter();
    await transporter.verify();
    return true;
  } catch (error) {
    console.error('Email service verification failed:', error);
    return false;
  }
}

module.exports = {
  createTransporter,
  sendEmail,
  verifyConnection,
};
