import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import api, { adminService, reportService } from '../services/api';
import { showToast } from '../components/Toast';
import DateInput from '../components/DateInput';
import '../pages/DashboardPage.css';
import '../pages/LeaveHistoryPage.css';

const emptyUser = {
  national_id: '',
  employee_id: '',
  email: '',
  first_name: '',
  last_name: '',
  gender: '',
  date_of_birth: '',
  department: '',
  directorate_id: '',
  role: 'supervisor'
};

const getTodayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const formatAccountStatus = (status) => {
  const value = String(status || 'APPROVED').toUpperCase();
  const labels = {
    PENDING_APPROVAL: 'Pending approval',
    PENDING_HR_APPROVAL: 'Pending approval',
    APPROVED: 'Approved',
    REJECTED: 'Rejected'
  };
  return labels[value] || value.replace(/_/g, ' ').toLowerCase();
};

function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editing, setEditing] = useState(null);
  const [roleValue, setRoleValue] = useState('');
  const [creating, setCreating] = useState(false);
  const [newUser, setNewUser] = useState(emptyUser);
  const [createdCredentials, setCreatedCredentials] = useState(null);
  const [copied, setCopied] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [allDirectorates, setAllDirectorates] = useState([]);
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [directorateFilter, setDirectorateFilter] = useState('');
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [viewingUser, setViewingUser] = useState(null);
  const [viewLeaveData, setViewLeaveData] = useState(null);
  const [viewLeaveLoading, setViewLeaveLoading] = useState(false);
  const [assigningSupervisor, setAssigningSupervisor] = useState(false);
  const [availableSupervisors, setAvailableSupervisors] = useState([]);
  const [selectedSupervisorId, setSelectedSupervisorId] = useState('');
  const userRole = localStorage.getItem('userRole') || 'employee';
  const isAdmin = userRole === 'admin';
  const errorTimerRef = useRef(null);
  const successTimerRef = useRef(null);

  const setAutoError = (msg) => {
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    setError(msg);
    if (msg) errorTimerRef.current = setTimeout(() => setError(''), 5000);
  };

  const setAutoSuccess = (msg) => {
    if (successTimerRef.current) clearTimeout(successTimerRef.current);
    setSuccess(msg);
    if (msg) successTimerRef.current = setTimeout(() => setSuccess(''), 5000);
  };

  useEffect(() => {
    fetchUsers();
    fetchDepartments();
    fetchDirectorates();
  }, []);

  // Directorates filtered by the selected department in the CREATE form
  const formDirectorates = useMemo(() => {
    if (!newUser.department) return [];
    const dept = departments.find(d => d.name === newUser.department);
    if (!dept) return [];
    return allDirectorates.filter(dir => dir.department_id === dept.id);
  }, [allDirectorates, departments, newUser.department]);

  const fetchDepartments = async () => {
    try {
      const res = await adminService.getDepartments();
      if (res.data.success) setDepartments(res.data.data || []);
    } catch (err) {
      // silent
    }
  };

  const fetchDirectorates = async () => {
    try {
      const res = await adminService.getDirectorates();
      if (res.data.success) setAllDirectorates(res.data.data || []);
    } catch (err) {
      // silent
    }
  };

  // Directorates filtered by currently selected department
  const filteredDirectorates = useMemo(() => {
    if (!departmentFilter) return [];
    const dept = departments.find(d => d.name === departmentFilter);
    if (!dept) return [];
    return allDirectorates.filter(dir => dir.department_id === dept.id);
  }, [allDirectorates, departments, departmentFilter]);

  const filteredUsers = useMemo(() => {
    const needle = employeeSearch.trim().toLowerCase();
    return users.filter(u => {
      const matchesDept = !departmentFilter || (u.department || '') === departmentFilter;
      if (!matchesDept) return false;
      if (!needle) return true;
      const empId = (u.employee_id || '').toLowerCase();
      const fullName = `${u.first_name || ''} ${u.middle_name || ''} ${u.last_name || ''}`.toLowerCase();
      return empId.includes(needle) || fullName.includes(needle);
    });
  }, [users, departmentFilter, employeeSearch]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get('/admin/users');
      if (res.data.success) {
        setUsers(res.data.data || []);
      }
    } catch (err) {
      setAutoError(err?.response?.data?.message || 'Error fetching users');
    } finally {
      setLoading(false);
    }
  };

  const [editForm, setEditForm] = useState(null); // null = view mode, object = edit mode
  const [confirmDelete, setConfirmDelete] = useState(null); // null or user object

  const startEditInPanel = (user) => {
    setEditForm({
      first_name: user.first_name || '',
      middle_name: user.middle_name || '',
      last_name: user.last_name || '',
      email: user.email || '',
      employee_id: user.employee_id || '',
      department: user.department || '',
      designation: user.designation || '',
      role: user.role || 'employee',
      gender: user.gender || '',
    });
  };

  const cancelEditInPanel = () => setEditForm(null);

  // Supervisor assignment
  const startAssignSupervisor = async (user) => {
    setAssigningSupervisor(true);
    setSelectedSupervisorId(user.reporting_officer_id || '');
    try {
      const res = await adminService.getSupervisors(user.department ? { department: user.department } : {});
      setAvailableSupervisors(res.data?.data || []);
    } catch (err) {
      setAvailableSupervisors([]);
    }
  };

  const saveAssignedSupervisor = async () => {
    if (!viewingUser) return;
    try {
      setActionLoading(true);
      await api.put(`/admin/users/${viewingUser.id}`, { reporting_officer_id: selectedSupervisorId || null });
      setAssigningSupervisor(false);
      setAutoSuccess('Supervisor assigned successfully');
      showToast('Supervisor assigned successfully!', 'success');
      await fetchUsers();
      const res = await api.get(`/admin/users/${viewingUser.id}`);
      if (res.data?.data) setViewingUser(res.data.data);
    } catch (err) {
      setAutoError(err?.response?.data?.message || 'Error assigning supervisor');
    } finally {
      setActionLoading(false);
    }
  };

  const saveProfile = async () => {
    if (!viewingUser || !editForm) return;
    try {
      setActionLoading(true);
      setError('');
      await api.put(`/admin/users/${viewingUser.id}`, editForm);
      setEditForm(null);
      setAutoSuccess('User profile updated successfully');
      await fetchUsers();
      // refresh the viewing user with updated data
      const res = await api.get(`/admin/users/${viewingUser.id}`);
      if (res.data.success) setViewingUser(res.data.data);
    } catch (err) {
      setAutoError(err?.response?.data?.message || 'Error updating user');
    } finally {
      setActionLoading(false);
    }
  };

  const confirmDeleteUser = async () => {
    if (!confirmDelete) return;
    try {
      setActionLoading(true);
      setError('');
      setSuccess('');
      await api.delete(`/admin/users/${confirmDelete.id}`);
      setAutoSuccess('User deleted successfully');
      setConfirmDelete(null);
      closeUserDetail();
      await fetchUsers();
    } catch (err) {
      setAutoError(err?.response?.data?.message || 'Error deleting user');
      setConfirmDelete(null);
    } finally {
      setActionLoading(false);
    }
  };

  const reviewRegistration = async (userId, status) => {
    if (!isAdmin) return;
    try {
      setActionLoading(true);
      setError('');
      setSuccess('');
      const res = await api.put(`/admin/users/${userId}/registration`, { status });
      setAutoSuccess(res.data?.message || `Registration ${status.toLowerCase()}`);
      await fetchUsers();
    } catch (err) {
      setAutoError(err?.response?.data?.message || 'Error updating registration status');
    } finally {
      setActionLoading(false);
    }
  };

  const createUser = async (e) => {
    e.preventDefault();
    if (!isAdmin) return;

    if (!newUser.national_id || !newUser.employee_id || !newUser.email || !newUser.first_name || !newUser.last_name || !newUser.gender || !newUser.date_of_birth || !newUser.department) {
      setAutoError('Please fill all required fields');
      return;
    }

    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(newUser.email)) {
      setAutoError('Invalid email address');
      return;
    }

    try {
      setActionLoading(true);
      setError('');
      setSuccess('');
      setCreatedCredentials(null);
      setCopied(false);
      const payload = { ...newUser };
      const privilegedRoles = ['supervisor', 'director', 'hr'];
      const res = privilegedRoles.includes(payload.role)
        ? await api.post('/admin/privileged-users', { ...payload, assigned_role: payload.role })
        : await api.post('/admin/users', payload);
      setNewUser(emptyUser);
      setCreating(false);

      if (res.data?.temporary_password) {
        setCreatedCredentials({
          name: `${payload.first_name} ${payload.last_name}`,
          email: res.data.user_email || payload.email,
          login_id: res.data.login_id || payload.national_id,
          employee_id: res.data.employee_id || payload.employee_id,
          password: res.data.temporary_password
        });
        setAutoSuccess('Account created successfully.');
        showToast('User account created successfully!', 'success');
      } else {
        setAutoSuccess(res.data?.message || 'User created successfully.');
        showToast(res.data?.message || 'User created successfully!', 'success');
      }
      await fetchUsers();
    } catch (err) {
      setAutoError(err?.response?.data?.message || 'Error creating user');
    } finally {
      setActionLoading(false);
    }
  };

  const openUserDetail = useCallback(async (user) => {
    setViewingUser(user);
    setViewLeaveData(null);
    setViewLeaveLoading(true);
    try {
      const res = await reportService.getLeaveBalanceReport({ year: new Date().getFullYear() });
      const allBalances = res.data.data || [];
      const userBalances = allBalances.filter(b =>
        String(b.employee_id) === String(user.employee_id)
      );
      setViewLeaveData(userBalances);
    } catch {
      setViewLeaveData([]);
    } finally {
      setViewLeaveLoading(false);
    }
  }, []);

  const closeUserDetail = () => {
    setViewingUser(null);
    setViewLeaveData(null);
  };

  if (loading) {
    return <div className="loading">Loading users...</div>;
  }

  return (
    <div className="leave-history-container admin-users-page">
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">{isAdmin ? 'User Management' : userRole === 'director' ? 'Department Directory' : 'User Directory'}</h2>
          <p className="subtitle">
            {isAdmin
              ? 'Create accounts, approve registrations, assign roles, and manage employee access'
              : userRole === 'director'
                ? 'View employees in your department and their leave details'
                : 'View employee accounts, departments, and leave details'}
          </p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        {createdCredentials && (
          <div className="cred-card">
            <div className="cred-card-top">
              <div>
                <h3 className="cred-card-title">Account Created — {createdCredentials.name}</h3>
                <p className="cred-card-subtitle">Share these login credentials with the employee. The password must be changed on first login.</p>
              </div>
              <button
                className="cred-dismiss"
                onClick={() => setCreatedCredentials(null)}
                aria-label="Dismiss"
              >&times;</button>
            </div>
            <div className="cred-grid">
              <div className="cred-field">
                <span className="cred-label">Email</span>
                <span className="cred-value">{createdCredentials.email}</span>
              </div>
              <div className="cred-field">
                <span className="cred-label">National ID (Login)</span>
                <span className="cred-value">{createdCredentials.login_id}</span>
              </div>
              <div className="cred-field">
                <span className="cred-label">Employee ID</span>
                <span className="cred-value">{createdCredentials.employee_id}</span>
              </div>
              <div className="cred-field cred-field-password">
                <span className="cred-label">Temporary Password</span>
                <span className="cred-value cred-pw">{createdCredentials.password}</span>
              </div>
            </div>
            <div className="cred-actions">
              <button
                className="btn btn-primary"
                onClick={() => {
                  const text = `Login Credentials for ${createdCredentials.name}\n\nNational ID: ${createdCredentials.login_id}\nEmployee ID: ${createdCredentials.employee_id}\nTemporary Password: ${createdCredentials.password}\n\nLogin at: ${window.location.origin}/login\nPlease change your password after first login.`;
                  navigator.clipboard.writeText(text).then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 3000);
                  });
                }}
              >
                {copied ? 'Copied to clipboard' : 'Copy credentials'}
              </button>
            </div>
          </div>
        )}

        {isAdmin && (
          <div className="admin-user-form-section">
            {!creating ? (
              <button className="btn btn-primary" type="button" onClick={() => { setCreating(true); setSuccess(''); setError(''); }}>
                Add Staff
              </button>
            ) : (
              <form onSubmit={createUser} className="admin-user-form">
                <p className="form-hint">Use this form to add Supervisors, Directors, and HR officers. Regular employees should register through the registration page.</p>
                <div className="admin-form-grid">
                  <input required placeholder="National ID" value={newUser.national_id} onChange={e => setNewUser(s => ({ ...s, national_id: e.target.value }))} />
                  <input required placeholder="Employee ID" value={newUser.employee_id} onChange={e => setNewUser(s => ({ ...s, employee_id: e.target.value }))} />
                  <input required placeholder="First name" value={newUser.first_name} onChange={e => setNewUser(s => ({ ...s, first_name: e.target.value }))} />
                  <input required placeholder="Last name" value={newUser.last_name} onChange={e => setNewUser(s => ({ ...s, last_name: e.target.value }))} />
                  <select required value={newUser.gender} onChange={e => setNewUser(s => ({ ...s, gender: e.target.value }))}>
                    <option value="">Gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                  <DateInput name="date_of_birth" value={newUser.date_of_birth} max={getTodayISO()} placeholder="Date of Birth" onChange={e => setNewUser(s => ({ ...s, date_of_birth: e.target.value }))} required />
                  <input required type="email" placeholder="Email" value={newUser.email} onChange={e => setNewUser(s => ({ ...s, email: e.target.value }))} />
                  <select required value={newUser.department} onChange={e => setNewUser(s => ({ ...s, department: e.target.value, directorate_id: '', reporting_officer_id: '' }))}>
                    <option value="">Select Department</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.name}>{d.name}</option>
                    ))}
                  </select>
                  <select value={newUser.directorate_id} onChange={e => setNewUser(s => ({ ...s, directorate_id: e.target.value }))} disabled={!newUser.department || formDirectorates.length === 0} required={newUser.role === 'director' || newUser.role === 'supervisor'}>
                    <option value="">{!newUser.department ? '— Select department first —' : formDirectorates.length === 0 ? '— No directorates —' : (newUser.role === 'director' || newUser.role === 'supervisor') ? 'Select Directorate *' : 'Select Directorate'}</option>
                    {formDirectorates.map(d => (
                      <option key={d.id} value={d.id} disabled={newUser.role === 'director' && !!d.director_id}>
                        {d.name}{d.director_id ? ` (Director: ${d.director_name})` : ''}
                      </option>
                    ))}
                  </select>
                  <select value={newUser.role} onChange={e => setNewUser(s => ({ ...s, role: e.target.value }))}>
                    <option value="supervisor">Supervisor</option>
                    <option value="director">Director</option>
                    <option value="hr">HR</option>
                  </select>
                </div>
                {(newUser.role === 'director' || newUser.role === 'supervisor') && newUser.department && (
                  <div className="director-assignment-note">
                    {newUser.role === 'director' ? (
                      newUser.directorate_id
                        ? <>This person will be assigned as the <strong>Director</strong> heading the <strong>{formDirectorates.find(d => String(d.id) === String(newUser.directorate_id))?.name || 'selected'}</strong> directorate. Each directorate can only have one director.</>
                        : <>⚠️ Please select a <strong>directorate</strong> for this director to head.</>
                    ) : (
                      newUser.directorate_id
                        ? <>This <strong>Supervisor</strong> will be assigned to the <strong>{formDirectorates.find(d => String(d.id) === String(newUser.directorate_id))?.name || 'selected'}</strong> directorate under {newUser.department}. They will manage leave for employees assigned to them.</>
                        : <>⚠️ Please select a <strong>directorate</strong> for this supervisor. Multiple supervisors can share a directorate.</>
                    )}
                  </div>
                )}
                <div className="admin-form-actions">
                  <button className="btn btn-primary" type="submit" disabled={actionLoading}>
                    {actionLoading ? 'Creating...' : 'Create Staff'}
                  </button>
                  <button className="btn btn-secondary" type="button" onClick={() => setCreating(false)} disabled={actionLoading}>
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        <div className="user-filter-bar">
          {userRole !== 'director' && (
            <>
              <select value={departmentFilter} onChange={e => { setDepartmentFilter(e.target.value); setDirectorateFilter(''); }}>
                <option value="">All departments</option>
                {departments.map(d => (
                  <option key={d.id} value={d.name}>{d.name}</option>
                ))}
              </select>
              {departmentFilter && filteredDirectorates.length > 0 && (
                <select value={directorateFilter} onChange={e => setDirectorateFilter(e.target.value)}>
                  <option value="">All directorates</option>
                  {filteredDirectorates.map(d => (
                    <option key={d.id} value={d.name}>{d.name}</option>
                  ))}
                </select>
              )}
            </>
          )}
          <input
            type="text"
            placeholder="Search by Employee No or name"
            value={employeeSearch}
            onChange={e => setEmployeeSearch(e.target.value)}
          />
          <span className="user-count">{filteredUsers.length} of {users.length} users</span>
        </div>

        {filteredUsers.length === 0 ? (
          <div className="empty-state">
            <h3>No users found</h3>
            <p>{employeeSearch || departmentFilter ? 'Try adjusting your search or filter.' : 'No employee accounts are available yet.'}</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Employee No</th>
                  <th>Name</th>
                  <th>Department</th>
                  <th>Directorate</th>
                  <th>Designation</th>
                  {isAdmin && <th>Account Status</th>}
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map(u => (
                  <tr key={u.id}>
                    <td data-label="Employee No">{u.employee_id}</td>
                    <td data-label="Name">{u.first_name} {u.middle_name ? `${u.middle_name} ` : ''}{u.last_name}</td>
                    <td data-label="Department">{u.department}</td>
                    <td data-label="Directorate">{u.directorate_name || '—'}</td>
                    <td data-label="Designation">{u.designation || '—'}</td>
                    {isAdmin && (
                      <td data-label="Account Status">
                        <span className={`account-status account-status-${String(u.registration_status || 'APPROVED').toLowerCase()}`}>
                          {formatAccountStatus(u.registration_status)}
                        </span>
                        <span className={`active-state ${u.is_active ? 'active-state-on' : 'active-state-off'}`}>
                          {u.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                    )}
                    <td className="actions-cell" data-label="Actions">
                      <button className="btn btn-primary" type="button" onClick={() => openUserDetail(u)}>View</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {viewingUser && (
        <div className="user-detail-overlay" onClick={closeUserDetail}>
          <div className="user-detail-panel" onClick={e => e.stopPropagation()}>
            <div className="user-detail-header">
              <h3>{viewingUser.first_name} {viewingUser.middle_name ? `${viewingUser.middle_name} ` : ''}{viewingUser.last_name}</h3>
              <button className="cred-dismiss" onClick={closeUserDetail} aria-label="Close">&times;</button>
            </div>

            <div className="user-detail-body">
              <section className="user-detail-section">
                <h4>{editForm ? 'Edit Profile' : 'Profile'}</h4>
                {editForm ? (
                  <div className="user-edit-form">
                    <div className="admin-form-grid">
                      <div className="edit-field">
                        <label>First Name</label>
                        <input value={editForm.first_name} onChange={e => setEditForm(f => ({ ...f, first_name: e.target.value }))} />
                      </div>
                      <div className="edit-field">
                        <label>Middle Name</label>
                        <input value={editForm.middle_name} onChange={e => setEditForm(f => ({ ...f, middle_name: e.target.value }))} />
                      </div>
                      <div className="edit-field">
                        <label>Last Name</label>
                        <input value={editForm.last_name} onChange={e => setEditForm(f => ({ ...f, last_name: e.target.value }))} />
                      </div>
                      <div className="edit-field">
                        <label>Email</label>
                        <input type="email" value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} />
                      </div>
                      <div className="edit-field">
                        <label>Employee No</label>
                        <input value={editForm.employee_id} onChange={e => setEditForm(f => ({ ...f, employee_id: e.target.value }))} />
                      </div>
                      <div className="edit-field">
                        <label>Department</label>
                        <select value={editForm.department} onChange={e => setEditForm(f => ({ ...f, department: e.target.value }))}>
                          <option value="">Select department</option>
                          {departments.map(d => (
                            <option key={d.id} value={d.name}>{d.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="edit-field">
                        <label>Designation</label>
                        <input value={editForm.designation} onChange={e => setEditForm(f => ({ ...f, designation: e.target.value }))} />
                      </div>
                      <div className="edit-field">
                        <label>Role</label>
                        <select value={editForm.role} onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))}>
                          <option value="employee">Employee</option>
                          <option value="supervisor">Supervisor</option>
                          <option value="director">Director</option>
                          <option value="hr">HR</option>
                          <option value="admin">Admin</option>
                        </select>
                      </div>
                      <div className="edit-field">
                        <label>Gender</label>
                        <select value={editForm.gender} onChange={e => setEditForm(f => ({ ...f, gender: e.target.value }))}>
                          <option value="">Select gender</option>
                          <option value="male">Male</option>
                          <option value="female">Female</option>
                        </select>
                      </div>
                    </div>
                    <div className="user-detail-action-buttons" style={{ marginTop: 16 }}>
                      <button className="btn btn-primary" type="button" onClick={saveProfile} disabled={actionLoading}>
                        {actionLoading ? 'Saving...' : 'Save Changes'}
                      </button>
                      <button className="btn btn-secondary" type="button" onClick={cancelEditInPanel} disabled={actionLoading}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="user-detail-grid">
                    <div className="user-detail-field">
                      <span className="user-detail-label">Employee No</span>
                      <span className="user-detail-value">{viewingUser.employee_id || '—'}</span>
                    </div>
                    <div className="user-detail-field">
                      <span className="user-detail-label">Email</span>
                      <span className="user-detail-value">{viewingUser.email || '—'}</span>
                    </div>
                    <div className="user-detail-field">
                      <span className="user-detail-label">Department</span>
                      <span className="user-detail-value">{viewingUser.department || '—'}</span>
                    </div>
                    <div className="user-detail-field">
                      <span className="user-detail-label">Directorate</span>
                      <span className="user-detail-value">{(() => { const dept = departments.find(d => d.name === viewingUser.department); return dept ? (allDirectorates.find(dir => dir.department_id === dept.id) || {}).name || '—' : '—'; })()}</span>
                    </div>
                    <div className="user-detail-field">
                      <span className="user-detail-label">Designation</span>
                      <span className="user-detail-value">{viewingUser.designation || '—'}</span>
                    </div>
                    <div className="user-detail-field">
                      <span className="user-detail-label">Role</span>
                      <span className="user-detail-value" style={{ textTransform: 'capitalize' }}>{viewingUser.role || '—'}</span>
                    </div>
                    <div className="user-detail-field">
                      <span className="user-detail-label">Gender</span>
                      <span className="user-detail-value" style={{ textTransform: 'capitalize' }}>{viewingUser.gender || '—'}</span>
                    </div>
                  </div>
                )}
              </section>

              <section className="user-detail-section">
                <h4>Leave Balances ({new Date().getFullYear()})</h4>
                {viewLeaveLoading ? (
                  <p className="user-detail-loading">Loading leave data...</p>
                ) : !viewLeaveData || viewLeaveData.length === 0 ? (
                  <p className="user-detail-empty">No leave balance records found for this employee.</p>
                ) : (
                  <table className="table user-detail-table">
                    <thead>
                      <tr><th>Leave Type</th><th>Allocated</th><th>Used</th><th>Remaining</th></tr>
                    </thead>
                    <tbody>
                      {viewLeaveData.map((b, i) => {
                        const allocated = (b.used_days || 0) + (b.remaining_days || 0);
                        return (
                          <tr key={`${b.leave_type}-${i}`}>
                            <td>{b.leave_type}</td>
                            <td>{allocated}</td>
                            <td>{b.used_days || 0}</td>
                            <td><strong>{b.remaining_days || 0}</strong></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </section>

              {/* Supervisor Assignment Section */}
              {isAdmin && !['admin'].includes(viewingUser.role) && (
                <section className="user-detail-section">
                  <h4>Supervisor Assignment</h4>
                  {assigningSupervisor ? (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <select
                        value={selectedSupervisorId}
                        onChange={e => setSelectedSupervisorId(e.target.value)}
                        style={{ flex: 1, minWidth: 200, padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14 }}
                      >
                        <option value="">— No Supervisor —</option>
                        {availableSupervisors.map(s => (
                          <option key={s.id} value={s.id}>
                            {s.first_name} {s.last_name}{s.directorate_name ? ` (${s.directorate_name})` : ''}
                          </option>
                        ))}
                      </select>
                      <button className="btn btn-primary" type="button" onClick={saveAssignedSupervisor} disabled={actionLoading} style={{ padding: '8px 16px', fontSize: 13 }}>
                        {actionLoading ? 'Saving...' : 'Save'}
                      </button>
                      <button className="btn btn-secondary" type="button" onClick={() => setAssigningSupervisor(false)} style={{ padding: '8px 16px', fontSize: 13 }}>Cancel</button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: 14, color: '#374151' }}>
                        {viewingUser.supervisor_name || viewingUser.reporting_officer_name || <em style={{ color: '#9ca3af' }}>Not assigned</em>}
                      </span>
                      <button className="btn btn-secondary" type="button" onClick={() => startAssignSupervisor(viewingUser)} style={{ padding: '6px 14px', fontSize: 12 }}>
                        {viewingUser.reporting_officer_id ? 'Change Supervisor' : 'Assign Supervisor'}
                      </button>
                    </div>
                  )}
                </section>
              )}

              {isAdmin && !editForm && (
                <section className="user-detail-section user-detail-actions-section">
                  <h4>Actions</h4>
                  <div className="user-detail-action-buttons">
                    {String(viewingUser.registration_status || '').toUpperCase() === 'PENDING_APPROVAL' && (
                      <>
                        <button className="btn btn-primary" type="button" onClick={() => { reviewRegistration(viewingUser.id, 'APPROVED'); closeUserDetail(); }} disabled={actionLoading}>Approve Registration</button>
                        <button className="btn btn-secondary" type="button" onClick={() => { reviewRegistration(viewingUser.id, 'REJECTED'); closeUserDetail(); }} disabled={actionLoading}>Reject Registration</button>
                      </>
                    )}
                    <button className="btn btn-primary" type="button" onClick={() => startEditInPanel(viewingUser)} disabled={actionLoading}>Edit User</button>
                    <button className="btn btn-danger" type="button" onClick={() => setConfirmDelete(viewingUser)} disabled={actionLoading}>Delete User</button>
                  </div>
                </section>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <div className="user-detail-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="delete-confirm-modal" onClick={e => e.stopPropagation()}>
            <div className="delete-confirm-icon">⚠️</div>
            <h3>Confirm Deletion</h3>
            <p>Are you sure you want to delete <strong>{confirmDelete.first_name} {confirmDelete.last_name}</strong>?</p>
            <p className="delete-confirm-warning">This action cannot be undone. All user data, leave balances, and notifications will be permanently removed.</p>
            <div className="delete-confirm-actions">
              <button className="btn btn-danger" type="button" onClick={confirmDeleteUser} disabled={actionLoading}>
                {actionLoading ? 'Deleting...' : 'Yes, Delete User'}
              </button>
              <button className="btn btn-secondary" type="button" onClick={() => setConfirmDelete(null)} disabled={actionLoading}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .admin-users-page .subtitle {
          margin: 6px 0 0;
          color: var(--dark-gray);
          font-size: 14px;
        }

        .admin-user-form-section {
          margin-bottom: 20px;
        }

        .admin-user-form {
          margin-top: 12px;
        }

        .form-hint {
          margin: 0 0 12px;
          color: var(--dark-gray);
          font-size: 13px;
        }

        .admin-form-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 10px;
        }

        .admin-form-grid input,
        .admin-form-grid select {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid #d0d5dd;
          border-radius: 8px;
          font-size: 14px;
        }

        .admin-form-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 12px;
        }

        .director-assignment-note {
          grid-column: 1 / -1;
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          border-left: 4px solid #2563eb;
          border-radius: 8px;
          padding: 12px 16px;
          font-size: 13px;
          color: #1e3a5f;
          line-height: 1.5;
        }

        /* Filter bar */
        .user-filter-bar {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 16px;
          flex-wrap: wrap;
        }

        .user-filter-bar select,
        .user-filter-bar input {
          height: 38px;
          padding: 6px 12px;
          border: 1px solid #d0d5dd;
          border-radius: 8px;
          font-size: 13px;
          font-family: inherit;
          min-width: 180px;
        }

        .user-filter-bar input {
          flex: 1;
          min-width: 220px;
        }

        .user-filter-bar select:focus,
        .user-filter-bar input:focus {
          outline: none;
          border-color: var(--county-blue);
          box-shadow: 0 0 0 2px rgba(45, 107, 176, 0.08);
        }

        .user-count {
          font-size: 12px;
          color: var(--dark-gray);
          font-weight: 600;
          white-space: nowrap;
        }

        .account-status,
        .active-state {
          display: inline-flex;
          align-items: center;
          min-height: 24px;
          padding: 4px 8px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 700;
          line-height: 1.2;
          white-space: nowrap;
        }

        .account-status {
          margin-right: 6px;
          background: #eef2ff;
          color: #3730a3;
        }

        .account-status-pending_approval,
        .account-status-pending_hr_approval {
          background: #fff7ed;
          color: #9a3412;
        }

        .account-status-approved {
          background: #ecfdf3;
          color: #027a48;
        }

        .account-status-rejected {
          background: #fef3f2;
          color: #b42318;
        }

        .active-state-on {
          background: #E8F5E9;
          color: #166534;
        }

        .active-state-off {
          background: #f8fafc;
          color: #475569;
        }

        /* User Detail Panel */
        .user-detail-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.4);
          display: flex;
          justify-content: flex-end;
          z-index: 1000;
        }

        .user-detail-panel {
          width: 480px;
          max-width: 90vw;
          height: 100vh;
          background: #fff;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          box-shadow: -4px 0 24px rgba(0, 0, 0, 0.12);
        }

        .user-detail-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 24px;
          border-bottom: 1px solid #e5e7eb;
          flex-shrink: 0;
        }

        .user-detail-header h3 {
          margin: 0;
          font-size: 17px;
          font-weight: 700;
          color: #1f2937;
        }

        .user-detail-body {
          flex: 1;
          overflow-y: auto;
          padding: 24px;
        }

        .user-detail-section {
          margin-bottom: 28px;
        }

        .user-detail-section:last-child {
          margin-bottom: 0;
        }

        .user-detail-section h4 {
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: var(--dark-gray);
          margin: 0 0 14px;
          padding-bottom: 8px;
          border-bottom: 1px solid #f1f5f9;
        }

        .user-detail-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        .user-detail-field {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .user-detail-label {
          font-size: 11px;
          font-weight: 600;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }

        .user-detail-value {
          font-size: 14px;
          font-weight: 600;
          color: #1f2937;
          word-break: break-word;
        }

        .user-detail-table {
          box-shadow: none;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          overflow: hidden;
        }

        .user-detail-loading,
        .user-detail-empty {
          font-size: 13px;
          color: var(--dark-gray);
          padding: 16px;
          text-align: center;
          background: #f8fafc;
          border-radius: 8px;
          border: 1px dashed #d0d5dd;
          margin: 0;
        }

        /* Credentials Card */
        .cred-card {
          margin: 16px 0;
          background: #ffffff;
          border: 1px solid #d0d5dd;
          border-radius: 10px;
          overflow: hidden;
        }

        .cred-card-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          padding: 18px 20px 14px;
          border-bottom: 1px solid #e5e7eb;
          background: #f9fafb;
        }

        .cred-card-title {
          margin: 0 0 4px;
          font-size: 15px;
          font-weight: 700;
          color: #1f2937;
        }

        .cred-card-subtitle {
          margin: 0;
          font-size: 13px;
          color: #6b7280;
          line-height: 1.4;
        }

        .cred-dismiss {
          background: none;
          border: none;
          color: #9ca3af;
          cursor: pointer;
          font-size: 22px;
          line-height: 1;
          padding: 2px 6px;
          border-radius: 4px;
          flex-shrink: 0;
        }

        .cred-dismiss:hover {
          background: #f3f4f6;
          color: #374151;
        }

        .cred-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0;
        }

        .cred-field {
          display: flex;
          flex-direction: column;
          gap: 4px;
          padding: 14px 20px;
          border-bottom: 1px solid #f3f4f6;
          border-right: 1px solid #f3f4f6;
        }

        .cred-field:nth-child(2n) {
          border-right: none;
        }

        .cred-field-password {
          grid-column: 1 / -1;
          border-right: none;
          background: #f0fdf4;
          border-bottom: none;
        }

        .cred-label {
          font-size: 11px;
          font-weight: 600;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.4px;
        }

        .cred-value {
          font-size: 14px;
          color: #111827;
          font-weight: 600;
          word-break: break-all;
        }

        .cred-pw {
          font-family: 'SF Mono', 'Consolas', 'Monaco', monospace;
          font-size: 15px;
          color: #166534;
          letter-spacing: 0.8px;
        }

        .cred-actions {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 20px;
          border-top: 1px solid #e5e7eb;
        }

        @media (max-width: 768px) {
          .admin-form-actions .btn {
            flex: 1 1 140px;
          }

          .cred-grid {
            grid-template-columns: 1fr;
          }

          .cred-field {
            border-right: none;
          }

          .user-detail-grid {
            grid-template-columns: 1fr;
          }
        }

        .user-detail-actions-section {
          border-top: 2px solid #e5e7eb;
          padding-top: 16px;
          margin-top: 8px;
        }

        .user-detail-action-buttons {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 10px;
        }

        .user-detail-action-buttons .btn {
          min-width: 140px;
        }

        .edit-field {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .edit-field label {
          font-size: 12px;
          font-weight: 600;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }

        .user-edit-form .admin-form-grid {
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        }

        .delete-confirm-modal {
          background: #fff;
          border-radius: 16px;
          padding: 32px;
          max-width: 440px;
          width: 90%;
          text-align: center;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }

        .delete-confirm-icon {
          font-size: 48px;
          margin-bottom: 12px;
        }

        .delete-confirm-modal h3 {
          font-size: 20px;
          font-weight: 700;
          color: #111827;
          margin: 0 0 8px;
        }

        .delete-confirm-modal p {
          color: #4b5563;
          font-size: 14px;
          margin: 0 0 8px;
          line-height: 1.5;
        }

        .delete-confirm-warning {
          color: #dc2626 !important;
          font-size: 13px !important;
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 8px;
          padding: 10px 14px;
          margin-top: 12px !important;
          margin-bottom: 20px !important;
        }

        .delete-confirm-actions {
          display: flex;
          gap: 10px;
          justify-content: center;
          margin-top: 8px;
        }

        .delete-confirm-actions .btn {
          min-width: 130px;
        }
      `}</style>
    </div>
  );
}

export default AdminUsersPage;
