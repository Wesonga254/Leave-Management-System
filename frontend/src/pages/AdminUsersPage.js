import React, { useEffect, useState } from 'react';
import api from '../services/api';
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
  reporting_officer_id: '',
  role: 'employee'
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
  const userRole = localStorage.getItem('userRole') || 'employee';
  const canManageUsers = userRole === 'admin';

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get('/admin/users');
      if (res.data.success) {
        setUsers(res.data.data || []);
      }
    } catch (err) {
      setError(err?.response?.data?.message || 'Error fetching users');
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (user) => {
    if (!canManageUsers) return;
    setEditing(user.id);
    setRoleValue(user.role || 'employee');
    setSuccess('');
  };

  const cancelEdit = () => {
    setEditing(null);
    setRoleValue('');
  };

  const saveRole = async (userId) => {
    if (!canManageUsers) return;
    try {
      setActionLoading(true);
      setError('');
      await api.put(`/admin/users/${userId}`, { role: roleValue });
      await fetchUsers();
      setEditing(null);
      setSuccess('User role updated successfully');
    } catch (err) {
      setError(err?.response?.data?.message || 'Error updating role');
    } finally {
      setActionLoading(false);
    }
  };

  const deleteUser = async (userId) => {
    if (!canManageUsers) return;
    if (!window.confirm('Delete this user? This action cannot be undone.')) return;
    try {
      setActionLoading(true);
      setError('');
      setSuccess('');
      await api.delete(`/admin/users/${userId}`);
      setSuccess('User deleted successfully');
      await fetchUsers();
    } catch (err) {
      setError(err?.response?.data?.message || 'Error deleting user');
    } finally {
      setActionLoading(false);
    }
  };

  const createUser = async (e) => {
    e.preventDefault();
    if (!canManageUsers) return;

    if (!newUser.national_id || !newUser.employee_id || !newUser.email || !newUser.first_name || !newUser.last_name || !newUser.gender || !newUser.date_of_birth || !newUser.department) {
      setError('Please fill all required fields');
      return;
    }

    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(newUser.email)) {
      setError('Invalid email address');
      return;
    }

    try {
      setActionLoading(true);
      setError('');
      setSuccess('');
      const payload = { ...newUser };
      if (!payload.reporting_officer_id) delete payload.reporting_officer_id;
      const res = await api.post('/admin/users', payload);
      setNewUser(emptyUser);
      setCreating(false);
      setSuccess(res.data?.message || 'User created successfully. Login credentials have been emailed.');
      await fetchUsers();
    } catch (err) {
      setError(err?.response?.data?.message || 'Error creating user');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading users...</div>;
  }

  return (
    <div className="leave-history-container admin-users-page">
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">User Management</h2>
          <p className="subtitle">Create accounts, assign roles, and manage employee access</p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        {canManageUsers && (
          <div className="admin-user-form-section">
            {!creating ? (
              <button className="btn btn-primary" type="button" onClick={() => { setCreating(true); setSuccess(''); setError(''); }}>
                Add User
              </button>
            ) : (
              <form onSubmit={createUser} className="admin-user-form">
                <p className="form-hint">A temporary password will be generated and emailed to the user automatically.</p>
                <div className="admin-form-grid">
                  <input required placeholder="National ID" value={newUser.national_id} onChange={e => setNewUser(s => ({ ...s, national_id: e.target.value }))} />
                  <input required placeholder="Employee ID" value={newUser.employee_id} onChange={e => setNewUser(s => ({ ...s, employee_id: e.target.value }))} />
                  <input required placeholder="First name" value={newUser.first_name} onChange={e => setNewUser(s => ({ ...s, first_name: e.target.value }))} />
                  <input required placeholder="Last name" value={newUser.last_name} onChange={e => setNewUser(s => ({ ...s, last_name: e.target.value }))} />
                  <select required value={newUser.gender} onChange={e => setNewUser(s => ({ ...s, gender: e.target.value }))}>
                    <option value="">Gender</option>
                    <option value="female">Female</option>
                    <option value="male">Male</option>
                    <option value="other">Other</option>
                    <option value="prefer_not_to_say">Prefer not to say</option>
                  </select>
                  <input required type="date" value={newUser.date_of_birth} onChange={e => setNewUser(s => ({ ...s, date_of_birth: e.target.value }))} />
                  <input required type="email" placeholder="Email" value={newUser.email} onChange={e => setNewUser(s => ({ ...s, email: e.target.value }))} />
                  <input required placeholder="Department" value={newUser.department} onChange={e => setNewUser(s => ({ ...s, department: e.target.value }))} />
                  <select value={newUser.role} onChange={e => setNewUser(s => ({ ...s, role: e.target.value }))}>
                    <option value="employee">employee</option>
                    <option value="supervisor">supervisor</option>
                    <option value="hr">hr</option>
                    <option value="chief_officer">chief_officer</option>
                    <option value="admin">admin</option>
                  </select>
                </div>
                <div className="admin-form-actions">
                  <button className="btn btn-primary" type="submit" disabled={actionLoading}>
                    {actionLoading ? 'Creating...' : 'Create User'}
                  </button>
                  <button className="btn btn-secondary" type="button" onClick={() => setCreating(false)} disabled={actionLoading}>
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {users.length === 0 ? (
          <div className="empty-state">
            <h3>No users found</h3>
            <p>{canManageUsers ? 'Create the first user account to get started.' : 'No employee accounts are available yet.'}</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Employee ID</th>
                  <th>Department</th>
                  <th>Role</th>
                  {canManageUsers && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td data-label="ID">{u.id}</td>
                    <td data-label="Name">{u.first_name} {u.middle_name ? `${u.middle_name} ` : ''}{u.last_name}</td>
                    <td data-label="Employee ID">{u.employee_id}</td>
                    <td data-label="Department">{u.department}</td>
                    <td data-label="Role">
                      {editing === u.id ? (
                        <select value={roleValue} onChange={(e) => setRoleValue(e.target.value)}>
                          <option value="employee">employee</option>
                          <option value="supervisor">supervisor</option>
                          <option value="hr">hr</option>
                          <option value="chief_officer">chief_officer</option>
                          <option value="admin">admin</option>
                        </select>
                      ) : (
                        <strong>{u.role}</strong>
                      )}
                    </td>
                    {canManageUsers && (
                      <td className="actions-cell" data-label="Actions">
                        {editing === u.id ? (
                          <div className="actions-buttons">
                            <button className="btn btn-primary" type="button" onClick={() => saveRole(u.id)} disabled={actionLoading}>Save</button>
                            <button className="btn btn-secondary" type="button" onClick={cancelEdit} disabled={actionLoading}>Cancel</button>
                          </div>
                        ) : (
                          <div className="actions-buttons">
                            <button className="btn btn-primary" type="button" onClick={() => startEdit(u)} disabled={actionLoading}>Edit</button>
                            <button className="btn btn-danger" type="button" onClick={() => deleteUser(u.id)} disabled={actionLoading}>Delete</button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

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

        @media (max-width: 768px) {
          .admin-form-actions .btn {
            flex: 1 1 140px;
          }
        }
      `}</style>
    </div>
  );
}

export default AdminUsersPage;
