/**
 * Email Diagnostic Script
 * Tests SMTP connection and sends a test email
 */
require('dotenv').config();
const nodemailer = require('nodemailer');

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = process.env.SMTP_PORT || 587;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASSWORD = process.env.SMTP_PASSWORD;
const SMTP_FROM_NAME = process.env.SMTP_FROM_NAME || 'Leave Management System';

console.log('=== EMAIL DIAGNOSTIC ===\n');
console.log('SMTP Configuration:');
console.log(`  Host:     ${SMTP_HOST || '(NOT SET)'}`);
console.log(`  Port:     ${SMTP_PORT}`);
console.log(`  User:     ${SMTP_USER || '(NOT SET)'}`);
console.log(`  Password: ${SMTP_PASSWORD ? SMTP_PASSWORD.substring(0, 4) + '****' : '(NOT SET)'}`);
console.log(`  From:     "${SMTP_FROM_NAME}" <${SMTP_USER}>`);
console.log('');

// Check for placeholder values
if (!SMTP_HOST || !SMTP_USER || !SMTP_PASSWORD) {
  console.error('❌ SMTP credentials are missing in .env');
  process.exit(1);
}
if (SMTP_USER === 'your_email@gmail.com' || SMTP_PASSWORD === 'your_password') {
  console.error('❌ SMTP credentials are still set to placeholder values');
  process.exit(1);
}

console.log('✓ SMTP credentials look configured\n');

// Create transporter
const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: Number(SMTP_PORT),
  secure: false,  // STARTTLS on port 587
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASSWORD
  },
  // Extra debug logging
  logger: true,
  debug: true
});

(async () => {
  // Step 1: Verify SMTP connection
  console.log('--- Step 1: Verifying SMTP connection ---');
  try {
    await transporter.verify();
    console.log('✓ SMTP connection verified successfully!\n');
  } catch (err) {
    console.error('❌ SMTP connection FAILED:', err.message);
    console.error('');
    if (err.message.includes('Invalid login') || err.code === 'EAUTH') {
      console.error('DIAGNOSIS: Authentication failed.');
      console.error('  - If using Gmail, you need a 16-char App Password, NOT your regular password.');
      console.error('  - Go to https://myaccount.google.com/apppasswords to generate one.');
      console.error('  - Make sure 2-Step Verification is ON first.');
      console.error(`  - Current password starts with: "${SMTP_PASSWORD.substring(0, 4)}..." (${SMTP_PASSWORD.length} chars)`);
      if (SMTP_PASSWORD.length !== 16 || SMTP_PASSWORD.includes(' ')) {
        console.error(`  ⚠ Gmail App Passwords are exactly 16 lowercase letters with no spaces.`);
        console.error(`    Your password is ${SMTP_PASSWORD.length} chars — this may be wrong.`);
      }
    } else if (err.message.includes('ECONNREFUSED') || err.message.includes('ENOTFOUND')) {
      console.error('DIAGNOSIS: Cannot reach the SMTP server.');
      console.error(`  - Verify SMTP_HOST="${SMTP_HOST}" is correct.`);
      console.error(`  - Verify port ${SMTP_PORT} is not blocked by firewall.`);
    } else if (err.message.includes('ETIMEDOUT')) {
      console.error('DIAGNOSIS: Connection timed out.');
      console.error('  - Port 587 may be blocked by your network/ISP/firewall.');
      console.error('  - Try port 465 with secure: true.');
    }
    process.exit(1);
  }

  // Step 2: Send a test email (to yourself)
  console.log('--- Step 2: Sending test email ---');
  const testTo = SMTP_USER; // send to yourself
  try {
    const info = await transporter.sendMail({
      from: `"${SMTP_FROM_NAME}" <${SMTP_USER}>`,
      to: testTo,
      subject: '🧪 Leave Management System — Email Test',
      text: 'If you can read this, SMTP email is working correctly.',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:24px;background:#f0fdf4;border:2px solid #22c55e;border-radius:12px">
          <h2 style="color:#065f46;margin:0 0 12px">✓ Email Works!</h2>
          <p style="color:#334155;margin:0 0 8px">If you can see this, the SMTP email system is configured correctly.</p>
          <p style="color:#94a3b8;font-size:12px;margin:0">Sent at: ${new Date().toISOString()}</p>
        </div>`
    });
    console.log(`✓ Test email sent successfully!`);
    console.log(`  To:        ${testTo}`);
    console.log(`  MessageId: ${info.messageId}`);
    console.log(`  Response:  ${info.response}`);
    console.log('');
    console.log('✅ Check your inbox (and spam folder) for the test email.');
  } catch (err) {
    console.error('❌ Failed to send test email:', err.message);
    console.error('Full error:', err);
    process.exit(1);
  }

  process.exit(0);
})();
