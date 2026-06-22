/**
 * Test sending to an EXTERNAL email address (not the sender's own)
 * Pass the recipient email as a command-line argument:
 *   node test_external_email.js someone@example.com
 */
require('dotenv').config();
const nodemailer = require('nodemailer');

const recipientEmail = process.argv[2];

if (!recipientEmail) {
  console.error('Usage: node test_external_email.js recipient@example.com');
  process.exit(1);
}

console.log('=== EXTERNAL EMAIL TEST ===\n');
console.log(`From:  ${process.env.SMTP_USER}`);
console.log(`To:    ${recipientEmail}`);
console.log('');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD
  },
  logger: true,
  debug: true
});

(async () => {
  try {
    // Step 1: verify connection
    await transporter.verify();
    console.log('\n✓ SMTP connection OK\n');

    // Step 2: send email to the external address
    const info = await transporter.sendMail({
      from: `"Leave Management System" <${process.env.SMTP_USER}>`,
      to: recipientEmail,
      subject: 'Test — Leave Management System Credentials',
      text: `Hello,\n\nThis is a test email from the Leave Management System.\nTemporary password: TestPass123!\n\nIf you received this, email delivery to ${recipientEmail} is working.`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0">
          <div style="background:linear-gradient(135deg,#0f172a,#1e293b);padding:28px 32px;text-align:center">
            <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700">Leave Management System</h1>
          </div>
          <div style="padding:32px">
            <p style="color:#0f172a;font-size:16px;margin:0 0 18px">Hello,</p>
            <p style="color:#334155;font-size:14px;line-height:1.6;margin:0 0 20px">This is a test email. If you can see this, email delivery to <strong>${recipientEmail}</strong> is working correctly.</p>
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid #0f766e;border-radius:8px;padding:18px;margin:0 0 24px">
              <p style="margin:0 0 8px;color:#0f172a;font-size:14px"><strong>Login ID:</strong> National ID: 12345678</p>
              <p style="margin:0;color:#0f172a;font-size:14px"><strong>Temporary Password:</strong> TestPass123!</p>
            </div>
          </div>
          <div style="background:#f8fafc;padding:16px 32px;text-align:center;border-top:1px solid #e2e8f0">
            <p style="margin:0;color:#94a3b8;font-size:12px">Automated test from Leave Management System.</p>
          </div>
        </div>`
    });

    console.log(`\n✓ Email sent successfully!`);
    console.log(`  MessageId:  ${info.messageId}`);
    console.log(`  Response:   ${info.response}`);
    console.log(`  Accepted:   ${JSON.stringify(info.accepted)}`);
    console.log(`  Rejected:   ${JSON.stringify(info.rejected)}`);
    console.log(`  Pending:    ${JSON.stringify(info.pending)}`);
    console.log('');

    if (info.rejected && info.rejected.length > 0) {
      console.error('⚠ Gmail ACCEPTED the send request but REJECTED the recipient!');
      console.error('  This usually means the recipient address is invalid.');
    } else {
      console.log('✅ Gmail accepted delivery. If it still does not arrive:');
      console.log('   1. Check the recipient\'s SPAM / JUNK folder');
      console.log('   2. The recipient\'s mail server may be blocking Gmail');
      console.log('   3. Some enterprise mail servers silently drop external emails');
    }
  } catch (err) {
    console.error(`\n❌ FAILED: ${err.message}`);
    if (err.responseCode) {
      console.error(`  SMTP Response Code: ${err.responseCode}`);
      console.error(`  SMTP Response:      ${err.response}`);
    }
  }
  process.exit(0);
})();
