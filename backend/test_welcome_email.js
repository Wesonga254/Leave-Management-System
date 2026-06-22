/**
 * Test: Simulate what happens when admin creates a user
 * This calls the exact same sendEmail function used in production
 */
require('dotenv').config();
const { sendEmail } = require('./src/utils/notifications');

const testEmail = process.env.SMTP_USER; // send to yourself
const firstName = 'TestUser';
const nationalId = '12345678';
const employeeId = 'EMP-TEST-001';
const plainPassword = 'Lv' + require('crypto').randomBytes(4).toString('hex') + 'A1!';
const loginUrl = (process.env.FRONTEND_URL || 'http://localhost:3000') + '/login';
const loginHint = `National ID: ${nationalId} or Employee ID: ${employeeId}`;

const title = 'Welcome to Leave Management System';
const message = `Hello ${firstName},\n\nYour account has been created successfully.\n\n${loginHint}\nTemporary password: ${plainPassword}\n\nLogin here: ${loginUrl}`;

const html = `
<div style="font-family:'Inter',Arial,sans-serif;max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0">
  <div style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);padding:28px 32px;text-align:center">
    <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700">Leave Management System</h1>
  </div>
  <div style="padding:32px">
    <p style="color:#0f172a;font-size:16px;margin:0 0 18px">Hello <strong>${firstName}</strong>,</p>
    <p style="color:#334155;font-size:14px;line-height:1.6;margin:0 0 20px">Your account has been created successfully. Use the credentials below to log in.</p>
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid #0f766e;border-radius:8px;padding:18px;margin:0 0 24px">
      <p style="margin:0 0 8px;color:#0f172a;font-size:14px"><strong>Login ID:</strong> ${loginHint}</p>
      <p style="margin:0;color:#0f172a;font-size:14px"><strong>Temporary Password:</strong> ${plainPassword}</p>
    </div>
    <div style="text-align:center;margin:0 0 24px">
      <a href="${loginUrl}" style="display:inline-block;background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);color:#ffffff;padding:14px 36px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px">Login to Your Account</a>
    </div>
    <p style="color:#64748b;font-size:13px;text-align:center;margin:0">Please change your password after your first login.</p>
  </div>
  <div style="background:#f8fafc;padding:16px 32px;text-align:center;border-top:1px solid #e2e8f0">
    <p style="margin:0;color:#94a3b8;font-size:12px">This is an automated message from the Leave Management System.</p>
  </div>
</div>`;

console.log('=== WELCOME EMAIL TEST ===');
console.log(`Sending to: ${testEmail}`);
console.log(`Generated password: ${plainPassword}`);
console.log('');

(async () => {
  try {
    const result = await sendEmail(testEmail, title, message, html);
    if (result) {
      console.log(`✓ Email sent successfully!`);
      console.log(`  MessageId: ${result.messageId}`);
      console.log(`  Response:  ${result.response}`);
      console.log('');
      console.log('Check your inbox (and spam folder).');
    } else {
      console.error('❌ sendEmail returned falsy — SMTP likely not configured.');
    }
  } catch (err) {
    console.error('❌ sendEmail threw:', err.message);
  }
  process.exit(0);
})();
