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
    logger: true,   // enable full SMTP debug logging
    debug: true      // show SMTP protocol exchange
  });

  console.log('=== EMAIL DIAGNOSTIC ===');
  console.log('SMTP_USER:', process.env.SMTP_USER);
  console.log('SMTP_HOST:', process.env.SMTP_HOST);

  try {
    const verified = await transporter.verify();
    console.log('\n[1] SMTP Connection: OK');
  } catch (e) {
    console.error('\n[1] SMTP Connection FAILED:', e.message);
    process.exit(1);
  }

  try {
    // Send to SELF to test delivery
    const info = await transporter.sendMail({
      from: '"Busia County LMS" <' + process.env.SMTP_USER + '>',
      to: process.env.SMTP_USER,  // send to yourself
      subject: 'Email Delivery Test - ' + new Date().toLocaleTimeString(),
      text: 'If you receive this, email delivery works!',
      html: '<div style="padding:20px;font-family:Arial"><h2 style="color:#1B7340">Email Delivery Test</h2><p>If you see this in your inbox (not spam), delivery is working correctly.</p><p><strong>Time:</strong> ' + new Date().toISOString() + '</p></div>'
    });

    console.log('\n[2] Email sent successfully!');
    console.log('    MessageId:', info.messageId);
    console.log('    Response:', info.response);
    console.log('    Accepted:', info.accepted);
    console.log('    Rejected:', info.rejected);
    console.log('\n>>> CHECK YOUR INBOX (and spam/junk folder) for: ' + process.env.SMTP_USER);
  } catch (e) {
    console.error('\n[2] Send FAILED:', e.message);
    console.error('    Full error:', e);
  }

  transporter.close();
})();
