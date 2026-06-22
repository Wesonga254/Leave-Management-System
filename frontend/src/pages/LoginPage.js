import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authService } from '../services/api';
import { getRoleBasedRedirect, normalizeRole } from '../utils/roleHelper';
import '../pages/Auth.css';

function LoginPage({ setIsAuthenticated, setUserRole }) {
  const [idType, setIdType] = useState('employee_id');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [validation, setValidation] = useState({});
  const navigate = useNavigate();

  // Load remembered credentials on mount
  React.useEffect(() => {
    const savedIdType = localStorage.getItem('savedIdType');
    const savedIdentifier = localStorage.getItem('savedIdentifier');
    const wasRemembered = localStorage.getItem('rememberMe') === 'true';
    
    if (wasRemembered && savedIdType && savedIdentifier) {
      setIdType(savedIdType);
      setIdentifier(savedIdentifier);
      setRememberMe(true);
    }
  }, []);

  const validateForm = () => {
    const errors = {};
    if (!identifier.trim()) {
      errors.identifier = 'ID/Number is required';
    }
    if (!password) {
      errors.password = 'Password is required';
    }
    setValidation(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    
    setError('');
    setLoading(true);

    try {
      const loginData = {
        [idType === 'employee_id' ? 'employee_id' : 'national_id']: identifier,
        password: password
      };
      
      const response = await authService.login(loginData);
      
      // Handle remember me
      if (rememberMe) {
        localStorage.setItem('savedIdType', idType);
        localStorage.setItem('savedIdentifier', identifier);
        localStorage.setItem('rememberMe', 'true');
      } else {
        localStorage.removeItem('savedIdType');
        localStorage.removeItem('savedIdentifier');
        localStorage.removeItem('rememberMe');
      }
      
      localStorage.setItem('token', response.data.token);
      const userRole = normalizeRole(response.data.user.role);
      localStorage.setItem('userRole', userRole);
      localStorage.setItem('userId', response.data.user.id);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      setIsAuthenticated(true);
      setUserRole(userRole);
      
      // Redirect based on role
      const redirectPath = getRoleBasedRedirect(userRole);
      navigate(redirectPath);
    } catch (err) {
      setError(err.response?.data?.message || 'Sign in failed. Please try again.');
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
            style={{ height: 72, width: 'auto', marginBottom: 12, borderRadius: 6 }}
          />
          <h2>County Government of Busia</h2>
          <p className="subtitle">Leave Management System</p>
        </div>
        
        {error && <div className="alert alert-error">{error}</div>}
        
        <form onSubmit={handleSubmit}>
          <div className="form-group login-type-group">
            <label className="login-type-label">Sign in with either</label>
            <div className="rectangular-selector">
              <button
                type="button"
                className={`rect-btn ${idType === 'employee_id' ? 'active' : ''}`}
                onClick={() => setIdType('employee_id')}
                title="Login with Employee Number"
              >
                PAYROLL.
              </button>
              <button
                type="button"
                className={`rect-btn ${idType === 'national_id' ? 'active' : ''}`}
                onClick={() => setIdType('national_id')}
                title="Login with National ID Number"
              >
                ID No.
              </button>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="identifier">
              {idType === 'employee_id' ? 'Employee Number' : 'National ID Number'}
              <span className="required">*</span>
            </label>
            <input
              type="text"
              id="identifier"
              value={identifier}
              onChange={(e) => {
                setIdentifier(e.target.value);
                setValidation(prev => ({ ...prev, identifier: '' }));
              }}
              placeholder={idType === 'employee_id' ? 'e.g., EMP001' : 'e.g., 123456789'}
              className="input-field"
            />
            {validation.identifier && <span className="error-text">{validation.identifier}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="password">
              Password
              <span className="required">*</span>
            </label>
            <div className="password-input-wrap">
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setValidation(prev => ({ ...prev, password: '' }));
                }}
                placeholder="Enter your password"
                className="input-field"
              />
              <button
                type="button"
                className="password-visibility-btn"
                onClick={() => setShowPassword(prev => !prev)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide-eye-off">
                    <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/>
                    <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/>
                    <path d="M6.61 6.61A13.52 13.52 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/>
                    <line x1="2" x2="22" y1="2" y2="22"/>
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide-eye">
                    <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>
            {validation.password && <span className="error-text">{validation.password}</span>}
          </div>

          <div className="form-options">
            <div className="checkbox-group">
              <input
                type="checkbox"
                id="rememberMe"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="checkbox-input"
              />
              <label htmlFor="rememberMe" className="checkbox-label">Remember me</label>
            </div>
            <Link to="/forgot-password" className="forgot-link">Forgot Password?</Link>
          </div>

          <button type="submit" className="btn btn-primary btn-large btn-login" disabled={loading}>
            {loading ? (
              <>
                <span className="spinner"></span> Signing in...
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        <div className="auth-divider"></div>

        <p className="auth-link">
          Don't have an account? <Link to="/register" className="register-link">Sign up now</Link>
        </p>
      </div>
      <footer className="auth-footer">
        <p>&copy; {new Date().getFullYear()} County Government of Busia. All rights reserved.</p>
        <p>Leave Management System — Powered by ICT & Digital Economy</p>
      </footer>
    </div>
  );
}

export default LoginPage;
