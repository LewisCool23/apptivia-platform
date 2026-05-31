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

// ── Apptivia branded email wrapper ─────────────────────────────────
function brandedHtml(bodyContent) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F7F5F2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F7F5F2;padding:32px 0">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06)">
<tr><td style="background:#0A0A0B;padding:24px 32px;text-align:center">
  <span style="font-size:22px;font-weight:800;color:#FF4D2E;letter-spacing:-0.5px">Apptivia</span>
</td></tr>
<tr><td style="padding:32px">${bodyContent}</td></tr>
<tr><td style="padding:16px 32px;background:#F7F5F2;text-align:center;border-top:1px solid #eee">
  <span style="font-size:11px;color:#999">© ${new Date().getFullYear()} Apptivia — Sales Performance Intelligence</span>
</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

/**
 * Send welcome email to new trial user
 * @param {Object} user - { email, first_name }
 * @param {Object} organization - { name }
 */
async function sendWelcomeEmail(user, organization) {
  const name = user.first_name || 'there';
  const orgName = organization?.name || 'your team';
  const body = `
<h2 style="color:#0A0A0B;margin:0 0 16px">Welcome to Apptivia, ${name}! 👋</h2>
<p style="color:#444;font-size:14px;line-height:1.6;margin:0 0 20px">
  You've taken the first step toward transforming ${orgName}'s sales performance. Here's what you can do right away:
</p>
<ul style="padding:0 0 0 20px;margin:0 0 24px;color:#444;font-size:14px;line-height:2">
  <li><strong>Set up your Scorecard</strong> — Track the KPIs that matter most to your team</li>
  <li><strong>Discover prospects</strong> — AI-powered company & contact research in Engage</li>
  <li><strong>Meet Aaron</strong> — Your AI sales coach, available 24/7 in the bottom-right corner</li>
</ul>
<div style="text-align:center;margin:28px 0">
  <a href="https://apptivia.app/onboarding" style="display:inline-block;padding:14px 32px;background:#FF4D2E;color:#fff;text-decoration:none;border-radius:8px;font-weight:700;font-size:15px">Complete Your Setup</a>
</div>
<p style="color:#888;font-size:12px;margin:20px 0 0;text-align:center">Your trial is active — explore everything Apptivia has to offer.</p>`;

  return sendEmail({
    recipients: [user.email],
    subject: `Welcome to Apptivia, ${name}! 🚀`,
    html: brandedHtml(body),
    text: `Welcome to Apptivia, ${name}! Set up your Scorecard, Discover prospects, and meet Aaron — your AI sales coach. Complete your setup: https://apptivia.app/onboarding`,
  });
}

// ── Onboarding drip email templates ───────────────────────────────
const ONBOARDING_EMAILS = {
  nudge_start: {
    subject: (name) => `${name}, let's get you set up`,
    body: (name) => `
<h2 style="color:#0A0A0B;margin:0 0 16px">Ready to get started, ${name}?</h2>
<p style="color:#444;font-size:14px;line-height:1.6">You signed up yesterday but haven't started onboarding yet. It only takes 5 minutes to set up your first Scorecard.</p>
<div style="text-align:center;margin:24px 0">
  <a href="https://apptivia.app/onboarding" style="display:inline-block;padding:12px 28px;background:#FF4D2E;color:#fff;text-decoration:none;border-radius:8px;font-weight:700;font-size:14px">Start Onboarding</a>
</div>`,
  },
  nudge_complete: {
    subject: (name) => `${name}, you're almost there`,
    body: (name) => `
<h2 style="color:#0A0A0B;margin:0 0 16px">You're so close, ${name}!</h2>
<p style="color:#444;font-size:14px;line-height:1.6">You started setting up but didn't finish. Complete the last few steps to unlock your full dashboard.</p>
<div style="text-align:center;margin:24px 0">
  <a href="https://apptivia.app/onboarding" style="display:inline-block;padding:12px 28px;background:#FF4D2E;color:#fff;text-decoration:none;border-radius:8px;font-weight:700;font-size:14px">Finish Setup</a>
</div>`,
  },
  nudge_first_action: {
    subject: (name) => `${name}, try your first research`,
    body: (name) => `
<h2 style="color:#0A0A0B;margin:0 0 16px">Time to explore, ${name}!</h2>
<p style="color:#444;font-size:14px;line-height:1.6">Your account is set up — now try researching a target company in Engage Discover. Just enter a domain and watch the AI go to work.</p>
<div style="text-align:center;margin:24px 0">
  <a href="https://apptivia.app/engage" style="display:inline-block;padding:12px 28px;background:#FF4D2E;color:#fff;text-decoration:none;border-radius:8px;font-weight:700;font-size:14px">Try Discover</a>
</div>`,
  },
  feature_highlight: {
    subject: () => `3 things you might have missed in Apptivia`,
    body: (name) => `
<h2 style="color:#0A0A0B;margin:0 0 16px">Hey ${name}, check these out</h2>
<ul style="padding:0 0 0 20px;margin:0 0 24px;color:#444;font-size:14px;line-height:2">
  <li><strong>Signal Prospecting</strong> — Detect intent signals across your target accounts</li>
  <li><strong>Aaron AI Coach</strong> — Ask about deal strategy, objection handling, or coaching tips</li>
  <li><strong>Wallboard</strong> — Real-time team visibility for your sales floor</li>
</ul>
<div style="text-align:center;margin:24px 0">
  <a href="https://apptivia.app" style="display:inline-block;padding:12px 28px;background:#0A0A0B;color:#fff;text-decoration:none;border-radius:8px;font-weight:700;font-size:14px">Explore Apptivia</a>
</div>`,
  },
  trial_halfway: {
    subject: (name) => `${name}, your trial is halfway through`,
    body: (name) => `
<h2 style="color:#0A0A0B;margin:0 0 16px">Halfway check-in, ${name}</h2>
<p style="color:#444;font-size:14px;line-height:1.6">Your trial is 50% through. Make sure you've tried the features that matter most to your team.</p>
<p style="color:#444;font-size:14px;line-height:1.6">Have questions? Reply to this email — we read every one.</p>
<div style="text-align:center;margin:24px 0">
  <a href="https://apptivia.app" style="display:inline-block;padding:12px 28px;background:#FF4D2E;color:#fff;text-decoration:none;border-radius:8px;font-weight:700;font-size:14px">Continue Exploring</a>
</div>`,
  },
  trial_expiring: {
    subject: (name) => `${name}, your trial expires in 3 days`,
    body: (name) => `
<h2 style="color:#0A0A0B;margin:0 0 16px">Your trial ends soon, ${name}</h2>
<p style="color:#444;font-size:14px;line-height:1.6">You have 3 days left on your Apptivia trial. Upgrade now to keep your data, scorecards, and coaching plans.</p>
<div style="text-align:center;margin:24px 0">
  <a href="https://apptivia.app/org-settings#billing" style="display:inline-block;padding:12px 28px;background:#FF4D2E;color:#fff;text-decoration:none;border-radius:8px;font-weight:700;font-size:14px">Upgrade Now</a>
</div>`,
  },
  trial_expired: {
    subject: (name) => `${name}, your Apptivia trial has ended`,
    body: (name) => `
<h2 style="color:#0A0A0B;margin:0 0 16px">Your trial has ended, ${name}</h2>
<p style="color:#444;font-size:14px;line-height:1.6">Your Apptivia trial has expired, but your data is still safe. Upgrade to pick up right where you left off.</p>
<div style="text-align:center;margin:24px 0">
  <a href="https://apptivia.app/org-settings#billing" style="display:inline-block;padding:12px 28px;background:#0A0A0B;color:#fff;text-decoration:none;border-radius:8px;font-weight:700;font-size:14px">Reactivate Account</a>
</div>`,
  },
};

/**
 * Send an onboarding drip email
 * @param {string} emailType - One of ONBOARDING_EMAILS keys
 * @param {Object} user - { email, first_name }
 */
async function sendOnboardingEmail(emailType, user) {
  const template = ONBOARDING_EMAILS[emailType];
  if (!template) throw new Error(`Unknown email type: ${emailType}`);

  const name = user.first_name || 'there';
  return sendEmail({
    recipients: [user.email],
    subject: template.subject(name),
    html: brandedHtml(template.body(name)),
    text: `Visit https://apptivia.app to continue`,
  });
}

module.exports = {
  createTransporter,
  sendEmail,
  verifyConnection,
  brandedHtml,
  sendWelcomeEmail,
  sendOnboardingEmail,
  ONBOARDING_EMAILS,
};
