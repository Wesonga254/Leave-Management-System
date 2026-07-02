const nodemailer = require('nodemailer');
const { getDatabase } = require('../database');
const twilio = require('twilio');

let _transporter = null;

const getTransporter = () => {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
    return null;
  }
  if (process.env.SMTP_USER === 'your_email@gmail.com' || process.env.SMTP_PASSWORD === 'your_password') {
    return null;
  }
  if (!_transporter) {
    _transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD
      }
    });
  }
  return _transporter;
};

const sendEmail = async (to, subject, text, html) => {
  const transporter = getTransporter();
  if (!transporter) {
    console.warn('[Email] SMTP not configured or using placeholder credentials — email NOT sent to', to);
    return false;
  }

  const fromName = process.env.SMTP_FROM_NAME || 'Busia County Leave Management';
  const fromAddress = process.env.SMTP_USER;

  const info = await transporter.sendMail({
    from: `"${fromName}" <${fromAddress}>`,
    to,
    subject,
    text,
    html
  });
  console.log('[Email] Sent to', to, '— messageId:', info.messageId);
  return info;
};

const sendSms = async (to, message, retries = 2) => {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_PHONE_NUMBER) {
    console.warn('[SMS] Twilio not configured — SMS NOT sent to', to);
    return false;
  }

  // Validate phone number format (must start with + and have 10-15 digits)
  const cleaned = (to || '').replace(/[\s\-()]/g, '');
  if (!/^\+\d{10,15}$/.test(cleaned)) {
    console.warn('[SMS] Invalid phone number format:', to);
    return false;
  }

  // Truncate message to SMS limit
  const truncated = message.length > 1600 ? message.substring(0, 1597) + '...' : message;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      const msg = await client.messages.create({
        body: truncated,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: cleaned
      });
      console.log('[SMS] Sent to', cleaned, '— SID:', msg.sid);
      return msg;
    } catch (err) {
      console.error(`[SMS] Attempt ${attempt + 1}/${retries + 1} failed for ${cleaned}:`, err.message);
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1))); // exponential backoff
      }
    }
  }
  console.error('[SMS] All retries exhausted for', cleaned);
  return false;
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
      const loginUrl = (process.env.FRONTEND_URL || 'http://localhost:3000') + '/notifications';

      // Pick a header colour based on notification type
      let headerBg = 'linear-gradient(135deg,#1e3a5f 0%,#2d6bb0 100%)'; // default blue
      if (['approval', 'leave_approved_info', 'leave_hr_notice'].includes(type) && title.toLowerCase().includes('approved')) {
        headerBg = 'linear-gradient(135deg,#065f46 0%,#047857 100%)'; // green
      } else if (['rejection', 'leave_rejected_info'].includes(type) || title.toLowerCase().includes('rejected')) {
        headerBg = 'linear-gradient(135deg,#991b1b 0%,#dc2626 100%)'; // red
      } else if (['approval_request', 'leave_submission'].includes(type) && title.toLowerCase().includes('awaiting')) {
        headerBg = 'linear-gradient(135deg,#92400e 0%,#d97706 100%)'; // amber
      }

      const html = `
        <div style="font-family:'Inter',Arial,sans-serif;max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0">
          <div style="background:${headerBg};padding:24px 32px;text-align:center">
            <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700">${title}</h1>
          </div>
          <div style="padding:28px 32px">
            <p style="color:#334155;font-size:14px;line-height:1.7;margin:0 0 24px">${message}</p>
            <div style="text-align:center;margin:0 0 20px">
              <a href="${loginUrl}" style="display:inline-block;background:#1e293b;color:#ffffff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">View in Dashboard</a>
            </div>
          </div>
          <div style="background:#f8fafc;padding:14px 32px;text-align:center;border-top:1px solid #e2e8f0">
            <p style="margin:0;color:#94a3b8;font-size:12px">This is an automated message from the Busia County Leave Management System.</p>
          </div>
        </div>`;

      await sendEmail(email, title, message, html).catch((err) => {
        console.error('[Email] Failed to send to', email, ':', err.message);
      });
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

/**
 * Send a polished HTML approval email to the leave applicant.
 * Called when a leave application receives final (supervisor) approval.
 */
const sendLeaveApprovalEmail = async ({ to, firstName, leaveType, startDate, endDate, numberOfDays, comments }) => {
  const subject = `✓ Leave Approved — ${leaveType}`;
  const loginUrl = (process.env.FRONTEND_URL || 'http://localhost:3000') + '/dashboard';

  const text = [
    `Hello ${firstName},`,
    '',
    `Great news! Your ${leaveType} request has been approved.`,
    '',
    `Details:`,
    `  Leave Type: ${leaveType}`,
    `  Dates: ${startDate} to ${endDate}`,
    `  Days: ${numberOfDays}`,
    comments ? `  Comments: ${comments}` : '',
    '',
    `View your dashboard: ${loginUrl}`,
    '',
    'This is an automated message from the Busia County Leave Management System.'
  ].filter(Boolean).join('\n');

  const html = `
    <div style="font-family:'Inter',Arial,sans-serif;max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0">
      <div style="background:linear-gradient(135deg,#065f46 0%,#047857 100%);padding:28px 32px;text-align:center">
        <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700">✓ Leave Approved</h1>
      </div>
      <div style="padding:32px">
        <p style="color:#0f172a;font-size:16px;margin:0 0 18px">Hello <strong>${firstName}</strong>,</p>
        <p style="color:#334155;font-size:14px;line-height:1.6;margin:0 0 20px">
          Great news! Your leave request has been <strong style="color:#065f46">approved</strong> by your supervisor.
        </p>
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-left:4px solid #065f46;border-radius:8px;padding:18px;margin:0 0 24px">
          <p style="margin:0 0 8px;color:#0f172a;font-size:14px"><strong>Leave Type:</strong> ${leaveType}</p>
          <p style="margin:0 0 8px;color:#0f172a;font-size:14px"><strong>Dates:</strong> ${startDate} to ${endDate}</p>
          <p style="margin:0 0 ${comments ? '8' : '0'}px;color:#0f172a;font-size:14px"><strong>Duration:</strong> ${numberOfDays} day(s)</p>
          ${comments ? `<p style="margin:0;color:#0f172a;font-size:14px"><strong>Comments:</strong> ${comments}</p>` : ''}
        </div>
        <div style="text-align:center;margin:0 0 24px">
          <a href="${loginUrl}" style="display:inline-block;background:linear-gradient(135deg,#065f46 0%,#047857 100%);color:#ffffff;padding:14px 36px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;letter-spacing:0.5px">View Dashboard</a>
        </div>
        <p style="color:#64748b;font-size:13px;text-align:center;margin:0">Your leave balance has been updated automatically.</p>
      </div>
      <div style="background:#f8fafc;padding:16px 32px;text-align:center;border-top:1px solid #e2e8f0">
        <p style="margin:0;color:#94a3b8;font-size:12px">This is an automated message from the Busia County Leave Management System.</p>
      </div>
    </div>`;

  return sendEmail(to, subject, text, html);
};

/**
 * Send a polished HTML rejection email to the leave applicant.
 */
const sendLeaveRejectionEmail = async ({ to, firstName, leaveType, startDate, endDate, numberOfDays, comments }) => {
  const subject = `✗ Leave Rejected — ${leaveType}`;
  const loginUrl = (process.env.FRONTEND_URL || 'http://localhost:3000') + '/dashboard';

  const text = [
    `Hello ${firstName},`,
    '',
    `Unfortunately, your ${leaveType} request has been rejected.`,
    '',
    `Details:`,
    `  Leave Type: ${leaveType}`,
    `  Dates: ${startDate} to ${endDate}`,
    `  Days: ${numberOfDays}`,
    `  Reason: ${comments || 'No reason provided'}`,
    '',
    `You can submit a new application with different dates.`,
    `View your dashboard: ${loginUrl}`,
    '',
    'This is an automated message from the Busia County Leave Management System.'
  ].join('\n');

  const html = `
    <div style="font-family:'Inter',Arial,sans-serif;max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0">
      <div style="background:linear-gradient(135deg,#991b1b 0%,#dc2626 100%);padding:28px 32px;text-align:center">
        <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700">✗ Leave Rejected</h1>
      </div>
      <div style="padding:32px">
        <p style="color:#0f172a;font-size:16px;margin:0 0 18px">Hello <strong>${firstName}</strong>,</p>
        <p style="color:#334155;font-size:14px;line-height:1.6;margin:0 0 20px">
          Unfortunately, your leave request has been <strong style="color:#991b1b">rejected</strong>.
        </p>
        <div style="background:#fef2f2;border:1px solid #fecaca;border-left:4px solid #991b1b;border-radius:8px;padding:18px;margin:0 0 24px">
          <p style="margin:0 0 8px;color:#0f172a;font-size:14px"><strong>Leave Type:</strong> ${leaveType}</p>
          <p style="margin:0 0 8px;color:#0f172a;font-size:14px"><strong>Dates:</strong> ${startDate} to ${endDate}</p>
          <p style="margin:0 0 8px;color:#0f172a;font-size:14px"><strong>Duration:</strong> ${numberOfDays} day(s)</p>
          <p style="margin:0;color:#0f172a;font-size:14px"><strong>Reason:</strong> ${comments || 'No reason provided'}</p>
        </div>
        <div style="text-align:center;margin:0 0 24px">
          <a href="${loginUrl}" style="display:inline-block;background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);color:#ffffff;padding:14px 36px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;letter-spacing:0.5px">View Dashboard</a>
        </div>
        <p style="color:#64748b;font-size:13px;text-align:center;margin:0">You can submit a new application with different dates or discuss with your supervisor.</p>
      </div>
      <div style="background:#f8fafc;padding:16px 32px;text-align:center;border-top:1px solid #e2e8f0">
        <p style="margin:0;color:#94a3b8;font-size:12px">This is an automated message from the Leave Management System.</p>
      </div>
    </div>`;

  return sendEmail(to, subject, text, html);
};

/**
 * Send a polished HTML submission confirmation email to the leave applicant.
 * Called when a leave application is submitted successfully.
 */
const sendLeaveSubmissionEmail = async ({ to, firstName, leaveType, startDate, endDate, numberOfDays }) => {
  const subject = `Leave Request Submitted — ${leaveType}`;
  const loginUrl = (process.env.FRONTEND_URL || 'http://localhost:3000') + '/history';

  const text = [
    `Hello ${firstName},`,
    '',
    `Your ${leaveType} request has been submitted successfully and is now awaiting supervisor approval.`,
    '',
    `Details:`,
    `  Leave Type: ${leaveType}`,
    `  Dates: ${startDate} to ${endDate}`,
    `  Days: ${numberOfDays}`,
    '',
    `You can track your application status here: ${loginUrl}`,
    '',
    'This is an automated message from the Busia County Leave Management System.'
  ].join('\n');

  const html = `
    <div style="font-family:'Inter',Arial,sans-serif;max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0">
      <div style="background:linear-gradient(135deg,#1e3a5f 0%,#2d6bb0 100%);padding:28px 32px;text-align:center">
        <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700">Leave Request Submitted</h1>
      </div>
      <div style="padding:32px">
        <p style="color:#0f172a;font-size:16px;margin:0 0 18px">Hello <strong>${firstName}</strong>,</p>
        <p style="color:#334155;font-size:14px;line-height:1.6;margin:0 0 20px">
          Your leave request has been <strong style="color:#1e3a5f">submitted successfully</strong> and is now pending supervisor approval.
        </p>
        <div style="background:#eff6ff;border:1px solid #bfdbfe;border-left:4px solid #2d6bb0;border-radius:8px;padding:18px;margin:0 0 24px">
          <p style="margin:0 0 8px;color:#0f172a;font-size:14px"><strong>Leave Type:</strong> ${leaveType}</p>
          <p style="margin:0 0 8px;color:#0f172a;font-size:14px"><strong>Dates:</strong> ${startDate} to ${endDate}</p>
          <p style="margin:0;color:#0f172a;font-size:14px"><strong>Duration:</strong> ${numberOfDays} day(s)</p>
        </div>
        <div style="text-align:center;margin:0 0 24px">
          <a href="${loginUrl}" style="display:inline-block;background:linear-gradient(135deg,#1e3a5f 0%,#2d6bb0 100%);color:#ffffff;padding:14px 36px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;letter-spacing:0.5px">Track Application</a>
        </div>
        <p style="color:#64748b;font-size:13px;text-align:center;margin:0">You will be notified once your supervisor reviews the request.</p>
      </div>
      <div style="background:#f8fafc;padding:16px 32px;text-align:center;border-top:1px solid #e2e8f0">
        <p style="margin:0;color:#94a3b8;font-size:12px">This is an automated message from the Busia County Leave Management System.</p>
      </div>
    </div>`;

  return sendEmail(to, subject, text, html);
};

module.exports = {
  notifyUser,
  sendEmail,
  sendSms,
  createInAppNotification,
  sendLeaveApprovalEmail,
  sendLeaveRejectionEmail,
  sendLeaveSubmissionEmail
};
