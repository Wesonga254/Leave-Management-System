const express = require('express');
const router = express.Router();
const {
  uploadAttachment,
  getAttachments,
  deleteAttachment,
  downloadAttachment
} = require('../controllers/attachmentController');
const { authenticateToken } = require('../middleware/auth');
const { uploadSingleFile } = require('../middleware/fileUpload');

// All routes require authentication
router.use(authenticateToken);

// Upload attachment
router.post('/upload', uploadSingleFile, uploadAttachment);

// Get attachments for an application
router.get('/application/:applicationId', getAttachments);

// Download attachment
router.get('/download/:attachmentId', downloadAttachment);

// Delete attachment
router.delete('/:attachmentId', deleteAttachment);

module.exports = router;
