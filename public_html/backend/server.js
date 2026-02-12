require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const nodemailer = require('nodemailer');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = socketIo(server);

// Example route
app.get('/', (req, res) => {
  res.send('Apptivia Backend Running');
});

app.post('/api/send-coaching-plan', async (req, res) => {
  try {
    const { recipients, subject, body } = req.body || {};
    if (!Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).send('Recipients are required.');
    }
    if (!subject || !body) {
      return res.status(400).send('Subject and body are required.');
    }

    const {
      SMTP_HOST,
      SMTP_PORT,
      SMTP_USER,
      SMTP_PASS,
      SMTP_SECURE,
      SMTP_FROM
    } = process.env;

    if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS || !SMTP_FROM) {
      return res.status(500).send('Email service is not configured.');
    }

    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT),
      secure: String(SMTP_SECURE).toLowerCase() === 'true',
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: SMTP_FROM,
      to: recipients.join(', '),
      subject,
      text: body,
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error('Email send failed', err);
    return res.status(500).send('Failed to send coaching plan email.');
  }
});

app.post('/api/send-contest-results', async (req, res) => {
  try {
    const { recipients, subject, body } = req.body || {};
    if (!Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).send('Recipients are required.');
    }
    if (!subject || !body) {
      return res.status(400).send('Subject and body are required.');
    }

    const {
      SMTP_HOST,
      SMTP_PORT,
      SMTP_USER,
      SMTP_PASS,
      SMTP_SECURE,
      SMTP_FROM
    } = process.env;

    if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS || !SMTP_FROM) {
      return res.status(500).send('Email service is not configured.');
    }

    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT),
      secure: String(SMTP_SECURE).toLowerCase() === 'true',
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: SMTP_FROM,
      to: recipients.join(', '),
      subject,
      text: body,
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error('Contest results email failed', err);
    return res.status(500).send('Failed to send contest results email.');
  }
});

app.post('/api/send-snapshot', async (req, res) => {
  try {
    const { recipients, subject, html, text } = req.body || {};
    if (!Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).send('Recipients are required.');
    }
    if (!subject || (!html && !text)) {
      return res.status(400).send('Subject and content are required.');
    }

    const {
      SMTP_HOST,
      SMTP_PORT,
      SMTP_USER,
      SMTP_PASS,
      SMTP_SECURE,
      SMTP_FROM
    } = process.env;

    if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS || !SMTP_FROM) {
      return res.status(500).send('Email service is not configured.');
    }

    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT),
      secure: String(SMTP_SECURE).toLowerCase() === 'true',
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });

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

    await transporter.sendMail(mailOptions);

    return res.json({ ok: true });
  } catch (err) {
    console.error('Snapshot email failed', err);
    return res.status(500).send('Failed to send snapshot email.');
  }
});

// Example socket.io connection
io.on('connection', (socket) => {
  console.log('New client connected');
  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
