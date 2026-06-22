import React, { useState, useEffect } from 'react';
import { attachmentService } from '../services/api';
import './AttachmentManager.css';

function AttachmentManager({ applicationId, isReadOnly = false }) {
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);

  useEffect(() => {
    if (applicationId) {
      fetchAttachments();
    }
  }, [applicationId]);

  const fetchAttachments = async () => {
    try {
      const response = await attachmentService.getAttachments(applicationId);
      setAttachments(response.data.data);
    } catch (err) {
      setError('Error loading attachments');
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Check file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError('File size exceeds 5MB limit');
        return;
      }

      // Check file type
      const allowedExtensions = ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png', 'xlsx', 'xls', 'txt'];
      const fileExtension = file.name.split('.').pop().toLowerCase();

      if (!allowedExtensions.includes(fileExtension)) {
        setError('File type not allowed. Allowed: PDF, DOC, DOCX, JPG, PNG, XLS, XLSX, TXT');
        return;
      }

      setSelectedFile(file);
      setError('');
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Please select a file to upload');
      return;
    }

    setUploading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('applicationId', applicationId);

      await attachmentService.uploadAttachment(formData);
      
      setSelectedFile(null);
      document.getElementById('fileInput').value = '';
      
      // Refresh attachments list
      await fetchAttachments();
    } catch (err) {
      setError(err.response?.data?.message || 'Error uploading file');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (attachmentId) => {
    if (window.confirm('Are you sure you want to delete this attachment?')) {
      try {
        await attachmentService.deleteAttachment(attachmentId);
        await fetchAttachments();
      } catch (err) {
        setError('Error deleting attachment');
      }
    }
  };

  const handleDownload = async (attachment) => {
    try {
      const response = await attachmentService.downloadAttachment(attachment.id);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', attachment.file_name);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
    } catch (err) {
      setError('Error downloading file');
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  // In read-only mode, hide the entire section if there are no attachments
  if (isReadOnly && !loading && attachments.length === 0) {
    return null;
  }

  return (
    <div className="attachment-manager">
      <h3>Supporting Documents</h3>

      {error && <div className="alert alert-error">{error}</div>}

      {!isReadOnly && (
        <div className="upload-section">
          <div className="file-input-wrapper">
            <input
              type="file"
              id="fileInput"
              onChange={handleFileSelect}
              disabled={uploading}
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xlsx,.xls,.txt"
            />
            <label htmlFor="fileInput" className="file-input-label">
              {selectedFile ? selectedFile.name : 'Choose file...'}
            </label>
          </div>

          <div className="file-info">
            <small>Max file size: 5MB | Allowed: PDF, DOC, DOCX, JPG, PNG, XLS, XLSX, TXT</small>
          </div>

          <button
            className="btn btn-primary"
            onClick={handleUpload}
            disabled={!selectedFile || uploading}
          >
            {uploading ? 'Uploading...' : 'Upload Document'}
          </button>
        </div>
      )}

      <div className="attachments-list">
        <h4>Uploaded Documents ({attachments.length})</h4>

        {loading ? (
          <div className="loading">Loading attachments...</div>
        ) : attachments.length === 0 ? (
          <div className="empty-state">No documents uploaded yet</div>
        ) : (
          <table className="attachment-table">
            <thead>
              <tr>
                <th>File Name</th>
                <th>Size</th>
                <th>Type</th>
                <th>Uploaded By</th>
                <th>Uploaded On</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {attachments.map(attachment => (
                <tr key={attachment.id}>
                  <td className="file-name">{attachment.file_name}</td>
                  <td>{formatFileSize(attachment.file_size)}</td>
                  <td>{attachment.file_type || 'Document'}</td>
                  <td>{attachment.first_name} {attachment.last_name}</td>
                  <td>{new Date(attachment.created_at).toLocaleDateString()}</td>
                  <td className="actions">
                    <button
                      className="btn btn-small btn-primary"
                      onClick={() => handleDownload(attachment)}
                    >
                      Download
                    </button>
                    {!isReadOnly && (
                      <button
                        className="btn btn-small btn-danger"
                        onClick={() => handleDelete(attachment.id)}
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default AttachmentManager;
