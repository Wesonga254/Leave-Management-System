import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authService } from '../services/api';
import DateInput from '../components/DateInput';
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
  directorate_id: '',
  designation: '',
  email: '',
  phone: '',
  password: '',
  confirm_password: '',
};

const FALLBACK_DEPARTMENTS = [
  'County Public Service Board',
  'The County Treasury and Economic Planning',
  'Public Service Management and Governance',
  'Health and Sanitation',
  'Education and Industrial Skills Development',
  'Smart Agriculture, Livestock, Fisheries and Blue Economy',
  'Strategic Partnerships, ICT and Digital Economy',
  'Lands, Housing and Urban Development',
  'Transport, Roads and Public Works',
  'Water, Irrigation, Environment, Natural Resources, Climate Change and Energy',
  'Trade, Investment, Industrialization, Cooperatives and SME',
  'Youth, Sports, Tourism, Culture, Social Protection, Gender Affairs and Creative Arts',
];

function RegisterPage() {
  const [formData, setFormData] = useState(initialFormData);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [validation, setValidation] = useState({});
  const [departments, setDepartments] = useState([]);
  const [allDirectorates, setAllDirectorates] = useState([]);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    authService.getDepartments()
      .then(res => {
        const data = res.data?.data;
        if (Array.isArray(data) && data.length > 0) {
          setDepartments(data);
        } else {
          setDepartments(FALLBACK_DEPARTMENTS.map((name, i) => ({ id: i + 1, name })));
        }
      })
      .catch(() => {
        setDepartments(FALLBACK_DEPARTMENTS.map((name, i) => ({ id: i + 1, name })));
      });

    authService.getDirectorates()
      .then(res => {
        const data = res.data?.data;
        if (Array.isArray(data)) setAllDirectorates(data);
      })
      .catch(() => {});
  }, []);

  // Filter directorates based on selected department
  const filteredDirectorates = useMemo(() => {
    if (!formData.department) return [];
    const dept = departments.find(d => d.name === formData.department);
    if (!dept) return [];
    return allDirectorates.filter(dir => dir.department_id === dept.id);
  }, [formData.department, departments, allDirectorates]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const next = { ...prev, [name]: value };
      // Reset directorate when department changes
      if (name === 'department') {
        next.directorate_id = '';
      }
      return next;
    });
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
      ['email', 'Email is required'],
      ['password', 'Password is required'],
      ['confirm_password', 'Please confirm your password']
    ];

    requiredFields.forEach(([field, message]) => {
      if (!String(formData[field] || '').trim()) {
        errors[field] = message;
      }
    });

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Enter a valid email address';
    }

    if (formData.password && !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d\s])\S{8,}$/.test(formData.password)) {
      errors.password = 'Min 8 chars with uppercase, lowercase, number & special character';
    }

    if (formData.password && formData.confirm_password && formData.password !== formData.confirm_password) {
      errors.confirm_password = 'Passwords do not match';
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
      const { confirm_password, ...payload } = formData;
      const res = await authService.register(payload);
      setSuccess(res.data?.message || 'Registration submitted successfully! Your account is pending admin approval. You will be able to login once approved.');
      setFormData(initialFormData);
      setTimeout(() => {
        navigate('/login');
      }, 4000);
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
          <img
            src="/busia-county-logo.png"
            alt="County Government of Busia"
            style={{ height: 56, width: 'auto', marginBottom: 8, borderRadius: 6 }}
          />
          <h2>County Government of Busia</h2>
          <p className="subtitle">Leave Management System — Sign Up</p>
        </div>

        <div className="verification-notice">
          <strong>Account Verification</strong>
          <span>Your registration will be reviewed by the system administrator. You will receive access once your account has been verified.</span>
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-section">
            <h3>Personal Information</h3>
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
                  <option value="">Select</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
                {validation.gender && <span className="error-text">{validation.gender}</span>}
              </div>
              <div className="form-group">
                <label htmlFor="date_of_birth">Date of Birth <span className="required">*</span></label>
                <DateInput id="date_of_birth" name="date_of_birth" value={formData.date_of_birth} onChange={handleChange} max={(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })()} placeholder="Select date of birth" />
                {validation.date_of_birth && <span className="error-text">{validation.date_of_birth}</span>}
              </div>
            </div>
          </div>

          <div className="form-section">
            <h3>Employment Information</h3>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="national_id">National ID Number <span className="required">*</span></label>
                <input type="text" id="national_id" name="national_id" value={formData.national_id} onChange={handleChange} />
                {validation.national_id && <span className="error-text">{validation.national_id}</span>}
              </div>
              <div className="form-group">
                <label htmlFor="employee_id">Employee / PF Number <span className="required">*</span></label>
                <input type="text" id="employee_id" name="employee_id" value={formData.employee_id} onChange={handleChange} />
                {validation.employee_id && <span className="error-text">{validation.employee_id}</span>}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="department">Department <span className="required">*</span></label>
                <select id="department" name="department" value={formData.department} onChange={handleChange}>
                  <option value="">Select Department</option>
                  {departments.map(dept => (
                    <option key={dept.id || dept} value={dept.name || dept}>{dept.name || dept}</option>
                  ))}
                </select>
                {validation.department && <span className="error-text">{validation.department}</span>}
              </div>
              <div className="form-group">
                <label htmlFor="directorate_id">Directorate</label>
                <select
                  id="directorate_id"
                  name="directorate_id"
                  value={formData.directorate_id}
                  onChange={handleChange}
                  disabled={!formData.department || filteredDirectorates.length === 0}
                >
                  <option value="">
                    {!formData.department ? '— Select department first —' : filteredDirectorates.length === 0 ? '— No directorates —' : 'Select Directorate'}
                  </option>
                  {filteredDirectorates.map(dir => (
                    <option key={dir.id} value={dir.id}>{dir.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="designation">Designation / Job Title</label>
                <input
                  type="text"
                  id="designation"
                  name="designation"
                  placeholder="e.g. Senior Accountant, Clerk, ICT Officer"
                  value={formData.designation}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="kra_number">KRA PIN</label>
                <input type="text" id="kra_number" name="kra_number" value={formData.kra_number} onChange={handleChange} placeholder="e.g. A123456789B" />
              </div>
            </div>
          </div>

          <div className="form-section">
            <h3>Contact Information</h3>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="email">Email Address <span className="required">*</span></label>
                <input type="email" id="email" name="email" value={formData.email} onChange={handleChange} autoComplete="email" />
                {validation.email && <span className="error-text">{validation.email}</span>}
              </div>
              <div className="form-group">
                <label htmlFor="phone">Phone Number</label>
                <input type="tel" id="phone" name="phone" value={formData.phone} onChange={handleChange} autoComplete="tel" placeholder="e.g. 0712345678" />
              </div>
            </div>
          </div>

          <div className="form-section">
            <h3>Set Your Password</h3>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="password">Password <span className="required">*</span></label>
                <div className="password-input-wrapper">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    autoComplete="new-password"
                  />
                  <button type="button" className="password-toggle" onClick={() => setShowPassword(v => !v)} tabIndex={-1} title={showPassword ? 'Hide password' : 'Show password'}>
                    {showPassword ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    )}
                  </button>
                </div>
                {validation.password && <span className="error-text">{validation.password}</span>}
              </div>
              <div className="form-group">
                <label htmlFor="confirm_password">Confirm Password <span className="required">*</span></label>
                <div className="password-input-wrapper">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="confirm_password"
                    name="confirm_password"
                    value={formData.confirm_password}
                    onChange={handleChange}
                    autoComplete="new-password"
                  />
                  <button type="button" className="password-toggle" onClick={() => setShowPassword(v => !v)} tabIndex={-1} title={showPassword ? 'Hide password' : 'Show password'}>
                    {showPassword ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    )}
                  </button>
                </div>
                {validation.confirm_password && <span className="error-text">{validation.confirm_password}</span>}
              </div>
            </div>
            <p className="password-hint">Minimum 8 characters including uppercase, lowercase, a number, and a special character.</p>
          </div>

          <button type="submit" className="btn btn-primary btn-large btn-login" disabled={loading}>
            {loading ? 'Submitting...' : 'Sign Up'}
          </button>
        </form>

        <p className="auth-link">
          Already registered? <Link to="/login">Sign in here</Link>
        </p>
      </div>
      <footer className="auth-footer">
        <p>&copy; {new Date().getFullYear()} County Government of Busia. All rights reserved.</p>
        <p>Leave Management System — ICT & Digital Economy Directorate</p>
      </footer>
    </div>
  );
}

export default RegisterPage;

