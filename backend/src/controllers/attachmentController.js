const { getDatabase } = require('../database');
const { deleteFile } = require('../middleware/fileUpload');
const path = require('path');

// Upload attachment to leave application
const uploadAttachment = async (req, res) => {
  try {
    const db = getDatabase();
    const { applicationId } = req.body;

    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    if (!applicationId) {
      // Delete the uploaded file if no application ID
      deleteFile(req.file.filename);
      return res.status(400).json({ message: 'Application ID is required' });
    }

    // Verify the leave application exists and belongs to the user
    const application = await db.get(
      'SELECT * FROM leave_applications WHERE id = ?',
      [applicationId]
    );

    if (!application) {
      deleteFile(req.file.filename);
      return res.status(404).json({ message: 'Leave application not found' });
    }

    if (application.user_id !== req.user.id && req.user.role !== 'admin') {
      deleteFile(req.file.filename);
      return res.status(403).json({ message: 'Not authorized to upload to this application' });
    }

    // Insert attachment record. Keep filename and file_name in sync for older databases.
    const result = await db.run(
      `INSERT INTO attachments (leave_application_id, filename, file_name, file_path, file_size, file_type, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        applicationId,
        req.file.originalname,
        req.file.originalname,
        req.file.filename,
        req.file.size,
        req.file.mimetype,
        req.user.id
      ]
    );

    res.status(201).json({
      success: true,
      message: 'File uploaded successfully',
      attachment: {
        id: result.lastID,
        file_name: req.file.originalname,
        file_size: req.file.size,
        uploaded_by: req.user.id,
        created_at: new Date()
      }
    });
  } catch (error) {
    if (req.file) {
      deleteFile(req.file.filename);
    }
    res.status(500).json({
      success: false,
      message: 'Error uploading file',
      error: error.message
    });
  }
};

// Get attachments for a leave application
const getAttachments = async (req, res) => {
  try {
    const db = getDatabase();
    const { applicationId } = req.params;

    const application = await db.get(
      'SELECT user_id FROM leave_applications WHERE id = ?',
      [applicationId]
    );

    if (!application) {
      return res.status(404).json({ success: false, message: 'Leave application not found' });
    }

    const approvalAccess = await db.get(
      `SELECT id FROM approval_workflow
       WHERE leave_application_id = ?
         AND (approver_id = ? OR delegated_to = ?)
       LIMIT 1`,
      [applicationId, req.user.id, req.user.id]
    );

    if (application.user_id !== req.user.id && req.user.role !== 'admin' && !approvalAccess) {
      return res.status(403).json({ success: false, message: 'Not authorized to view attachments' });
    }

    const attachments = await db.all(
      `SELECT 
        a.*,
        COALESCE(a.file_name, a.filename) as file_name,
        u.first_name,
        u.last_name,
        u.email
       FROM attachments a
       JOIN users u ON a.uploaded_by = u.id
       WHERE a.leave_application_id = ?
       ORDER BY a.created_at DESC`,
      [applicationId]
    );

    res.json({
      success: true,
      data: attachments
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching attachments',
      error: error.message
    });
  }
};

// Delete attachment
const deleteAttachment = async (req, res) => {
  try {
    const db = getDatabase();
    const { attachmentId } = req.params;

    const attachment = await db.get(
      'SELECT * FROM attachments WHERE id = ?',
      [attachmentId]
    );

    if (!attachment) {
      return res.status(404).json({ message: 'Attachment not found' });
    }

    // Check authorization - only the uploader or admin can delete
    if (attachment.uploaded_by !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to delete this attachment' });
    }

    // Delete file from filesystem
    deleteFile(attachment.file_path);

    // Delete from database
    await db.run('DELETE FROM attachments WHERE id = ?', [attachmentId]);

    res.json({
      success: true,
      message: 'Attachment deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting attachment',
      error: error.message
    });
  }
};

// Download attachment
const downloadAttachment = async (req, res) => {
  try {
    const db = getDatabase();
    const { attachmentId } = req.params;

    const attachment = await db.get(
      `SELECT a.*, la.user_id
       FROM attachments a
       JOIN leave_applications la ON a.leave_application_id = la.id
       WHERE a.id = ?`,
      [attachmentId]
    );

    if (!attachment) {
      return res.status(404).json({ message: 'Attachment not found' });
    }

    const approvalAccess = await db.get(
      `SELECT id FROM approval_workflow
       WHERE leave_application_id = ?
         AND (approver_id = ? OR delegated_to = ?)
       LIMIT 1`,
      [attachment.leave_application_id, req.user.id, req.user.id]
    );

    if (attachment.user_id !== req.user.id && req.user.role !== 'admin' && !approvalAccess) {
      return res.status(403).json({ message: 'Not authorized to download this attachment' });
    }

    const filePath = path.join(__dirname, '../../uploads', attachment.file_path);

    res.download(filePath, attachment.file_name || attachment.filename);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error downloading attachment',
      error: error.message
    });
  }
};

module.exports = {
  uploadAttachment,
  getAttachments,
  deleteAttachment,
  downloadAttachment
};
