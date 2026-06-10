const nodemailer = require('nodemailer');
const { getDatabase } = require('../database');
const twilio = require('twilio');

const sendEmail = async (to, subject, text, html) => {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) return false;
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD
    }
  });

  const info = await transporter.sendMail({
    from: process.env.SMTP_USER,
    to,
    subject,
    text,
    html
  });
  return info;
};

const sendSms = async (to, message) => {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) return false;
  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  const from = process.env.TWILIO_PHONE_NUMBER;
  const msg = await client.messages.create({ body: message, from, to });
  return msg;
};

const createInAppNotification = async (userId, type, title, message, referenceId = null) => {
  const db = getDatabase();
  await db.run(
    `INSERT INTO notifications (user_id, type, title, message, reference_id) VALUES (?, ?, ?, ?, ?)`,
    [userId, type, title, message, referenceId]
  );
};

const notifyUser = async ({ userId, email, phone, type, title, message, referenceId }) => {
  try {
    // create in-app notification
    if (userId) await createInAppNotification(userId, type, title, message, referenceId);

    // send email if configured and email provided
    if (email) {
      await sendEmail(email, title, message, `<p>${message}</p>`).catch(() => null);
    }

    // send SMS if configured and phone provided
    if (phone) {
      await sendSms(phone, message).catch(() => null);
    }
  } catch (err) {
    // swallow errors to avoid blocking main flow
    console.error('Notification error', err.message);
  }
};

module.exports = {
  notifyUser,
  sendEmail,
  sendSms,
  createInAppNotification
};
