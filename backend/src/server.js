require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { initializeDatabase } = require('./database');
const { startCarryForwardScheduler } = require('./services/carryForwardService');
const { auditMiddleware } = require('./utils/auditLogger');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(auditMiddleware);

// Initialize database
initializeDatabase().then(() => {
  console.log('Database initialized successfully');
  startCarryForwardScheduler();

  // Verify SMTP connection on startup
  const nodemailer = require('nodemailer');
  if (process.env.SMTP_USER && process.env.SMTP_PASSWORD &&
      process.env.SMTP_USER !== 'your_email@gmail.com' && process.env.SMTP_PASSWORD !== 'your_password') {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
    });
    transporter.verify()
      .then(() => console.log('✓ SMTP email service connected successfully (' + process.env.SMTP_USER + ')'))
      .catch(err => console.error('✗ SMTP connection FAILED:', err.message));
  } else {
    console.warn('⚠ SMTP not configured — emails will NOT be sent');
  }
}).catch(err => {
  console.error('Database initialization error:', err);
  process.exit(1);
});

// Routes
const authRoutes = require('./routes/authRoutes');
const leaveRoutes = require('./routes/leaveRoutes');
const reportRoutes = require('./routes/reportRoutes');
const approvalRoutes = require('./routes/approvalRoutes');
const attachmentRoutes = require('./routes/attachmentRoutes');
const adminRoutes = require('./routes/adminRoutes');
const workflowRoutes = require('./routes/workflowRoutes');
const notificationRoutes = require('./routes/notificationRoutes');

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/leave', leaveRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/approval', approvalRoutes);
app.use('/api/attachments', attachmentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/workflow', workflowRoutes);
app.use('/api/notifications', notificationRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'Server is running' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: err.message
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Leave Management Backend running on port ${PORT}`);
});

module.exports = app;
