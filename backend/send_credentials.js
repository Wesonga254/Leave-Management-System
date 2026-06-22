require('dotenv').config();
const nodemailer = require('nodemailer');

(async () => {
  const t = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
  });

  const to = 'oumaelba7@gmail.com';
  const subject = 'Your Login Credentials - Busia County Leave Management System';

  const text = `Hello Elba,

Your account on the Busia County Leave Management System is ready.

Login Credentials:
- National ID: 40882153
- Employee ID: HR001
- Password: Use the password set during registration

Login at: http://localhost:3000/login

Regards,
HR Department
County Government of Busia`;

  const html = `
<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto">
  <div style="background:#1B7340;padding:20px;text-align:center;border-radius:8px 8px 0 0">
    <h2 style="color:white;margin:0">County Government of Busia</h2>
    <p style="color:rgba(255,255,255,0.8);margin:4px 0 0;font-size:13px">Leave Management System</p>
  </div>
  <div style="padding:24px;border:1px solid #e2e8f0;border-top:0;border-radius:0 0 8px 8px">
    <p style="color:#0f172a;font-size:16px">Hello <strong>Elba</strong>,</p>
    <p style="color:#334155;font-size:14px;line-height:1.6">Your account has been created successfully. Use the credentials below to log in.</p>
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid #1B7340;border-radius:8px;padding:18px;margin:20px 0">
      <p style="margin:0 0 8px;color:#0f172a;font-size:14px"><strong>National ID:</strong> 40882153</p>
      <p style="margin:0 0 8px;color:#0f172a;font-size:14px"><strong>Employee ID:</strong> HR001</p>
      <p style="margin:0;color:#0f172a;font-size:14px"><strong>Password:</strong> As set during registration</p>
    </div>
    <p style="color:#334155;font-size:14px">Login at: <a href="http://localhost:3000/login">http://localhost:3000/login</a></p>
    <br>
    <p>Regards,<br><strong>HR Department</strong><br>County Government of Busia</p>
  </div>
</div>`;

  try {
    const info = await t.sendMail({ from: `"County Government of Busia" <${process.env.SMTP_USER}>`, to, subject, text, html });
    console.log('✅ Email sent to:', to);
    console.log('   Response:', info.response);
    console.log('   Accepted:', info.accepted);
    console.log('   Rejected:', info.rejected);
    console.log('\n>>> Ask Elba Ouma to check inbox AND spam/junk folder at oumaelba7@gmail.com');
  } catch (e) {
    console.error('❌ Failed:', e.message);
  }
  t.close();
})();
