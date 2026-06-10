import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authService } from '../services/api';
import '../pages/Auth.css';

const initialFormData = {
  first_name: '',
  middle_name: '',
  last_name: '',
  gender: '',
  date_of_birth: '',
  national_id: '',
  employee_id: '',
  kra_number: '',
  department: '',
  email: '',
  phone: '',
};

function RegisterPage() {
  const [formData, setFormData] = useState(initialFormData);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [validation, setValidation] = useState({});
  const navigate = useNavigate();

  const departments = ['ICT', 'Finance', 'Operations', 'Agriculture', 'Sales', 'Marketing', 'Admin', 'Public Relations', 'Human Resources', 'Customer Service', 'Health & Safety'];
  const handleChange = (e) => {
    const { name, value } = e.target;
    const nextValue = value;

    setFormData(prev => ({
      ...prev,
      [name]: nextValue
    }));
    setValidation(prev => ({ ...prev, [name]: '', password_match: '' }));
  };

  const validateForm = () => {
    const errors = {};
    const requiredFields = [
      ['first_name', 'First name is required'],
      ['last_name', 'Last name is required'],
      ['gender', 'Gender is required'],
      ['date_of_birth', 'Date of birth is required'],
      ['national_id', 'National ID number is required'],
      ['employee_id', 'Employee ID / PF number is required'],
      ['department', 'Department is required'],
      ['email', 'Email is required']
    ];

    requiredFields.forEach(([field, message]) => {
      if (!String(formData[field] || '').trim()) {
        errors[field] = message;
      }
    });

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Enter a valid email address';
    }

    setValidation(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setError('');
    setSuccess('');
    setLoading(true);

    try {
      await authService.register(formData);
      setSuccess('Account created successfully. Check your email for your temporary login password, then sign in and change it from your profile.');
      setFormData(initialFormData);
      setTimeout(() => {
        navigate('/login');
      }, 3500);
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card wide-card register-card">
        <div className="auth-header compact">
          <h2>Leave Management System</h2>
          <p className="subtitle">Create your employee account</p>
        </div>

        <div className="verification-notice">
          <strong>Instant account access</strong>
          <span>A temporary password will be emailed to you after registration. Use it to log in, then update your password from your profile.</span>
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-section">
            <h3>Personal Details</h3>
            <div className="form-row three-columns">
              <div className="form-group">
                <label htmlFor="first_name">First Name <span className="required">*</span></label>
                <input type="text" id="first_name" name="first_name" value={formData.first_name} onChange={handleChange} autoComplete="given-name" />
                {validation.first_name && <span className="error-text">{validation.first_name}</span>}
              </div>
              <div className="form-group">
                <label htmlFor="middle_name">Middle Name</label>
                <input type="text" id="middle_name" name="middle_name" value={formData.middle_name} onChange={handleChange} autoComplete="additional-name" />
              </div>
              <div className="form-group">
                <label htmlFor="last_name">Last Name <span className="required">*</span></label>
                <input type="text" id="last_name" name="last_name" value={formData.last_name} onChange={handleChange} autoComplete="family-name" />
                {validation.last_name && <span className="error-text">{validation.last_name}</span>}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="gender">Gender <span className="required">*</span></label>
                <select id="gender" name="gender" value={formData.gender} onChange={handleChange}>
                  <option value="">Select Gender</option>
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                  <option value="other">Other</option>
                  <option value="prefer_not_to_say">Prefer not to say</option>
                </select>
                {validation.gender && <span className="error-text">{validation.gender}</span>}
              </div>
              <div className="form-group">
                <label htmlFor="date_of_birth">Date of Birth <span className="required">*</span></label>
                <input type="date" id="date_of_birth" name="date_of_birth" value={formData.date_of_birth} onChange={handleChange} />
                {validation.date_of_birth && <span className="error-text">{validation.date_of_birth}</span>}
              </div>
            </div>
          </div>

          <div className="form-section">
            <h3>Employment Details</h3>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="national_id">National ID Number <span className="required">*</span></label>
                <input type="text" id="national_id" name="national_id" value={formData.national_id} onChange={handleChange} />
                {validation.national_id && <span className="error-text">{validation.national_id}</span>}
              </div>
              <div className="form-group">
                <label htmlFor="employee_id">Employee ID / PF Number <span className="required">*</span></label>
                <input type="text" id="employee_id" name="employee_id" value={formData.employee_id} onChange={handleChange} />
                {validation.employee_id && <span className="error-text">{validation.employee_id}</span>}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="kra_number">KRA Number</label>
                <input type="text" id="kra_number" name="kra_number" value={formData.kra_number} onChange={handleChange} placeholder="e.g., A123456789B" />
              </div>
              <div className="form-group">
                <label htmlFor="department">Department <span className="required">*</span></label>
                <select id="department" name="department" value={formData.department} onChange={handleChange}>
                  <option value="">Select Department</option>
                  {departments.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
                {validation.department && <span className="error-text">{validation.department}</span>}
              </div>
            </div>
          </div>

          <div className="form-section">
            <h3>Contact Details</h3>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="email">Email <span className="required">*</span></label>
                <input type="email" id="email" name="email" value={formData.email} onChange={handleChange} autoComplete="email" />
                {validation.email && <span className="error-text">{validation.email}</span>}
              </div>
              <div className="form-group">
                <label htmlFor="phone">Phone Number</label>
                <input type="tel" id="phone" name="phone" value={formData.phone} onChange={handleChange} autoComplete="tel" />
              </div>
            </div>
          </div>

          <button type="submit" className="btn btn-primary btn-large btn-login" disabled={loading}>
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        <p className="auth-link">
          Already have an account? <Link to="/login">Login here</Link>
        </p>
      </div>
    </div>
  );
}

export default RegisterPage;
