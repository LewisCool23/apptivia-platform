# Email Setup Complete - Quick Reference Guide

## ✅ What's Been Set Up

### 1. **Backend Email Service** 
- ✅ Nodemailer already installed
- ✅ SMTP configuration added to `.env`
- ✅ Three email endpoints created:
  - `/api/send-coaching-plan` - Send coaching plans
  - `/api/send-contest-results` - Send contest results
  - `/api/send-snapshot` - Send achievement snapshots

### 2. **Frontend Email Integration**
- ✅ ShareSnapshotModal updated with email functionality
- ✅ Beautiful HTML email templates included
- ✅ Form validation and error handling

### 3. **Email Service Helper**
- ✅ Created `emailService.js` for reusable email functions
- ✅ Connection verification utility included

---

## 🚀 Next Steps to Complete Setup

### Step 1: Configure SMTP Credentials

Edit `public_html/backend/.env` and replace these values:

```env
SMTP_HOST=smtp.gmail.com          # Your SMTP server
SMTP_PORT=587                     # Usually 587 for TLS or 465 for SSL
SMTP_SECURE=false                 # true for port 465, false for others
SMTP_USER=your-email@gmail.com    # Your email address
SMTP_PASS=your-app-password       # App password (NOT your regular password)
SMTP_FROM="Apptivia Platform <noreply@apptivia.app>"  # From address
```

### Step 2: Get SMTP Credentials

#### **Option A: Gmail (Easiest for Testing)**

1. Go to Google Account: https://myaccount.google.com/
2. Enable 2-Factor Authentication (Security → 2-Step Verification)
3. Create App Password: https://myaccount.google.com/apppasswords
   - Select "Mail" and "Other (Custom name)"
   - Name it "Apptivia Platform"
   - Copy the 16-character password
4. Use these settings:
   ```env
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=your-gmail@gmail.com
   SMTP_PASS=your-16-char-app-password
   ```

#### **Option B: SendGrid (Recommended for Production)**

1. Sign up at https://sendgrid.com/ (Free: 100 emails/day)
2. Create API Key: Settings → API Keys → Create API Key
3. Use these settings:
   ```env
   SMTP_HOST=smtp.sendgrid.net
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=apikey
   SMTP_PASS=your-sendgrid-api-key
   ```

#### **Option C: Other Providers**
- **Mailgun**: mailgun.com (5,000 free emails/month)
- **AWS SES**: Very cheap, $0.10 per 1,000 emails
- **Postmark**: Great deliverability, $15/month for 10,000 emails

### Step 3: Start Your Backend

```bash
cd public_html/backend
npm install  # If not already done
npm start
```

The server should start on http://localhost:3000

### Step 4: Test Email Functionality

1. Start your React app if not running
2. Navigate to a Profile page with achievements
3. Click "Share Snapshot" button
4. Click "Email Snapshot" (green button)
5. Enter test email addresses (comma-separated)
6. Click "Send Email"

---

## 🧪 Testing Checklist

- [ ] Backend running on port 3000
- [ ] SMTP credentials configured in `.env`
- [ ] Test email sent successfully
- [ ] Email received with proper formatting
- [ ] HTML rendering correctly in email client
- [ ] Links in email work properly

---

## 🔧 Troubleshooting

### "Email service is not configured"
- Check that all SMTP_* variables are set in `.env`
- Restart your backend server after changing `.env`

### "Failed to send email"
- Verify SMTP credentials are correct
- Check if your email provider requires app passwords
- For Gmail: Enable "Less secure app access" or use App Password
- Check backend console logs for detailed error messages

### Emails go to spam
- Use a verified sender domain
- Add SPF and DKIM records (for production)
- Consider using a dedicated email service like SendGrid

### Gmail "Less secure apps" blocked
- Use App Passwords instead (requires 2FA)
- Or switch to SendGrid/Mailgun for production

---

## 📧 Email Endpoints Reference

### POST `/api/send-snapshot`
Send achievement snapshot email (HTML formatted)

```javascript
{
  "recipients": ["email1@example.com", "email2@example.com"],
  "subject": "Achievement Snapshot",
  "html": "<html>...</html>",
  "text": "Plain text version"
}
```

### POST `/api/send-coaching-plan`
Send coaching plan email

```javascript
{
  "recipients": ["coach@example.com"],
  "subject": "New Coaching Plan",
  "body": "Plain text content"
}
```

### POST `/api/send-contest-results`
Send contest results email

```javascript
{
  "recipients": ["participant@example.com"],
  "subject": "Contest Results",
  "body": "Plain text content"
}
```

---

## 🎨 Customizing Email Templates

Email templates are defined in the frontend components. To customize:

1. Open `src/components/ShareSnapshotModal.jsx`
2. Find the `handleSendEmail` function
3. Modify the `html` variable with your custom HTML
4. Update the `text` variable for plain text version

Example customization areas:
- Colors and styling in `<style>` tag
- Layout structure in HTML
- Add company logo/branding
- Include additional stats or information

---

## 🔐 Security Best Practices

1. **Never commit `.env` file to Git**
   - Already in `.gitignore`
   - Use `.env.example` for templates

2. **Use App Passwords**
   - Don't use your actual email password
   - Generate app-specific passwords

3. **Rate Limiting** (Future Enhancement)
   - Consider adding rate limiting to prevent spam
   - Use express-rate-limit middleware

4. **Email Validation**
   - Add email format validation on backend
   - Sanitize email content to prevent injection

---

## 🚀 Production Deployment

When deploying to production:

1. **Use Environment Variables**
   - Set SMTP_* variables in your hosting platform
   - Vercel: Settings → Environment Variables
   - Heroku: `heroku config:set SMTP_HOST=...`

2. **Use Dedicated Email Service**
   - Don't use personal Gmail in production
   - Use SendGrid, Mailgun, or AWS SES

3. **Monitor Email Delivery**
   - Set up email delivery tracking
   - Monitor bounce rates and spam reports

4. **Add Email Queue** (Optional)
   - For high volume, use a queue (Bull, BullMQ)
   - Prevents blocking API requests

---

## 📝 Additional Features You Can Add

1. **Email Attachments**
   - Attach snapshot as PNG image
   - Include PDF reports

2. **Email Templates**
   - Create template library
   - Use template engines (Handlebars, EJS)

3. **Scheduled Emails**
   - Weekly achievement summaries
   - Reminder emails

4. **Email Analytics**
   - Track open rates
   - Click tracking on links

5. **Batch Sending**
   - Send to multiple users efficiently
   - Personalized content for each recipient

---

## 🆘 Need Help?

Common issues and solutions are documented above. The backend already has detailed console logging that will help you debug any issues.

Test the email configuration first with a simple test before using it in production!
