import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authService } from '../services/api';
import '../pages/Auth.css';

function ForgotPasswordPage() {
  const [step, setStep] = useState(1); // 1=request code, 2=enter code & new password
  const [identifier, setIdentifier] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  const handleRequestCode = async (e) => {
    e.preventDefault();
    if (!identifier.trim()) {
      setError('Employee ID or National ID is required');
      return;
    }

    setError('');
    setLoading(true);
    try {
      const res = await authService.forgotPassword({ identifier: identifier.trim() });
      setSuccess(res.data.message || 'Reset code sent to your registered email.');
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send reset code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!code.trim()) {
      setError('Reset code is required');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setError('');
    setLoading(true);
    try {
      const res = await authService.resetPassword({
        identifier: identifier.trim(),
        code: code.trim(),
        new_password: newPassword
      });
      setSuccess(res.data.message || 'Password reset successfully!');
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <img
            src="/busia-county-logo.png"
            alt="County Government of Busia"
            style={{ height: 64, width: 'auto', marginBottom: 10, borderRadius: 6 }}
          />
          <h2>{step === 1 ? 'Forgot Password' : 'Reset Password'}</h2>
          <p className="subtitle">
            {step === 1
              ? 'Enter your Employee ID or National ID to receive a reset code'
              : 'Enter the 6-digit code sent to your email'
            }
          </p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        {step === 1 ? (
          <form onSubmit={handleRequestCode}>
            <div className="form-group">
              <label htmlFor="fp-identifier">
                Employee ID or National ID
                <span className="required">*</span>
              </label>
              <input
                type="text"
                id="fp-identifier"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="e.g., EMP001 or 12345678"
                className="input-field"
                autoFocus
              />
            </div>

            <button type="submit" className="btn btn-primary btn-large btn-login" disabled={loading}>
              {loading ? 'Sending...' : 'Send Reset Code'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleResetPassword}>
            <div className="form-group">
              <label htmlFor="fp-code">
                Reset Code
                <span className="required">*</span>
              </label>
              <input
                type="text"
                id="fp-code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="Enter 6-digit code"
                className="input-field"
                maxLength={6}
                autoFocus
                style={{ letterSpacing: '4px', textAlign: 'center', fontSize: 20, fontWeight: 700 }}
              />
            </div>

            <div className="form-group">
              <label htmlFor="fp-newpass">
                New Password
                <span className="required">*</span>
              </label>
              <div className="password-input-wrap">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="fp-newpass"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  className="input-field"
                />
                <button
                  type="button"
                  className="password-visibility-btn"
                  onClick={() => setShowPassword(prev => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/>
                      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/>
                      <path d="M6.61 6.61A13.52 13.52 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/>
                      <line x1="2" x2="22" y1="2" y2="22"/>
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="fp-confirm">
                Confirm New Password
                <span className="required">*</span>
              </label>
              <input
                type="password"
                id="fp-confirm"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                className="input-field"
              />
            </div>

            <button type="submit" className="btn btn-primary btn-large btn-login" disabled={loading}>
              {loading ? 'Resetting...' : 'Reset Password'}
            </button>

            <button
              type="button"
              className="btn btn-secondary btn-large"
              style={{ width: '100%', marginTop: 10 }}
              onClick={() => { setStep(1); setError(''); setSuccess(''); setCode(''); }}
            >
              Request New Code
            </button>
          </form>
        )}

        <div className="auth-divider"></div>

        <p className="auth-link">
          Remember your password? <Link to="/login">Back to Login</Link>
        </p>
      </div>
      <footer className="auth-footer">
        <p>&copy; {new Date().getFullYear()} County Government of Busia. All rights reserved.</p>
        <p>Leave Management System — Powered by ICT & Digital Economy</p>
      </footer>
    </div>
  );
}

export default ForgotPasswordPage;
