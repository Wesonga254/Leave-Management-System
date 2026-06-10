import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authService } from '../services/api';
import { getRoleBasedRedirect } from '../utils/roleHelper';
import '../pages/Auth.css';

function LoginPage({ setIsAuthenticated, setUserRole }) {
  const [idType, setIdType] = useState('employee_id');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
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
      localStorage.setItem('userRole', response.data.user.role);
      localStorage.setItem('userId', response.data.user.id);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      setIsAuthenticated(true);
      setUserRole(response.data.user.role);
      
      // Redirect based on role
      const redirectPath = getRoleBasedRedirect(response.data.user.role);
      navigate(redirectPath);
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h2>Leave Management System</h2>
          <p className="subtitle">Professional leave management system</p>
        </div>
        
        {error && <div className="alert alert-error">{error}</div>}
        
        <form onSubmit={handleSubmit}>
          <div className="form-group login-type-group">
            <label className="login-type-label">Login with either</label>
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
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setValidation(prev => ({ ...prev, password: '' }));
              }}
              placeholder="Enter your password"
              className="input-field"
            />
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
                <span className="spinner"></span> Logging in...
              </>
            ) : (
              'Login'
            )}
          </button>
        </form>

        <div className="auth-divider"></div>

        <p className="auth-link">
          Don't have an account? <Link to="/register" className="register-link">Create one now</Link>
        </p>
      </div>
    </div>
  );
}

export default LoginPage;
