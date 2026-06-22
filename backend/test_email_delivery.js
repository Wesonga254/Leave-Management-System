require('dotenv').config();
const nodemailer = require('nodemailer');

(async () => {
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD
    },
    pool: true,
    tls: { rejectUnauthorized: false }
  });

  const fromAddress = process.env.SMTP_USER;
  const testTo = process.env.SMTP_USER; // Send to self first

  console.log('Sending with anti-spam headers to:', testTo);

  try {
    const info = await transporter.sendMail({
      from: `"County Government of Busia" <${fromAddress}>`,
      to: testTo,
      subject: 'Leave Application Update - ' + new Date().toLocaleDateString(),
      text: 'Dear Staff,\n\nThis is a notification from the Busia County Leave Management System.\n\nYour leave application has been received and is being processed.\n\nRegards,\nHR Department\nCounty Government of Busia',
      html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
        <div style="background:#1B7340;padding:20px;text-align:center;border-radius:8px 8px 0 0">
          <h2 style="color:white;margin:0">County Government of Busia</h2>
          <p style="color:rgba(255,255,255,0.8);margin:4px 0 0;font-size:13px">Leave Management System</p>
        </div>
        <div style="padding:24px;border:1px solid #e2e8f0;border-top:0;border-radius:0 0 8px 8px">
          <p>Dear Staff,</p>
          <p>This is a notification from the Busia County Leave Management System.</p>
          <p>Your leave application has been received and is being processed.</p>
          <br>
          <p>Regards,<br><strong>HR Department</strong><br>County Government of Busia</p>
        </div>
        <p style="text-align:center;color:#94a3b8;font-size:11px;margin-top:16px">
          County Government of Busia | Leave Management System<br>
          You received this email because you have an account in the system.
        </p>
      </div>`,
      replyTo: fromAddress,
      headers: {
        'X-Mailer': 'Busia-County-LMS',
        'X-Priority': '3',
        'Precedence': 'bulk',
        'X-Auto-Response-Suppress': 'All',
        'List-Unsubscribe': '<mailto:' + fromAddress + '?subject=Unsubscribe>'
      },
      envelope: {
        from: fromAddress,
        to: testTo
      }
    });

    console.log('\nSent successfully!');
    console.log('MessageId:', info.messageId);
    console.log('Response:', info.response);
    console.log('\n>>> Check inbox AND spam folder for:', testTo);
  } catch (e) {
    console.error('FAILED:', e.message);
  }

  transporter.close();
})();
