import React, { useState, useEffect } from 'react';
import { authService, leaveService, attachmentService, adminService } from '../services/api';
import { filterLeaveTypesByGender } from '../utils/leaveTypeGender';
import { showToast } from './Toast';
import { triggerNotificationRefresh } from './NotificationCenter';
import DateInput from './DateInput';
import './LeaveApplicationForm.css';

function LeaveApplicationForm() {
  const [formData, setFormData] = useState({
    leave_type_id: '',
    start_date: '',
    end_date: '',
    reason: '',
    designation: '',
    contact_number: ''
  });
  const todayISO = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })();
  const [profile, setProfile] = useState(JSON.parse(localStorage.getItem('user') || '{}'));
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [leaveBalance, setLeaveBalance] = useState({});
  const [numberOfDays, setNumberOfDays] = useState(0);
  const [holidays, setHolidays] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const applicableLeaveTypes = filterLeaveTypesByGender(leaveTypes, profile.gender);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const designations = ['HR', 'Chief Officer', 'Supervisor'];
  const documentUploadLeaveKeywords = ['compassion', 'study', 'sick'];

  const resetFileInput = () => {
    const fileInput = document.getElementById('fileInput');
    if (fileInput) fileInput.value = '';
  };

  useEffect(() => {
    fetchCurrentProfile();
    fetchLeaveTypes();
    fetchLeaveBalance();
    fetchHolidays();
  }, []);

  useEffect(() => {
    if (formData.start_date && formData.end_date) {
      // compute business days excluding weekends and public holidays
      const s = new Date(formData.start_date);
      const e = new Date(formData.end_date);
      let d = new Date(s);
      let count = 0;
      const holidaySet = new Set((holidays || []).map(h => h.date));
      while (d <= e) {
        const day = d.getDay();
        const iso = d.toISOString().slice(0,10);
        if (day !== 0 && day !== 6 && !holidaySet.has(iso)) count += 1;
        d.setDate(d.getDate() + 1);
      }
      setNumberOfDays(Math.max(0, count));
    }
  }, [formData.start_date, formData.end_date, holidays]);



  const fetchLeaveTypes = async () => {
    try {
      const response = await leaveService.getLeaveTypes();
      setLeaveTypes(response.data.data);
    } catch (err) {
      setError('Error loading leave types');
    }
  };

  const fetchLeaveBalance = async () => {
    try {
      const response = await leaveService.getLeaveBalance();
      const balanceMap = {};
      response.data.data.forEach(balance => {
        balanceMap[balance.leave_type_id] = balance;
      });
      setLeaveBalance(balanceMap);
    } catch (err) {
      setError('Error loading leave balance');
    }
  };

  const fetchHolidays = async () => {
    try {
      const res = await leaveService.getHolidays();
      if (res.data.success) setHolidays(res.data.data || []);
    } catch (err) {
      // ignore
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

  const handleAddFile = () => {
    if (!selectedFile) {
      setError('Please select a file to add');
      return;
    }

    // Check if file already added
    if (pendingFiles.some(f => f.name === selectedFile.name)) {
      setError('This file has already been added');
      return;
    }

    setPendingFiles([...pendingFiles, selectedFile]);
    setSelectedFile(null);
    resetFileInput();
    setError('');
  };

  const fetchCurrentProfile = async () => {
    try {
      const response = await authService.getCurrentUser();
      const latestProfile = response.data.user || response.data.data || profile;
      setProfile(latestProfile);
      localStorage.setItem('user', JSON.stringify(latestProfile));
      setFormData(prev => ({
        ...prev,
        designation: latestProfile.designation || prev.designation,
        contact_number: latestProfile.phone || prev.contact_number
      }));
    } catch (err) {
      setFormData(prev => ({
        ...prev,
        designation: profile.designation || prev.designation,
        contact_number: profile.phone || prev.contact_number
      }));
    }
  };

  const handleRemovePendingFile = (index) => {
    setPendingFiles(pendingFiles.filter((_, i) => i !== index));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };


  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    // Validate form data
    if (!formData.leave_type_id || !formData.start_date || !formData.end_date || !formData.reason) {
      setError('Please fill in all required fields');
      return;
    }

    if (numberOfDays === 0) {
      setError('Please select valid start and end dates');
      return;
    }

    if (balanceValidationMessage) {
      setError(balanceValidationMessage);
      return;
    }

    const selectedType = applicableLeaveTypes.find(t => t.id === parseInt(formData.leave_type_id));
    const leaveName = (selectedType?.name || '').toLowerCase();
    const requiresDocumentUpload = documentUploadLeaveKeywords.some(keyword => leaveName.includes(keyword));
    if (requiresDocumentUpload) {
      if (pendingFiles.length === 0) {
        setError('This leave type requires supporting documents. Please attach files before submitting.');
        return;
      }
    }

    // Show confirmation modal instead of submitting directly
    setShowConfirmation(true);
  };

  const confirmSubmit = async () => {
    setShowConfirmation(false);
    setLoading(true);

    try {
      const submitData = {
        ...formData,
        number_of_days: numberOfDays,
        has_attachment: pendingFiles.length > 0
      };
      const response = await leaveService.submitApplication(submitData);
      const applicationId = response.data.application_id;


      // Upload pending files if any
      if (pendingFiles.length > 0) {
        for (const file of pendingFiles) {
          try {
            const fileFormData = new FormData();
            fileFormData.append('file', file);
            fileFormData.append('applicationId', applicationId);
            await attachmentService.uploadAttachment(fileFormData);
          } catch (err) {
            console.error('Error uploading file:', file.name);
          }
        }
        showToast('Leave application submitted successfully! Documents uploaded.', 'success');
        setPendingFiles([]);
      } else {
        showToast('Leave application submitted successfully!', 'success');
      }

      // Immediately refresh notification bell so user sees their new notification
      triggerNotificationRefresh();

      setFormData({
        leave_type_id: '',
        start_date: '',
        end_date: '',
        reason: '',
        designation: profile.designation || '',
        contact_number: formData.contact_number
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Error submitting application');
    } finally {
      setLoading(false);
    }
  };

  const currentBalance = formData.leave_type_id ? leaveBalance[formData.leave_type_id] : null;
  const selectedLeaveType = applicableLeaveTypes.find(type => type.id === parseInt(formData.leave_type_id));
  const selectedLeaveName = (selectedLeaveType?.name || '').toLowerCase();
  const showDocumentUpload = documentUploadLeaveKeywords.some(keyword => selectedLeaveName.includes(keyword));
  const availableDays = currentBalance?.remaining_days ?? 0;
  const balanceValidationMessage = formData.leave_type_id && numberOfDays > 0 && currentBalance && numberOfDays > availableDays
    ? `You do not have enough leave days. Available balance: ${availableDays} days, Requested: ${numberOfDays} days.`
    : '';
  const requestSummaryItems = [
    ['Leave Type', selectedLeaveType?.name || 'Select a leave type'],
    ['Start Date', formData.start_date || 'Not selected'],
    ['End Date', formData.end_date || 'Not selected'],
    ['Working Days', numberOfDays ? `${numberOfDays} day(s)` : 'Calculated after dates'],
    ['Available Balance', currentBalance ? `${availableDays} day(s)` : 'Select a leave type'],
    ['Supporting Files', `${pendingFiles.length} file(s)`]
  ];
  useEffect(() => {
    if (!showDocumentUpload) {
      setSelectedFile(null);
      setPendingFiles([]);
      resetFileInput();
    }
  }, [showDocumentUpload]);

  return (
    <div className="leave-application-container">
      <div className="leave-application-header">
        <h2 className="form-title">Leave Application Request</h2>
        <p className="form-subtitle">Submit your leave request with details and supporting documents</p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <form onSubmit={handleSubmit} className="leave-form">
        {/* Combined Application Form with Document Upload */}
        <div className="form-section">
          <h3 className="section-title">Leave Application Form</h3>
          
          {/* Leave Type Selection */}
          <div className="form-group">
            <label htmlFor="leave_type_id">
              Leave Type
              <span className="required">*</span>
            </label>
            <select
              id="leave_type_id"
              name="leave_type_id"
              value={formData.leave_type_id}
              onChange={handleChange}
              required
              className="form-control"
            >
              <option value="">Select your leave type</option>
              {applicableLeaveTypes.map(type => (
                <option key={type.id} value={type.id}>{type.name}</option>
              ))}
            </select>
          </div>

          {/* Current Balance Display */}
          {currentBalance && (
            <div className="balance-card">
              <div className="balance-info">
                <p className="balance-label">Available Balance</p>
                <p className="balance-value">{currentBalance.remaining_days} days</p>
              </div>
            </div>
          )}
          {balanceValidationMessage && <div className="alert alert-error">{balanceValidationMessage}</div>}

          {/* Dates Selection */}
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="start_date">
                Start Date
                <span className="required">*</span>
              </label>
              <DateInput
                id="start_date"
                name="start_date"
                value={formData.start_date}
                onChange={handleChange}
                required
                min={todayISO}
                placeholder="Select start date"
              />
            </div>
            <div className="form-group">
              <label htmlFor="end_date">
                End Date
                <span className="required">*</span>
              </label>
              <DateInput
                id="end_date"
                name="end_date"
                value={formData.end_date}
                onChange={handleChange}
                required
                min={formData.start_date || todayISO}
                placeholder="Select end date"
              />
            </div>
          </div>

          {/* Days Counter */}
          <div className="days-counter">
            <span className="days-label">Number of Days</span>
            <span className="days-value">{numberOfDays}</span>
          </div>

          {/* Reason for Leave */}
          <div className="form-group">
            <label htmlFor="reason">
              Reason for Leave
              <span className="required">*</span>
            </label>
            <textarea
              id="reason"
              name="reason"
              value={formData.reason}
              onChange={handleChange}
              placeholder="Please provide a detailed reason for your leave request..."
              required
              className="form-control textarea-field"
              rows="4"
            />
            <p className="form-hint">Be specific about your reason (e.g., medical appointment, family event, etc.)</p>
          </div>

          {showDocumentUpload && (
            <>
              {/* Divider for Document Section */}
              <div className="form-divider">
                <span>Supporting Documents</span>
              </div>

              <p className="section-description">Attach the required supporting document for this leave type.</p>
              
              <div className="upload-section">
                <div className="file-input-wrapper">
                  <input
                    type="file"
                    id="fileInput"
                    onChange={handleFileSelect}
                    className="file-input"
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xlsx,.xls,.txt"
                  />
                  <label htmlFor="fileInput" className="file-label">
                    <span className="file-text">
                      {selectedFile ? selectedFile.name : 'Choose a file to upload'}
                    </span>
                  </label>
                </div>

                <p className="file-info">
                  Supported formats: PDF, DOC, DOCX, JPG, PNG, XLS, XLSX, TXT (Max 5MB)
                </p>

                {selectedFile && (
                  <button 
                    type="button"
                    onClick={handleAddFile}
                    className="btn btn-success btn-upload"
                  >
                    Add File
                  </button>
                )}
              </div>

              {/* Pending Files List */}
              {pendingFiles.length > 0 && (
                <div className="uploaded-files">
                  <h4 className="files-title">Files to Upload ({pendingFiles.length})</h4>
                  <div className="files-list">
                    {pendingFiles.map((file, idx) => (
                      <div key={idx} className="file-item">
                        <div className="file-item-info">
                          <p className="file-item-name">{file.name}</p>
                          <p className="file-item-size">{(file.size / 1024).toFixed(2)} KB</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemovePendingFile(idx)}
                          className="btn-delete-file"
                          title="Remove file"
                        >
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Submission Section */}
        <div className="form-section form-section-submit">
          <div className="button-group">
            <button 
              type="submit" 
              className="btn btn-primary btn-large btn-submit" 
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="spinner-mini"></span> Submitting...
                </>
              ) : (
                'Submit Application'
              )}
            </button>
            <button 
              type="button" 
              className="btn btn-secondary btn-large btn-cancel" 
              onClick={() => {
                if (window.confirm('Are you sure you want to cancel? Your form data will be cleared.')) {
                  setFormData({
                    leave_type_id: '',
                    start_date: '',
                    end_date: '',
                    reason: '',
                    designation: ''
                    ,
                    contact_number: profile.phone || ''
                  });
                  setPendingFiles([]);
                  setSelectedFile(null);
                  resetFileInput();
                  setError('');
                }
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      </form>

      {/* Confirmation Modal */}
      {showConfirmation && (
        <div className="leave-confirm-backdrop" onClick={() => setShowConfirmation(false)}>
          <div className="leave-confirm-modal" onClick={e => e.stopPropagation()}>
            <h3 className="leave-confirm-title">Confirm Leave Application</h3>
            <p className="leave-confirm-subtitle">Please review the details below before submitting.</p>

            <div className="leave-confirm-details">
              <div className="leave-confirm-row">
                <span className="leave-confirm-label">Leave Type</span>
                <span className="leave-confirm-value">{selectedLeaveType?.name || '—'}</span>
              </div>
              <div className="leave-confirm-row">
                <span className="leave-confirm-label">Start Date</span>
                <span className="leave-confirm-value">{formData.start_date ? new Date(formData.start_date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}</span>
              </div>
              <div className="leave-confirm-row">
                <span className="leave-confirm-label">End Date</span>
                <span className="leave-confirm-value">{formData.end_date ? new Date(formData.end_date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}</span>
              </div>
              <div className="leave-confirm-row">
                <span className="leave-confirm-label">Working Days</span>
                <span className="leave-confirm-value leave-confirm-days">{numberOfDays} day{numberOfDays !== 1 ? 's' : ''}</span>
              </div>
              <div className="leave-confirm-row">
                <span className="leave-confirm-label">Reason</span>
                <span className="leave-confirm-value">{formData.reason || '—'}</span>
              </div>
              {pendingFiles.length > 0 && (
                <div className="leave-confirm-row">
                  <span className="leave-confirm-label">Attachments</span>
                  <span className="leave-confirm-value">{pendingFiles.length} file{pendingFiles.length !== 1 ? 's' : ''}</span>
                </div>
              )}
            </div>

            <div className="leave-confirm-actions">
              <button type="button" className="btn btn-primary btn-submit" onClick={confirmSubmit}>
                Confirm & Submit
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setShowConfirmation(false)} style={{ padding: '12px 28px', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', border: '1px solid #d0d5dd', background: 'white', color: '#374151' }}>
                Go Back
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default LeaveApplicationForm;
