import React, { useEffect, useRef, useState } from 'react';
import { authService } from '../services/api';
import './ProfileDropdown.css';

function ProfileDropdown({ onLogout }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
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
      chief_officer: 'Chief Officer',
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
      setMessage('New passwords do not match.');
      return;
    }

    setChangingPassword(true);
    setMessage('');
    try {
      await authService.changePassword({
        current_password: passwordData.current_password,
        new_password: passwordData.new_password
      });
      setPasswordData({ current_password: '', new_password: '', confirm_password: '' });
      setMessage('Password updated successfully.');
    } catch (err) {
      setMessage(err.response?.data?.message || 'Unable to update password.');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleSave = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      const response = await authService.updateCurrentUser(formData);
      syncProfile(response.data.user || response.data.data || formData);
      setMessage('Profile updated successfully.');
    } catch (err) {
      setMessage(err.response?.data?.message || 'Unable to update profile.');
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
        <span className="profile-button-text">
          <strong>{greetingName}</strong>
          <small>{getRoleDisplay()}</small>
        </span>
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
                {avatar('profile-avatar-xl')}
                <div>
                  <h2 id="profile-modal-title">{fullName}</h2>
                  <p>{profile.employee_id || 'Employee'} - {getRoleDisplay()}</p>
                </div>
              </div>
              <button type="button" className="profile-modal-close" onClick={() => setIsProfileOpen(false)} aria-label="Close profile">
                x
              </button>
            </div>

            <form className="profile-edit-form" onSubmit={handleSave}>
              <div className="profile-photo-control">
                <label htmlFor="profile-photo">Profile Picture</label>
                <input id="profile-photo" type="file" accept="image/*" onChange={handlePhotoChange} />
              </div>

              <div className="profile-form-grid">
                <label>
                  First Name
                  <input name="first_name" value={formData.first_name || ''} onChange={handleChange} required />
                </label>
                <label>
                  Middle Name
                  <input name="middle_name" value={formData.middle_name || ''} onChange={handleChange} />
                </label>
                <label>
                  Last Name
                  <input name="last_name" value={formData.last_name || ''} onChange={handleChange} required />
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
                  <input name="date_of_birth" type="date" value={(formData.date_of_birth || '').slice(0, 10)} onChange={handleChange} />
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
                <span><strong>Status</strong>{profile.registration_status || 'approved'}</span>
              </div>

              {message && <p className="profile-message">{message}</p>}

              <div className="profile-modal-actions">
                <button type="button" className="profile-secondary" onClick={() => setIsProfileOpen(false)}>Close</button>
                <button type="submit" className="profile-primary" disabled={saving}>{saving ? 'Saving...' : 'Save Profile'}</button>
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
          </section>
        </div>
      )}
    </div>
  );
}

export default ProfileDropdown;
