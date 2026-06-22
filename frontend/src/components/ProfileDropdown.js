import React, { useEffect, useRef, useState } from 'react';
import { authService } from '../services/api';
import { showToast } from './Toast';
import DateInput from './DateInput';
import './ProfileDropdown.css';

function ProfileDropdown({ onLogout }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [photoViewOpen, setPhotoViewOpen] = useState(false);
  const [profile, setProfile] = useState(JSON.parse(localStorage.getItem('user') || '{}'));
  const [formData, setFormData] = useState({});
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordData, setPasswordData] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [message, setMessage] = useState('');
  const userRole = localStorage.getItem('userRole') || 'employee';
  const dropdownRef = useRef(null);

  const getRoleDisplay = () => {
    const roles = {
      admin: 'Admin',
      director: 'Director',
      hr: 'HR Manager',
      supervisor: 'Supervisor',
      employee: 'Employee'
    };
    return roles[userRole.toLowerCase()] || 'Employee';
  };

  const initials = [profile.first_name, profile.last_name]
    .filter(Boolean)
    .map(name => name.charAt(0).toUpperCase())
    .join('') || 'U';
  const fullName = [profile.first_name, profile.middle_name, profile.last_name].filter(Boolean).join(' ') || 'Account User';
  const greetingName = profile.first_name || profile.last_name || 'User';
  const accountStatusLabel = (() => {
    const value = String(profile.registration_status || 'APPROVED').toUpperCase();
    const labels = {
      PENDING_APPROVAL: 'Pending approval',
      PENDING_HR_APPROVAL: 'Pending approval',
      APPROVED: 'Approved',
      REJECTED: 'Rejected'
    };
    return labels[value] || value.replace(/_/g, ' ').toLowerCase();
  })();

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const syncProfile = (latestProfile) => {
    setProfile(latestProfile);
    setFormData(latestProfile);
    localStorage.setItem('user', JSON.stringify(latestProfile));
    window.dispatchEvent(new Event('user-profile-updated'));
  };

  const openProfile = async () => {
    setIsOpen(false);
    setIsProfileOpen(true);
    setMessage('');
    try {
      const response = await authService.getCurrentUser();
      syncProfile(response.data.user || response.data.data || profile);
    } catch (err) {
      setFormData(profile);
    }
  };

  const handleLogout = () => {
    setIsOpen(false);
    setIsProfileOpen(false);
    if (onLogout) onLogout();
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handlePhotoChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setFormData(prev => ({ ...prev, profile_image: reader.result }));
    };
    reader.readAsDataURL(file);
  };

  const handlePasswordChange = (event) => {
    const { name, value } = event.target;
    setPasswordData(prev => ({ ...prev, [name]: value.replace(/\s/g, '') }));
  };

  const handlePasswordSave = async (event) => {
    event.preventDefault();
    if (passwordData.new_password !== passwordData.confirm_password) {
      showToast('New passwords do not match.', 'error');
      return;
    }

    setChangingPassword(true);
    try {
      await authService.changePassword({
        current_password: passwordData.current_password,
        new_password: passwordData.new_password
      });
      setPasswordData({ current_password: '', new_password: '', confirm_password: '' });
      showToast('Password updated successfully.', 'success');
    } catch (err) {
      showToast(err.response?.data?.message || 'Unable to update password.', 'error');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleSave = async (event) => {
    if (event) event.preventDefault();
    setSaving(true);
    try {
      const response = await authService.updateCurrentUser(formData);
      syncProfile(response.data.user || response.data.data || formData);
      showToast('Profile updated successfully.', 'success');
    } catch (err) {
      showToast(err.response?.data?.message || 'Unable to update profile.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const avatar = (sizeClass = '') => (
    <span className={`profile-avatar ${sizeClass}`}>
      {profile.profile_image || formData.profile_image ? (
        <img src={formData.profile_image || profile.profile_image} alt="" />
      ) : (
        <span>{initials}</span>
      )}
    </span>
  );

  return (
    <div className="profile-dropdown" ref={dropdownRef}>
      <button
        className={`profile-button ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen(prev => !prev)}
        title="Account menu"
        aria-expanded={isOpen}
        aria-haspopup="menu"
      >
        {avatar('profile-avatar-sm')}
      </button>

      {isOpen && (
        <div className="profile-panel" role="menu">
          <div className="profile-menu-header">
            {avatar()}
            <div>
              <h3>{fullName}</h3>
              <p>{profile.email || 'No email recorded'}</p>
            </div>
          </div>

          <button type="button" className="account-menu-item" onClick={openProfile}>
            <span className="menu-icon">P</span>
            <span>View Profile</span>
          </button>
          <button type="button" className="account-menu-item danger" onClick={handleLogout}>
            <span className="menu-icon">L</span>
            <span>Logout</span>
          </button>
        </div>
      )}

      {isProfileOpen && (
        <div className="profile-modal-backdrop" role="presentation">
          <section className="profile-modal" role="dialog" aria-modal="true" aria-labelledby="profile-modal-title">
            <div className="profile-modal-header">
              <div className="profile-modal-identity">
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <div className="profile-avatar-clickable" onClick={() => setPhotoViewOpen(true)} title="Click to view full photo">
                    {avatar('profile-avatar-xl')}
                    <span className="profile-avatar-zoom-hint">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
                    </span>
                  </div>
                  <button type="button" className="profile-view-photo-btn" onClick={() => setPhotoViewOpen(true)}>
                    View Photo
                  </button>
                </div>
                <div>
                  <h2 id="profile-modal-title">{fullName}</h2>
                  <p>{profile.employee_id || 'Employee'} - {getRoleDisplay()}</p>
                </div>
              </div>
              <button type="button" className="profile-modal-close" onClick={() => setIsProfileOpen(false)} aria-label="Close profile">
                x
              </button>
            </div>

            {/* Photo Lightbox */}
            {photoViewOpen && (
              <div className="profile-photo-lightbox" onClick={() => setPhotoViewOpen(false)}>
                <div className="profile-photo-lightbox-content" onClick={e => e.stopPropagation()}>
                  {(formData.profile_image || profile.profile_image) ? (
                    <img src={formData.profile_image || profile.profile_image} alt="Profile" />
                  ) : (
                    <div className="profile-photo-lightbox-initials">{initials}</div>
                  )}
                  <div className="profile-photo-lightbox-actions">
                    <label htmlFor="profile-photo-lb" className="profile-photo-change-btn">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                      Change Photo
                    </label>
                    <input id="profile-photo-lb" type="file" accept="image/*" onChange={(e) => { handlePhotoChange(e); setPhotoViewOpen(false); }} style={{ display: 'none' }} />
                    <button type="button" className="profile-photo-change-btn" onClick={() => setPhotoViewOpen(false)}>Close</button>
                  </div>
                </div>
              </div>
            )}

            <form className="profile-edit-form" onSubmit={handleSave}>
              <input id="profile-photo" type="file" accept="image/*" onChange={handlePhotoChange} style={{ display: 'none' }} />

              <div className="profile-form-grid">
                <label>
                  First Name
                  <input name="first_name" value={formData.first_name || ''} disabled className="profile-readonly-input" />
                </label>
                <label>
                  Middle Name
                  <input name="middle_name" value={formData.middle_name || ''} disabled className="profile-readonly-input" />
                </label>
                <label>
                  Last Name
                  <input name="last_name" value={formData.last_name || ''} disabled className="profile-readonly-input" />
                </label>
                <label>
                  Email
                  <input name="email" type="email" value={formData.email || ''} onChange={handleChange} required />
                </label>
                <label>
                  Phone
                  <input name="phone" type="tel" value={formData.phone || ''} onChange={handleChange} />
                </label>
                <label>
                  KRA Number
                  <input name="kra_number" value={formData.kra_number || ''} onChange={handleChange} />
                </label>
                <label>
                  Date of Birth
                  <DateInput name="date_of_birth" value={(formData.date_of_birth || '').slice(0, 10)} onChange={handleChange} max={(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })()} placeholder="Select date" />
                </label>
                <label>
                  Designation
                  <input name="designation" value={formData.designation || ''} onChange={handleChange} />
                </label>
              </div>

              <div className="profile-readonly-grid">
                <span><strong>Employee ID</strong>{profile.employee_id || 'Not provided'}</span>
                <span><strong>National ID</strong>{profile.national_id || 'Not provided'}</span>
                <span><strong>Department</strong>{profile.department || 'Not provided'}</span>
                <span><strong>Status</strong>{accountStatusLabel}</span>
              </div>
            </form>

            <form className="profile-edit-form profile-password-form" onSubmit={handlePasswordSave}>
              <h3>Change Password</h3>
              <div className="profile-form-grid">
                <label>
                  Current Password
                  <input name="current_password" type="password" value={passwordData.current_password} onChange={handlePasswordChange} required autoComplete="current-password" />
                </label>
                <label>
                  New Password
                  <input name="new_password" type="password" value={passwordData.new_password} onChange={handlePasswordChange} required autoComplete="new-password" />
                </label>
                <label>
                  Confirm New Password
                  <input name="confirm_password" type="password" value={passwordData.confirm_password} onChange={handlePasswordChange} required autoComplete="new-password" />
                </label>
              </div>
              <div className="profile-modal-actions">
                <button type="submit" className="profile-primary" disabled={changingPassword}>
                  {changingPassword ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>

            <div className="profile-modal-actions" style={{ padding: '0 24px 24px' }}>
              <button type="button" className="profile-primary" disabled={saving} onClick={handleSave} style={{ width: '100%' }}>{saving ? 'Updating...' : 'Update Profile'}</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

export default ProfileDropdown;
