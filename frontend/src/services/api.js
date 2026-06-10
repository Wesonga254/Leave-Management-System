import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // Remove Content-Type header for FormData to let the browser set it with proper boundary
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }
  return config;
});

export const authService = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  getCurrentUser: () => api.get('/auth/me'),
  updateCurrentUser: (data) => api.put('/auth/me', data),
  changePassword: (data) => api.put('/auth/me/password', data)
};

export const leaveService = {
  submitApplication: (data) => api.post('/leave/applications', data),
  getApplications: (params) => api.get('/leave/applications', { params }),
  getApplicationById: (id) => api.get(`/leave/applications/${id}`),
  editApplication: (id, data) => api.patch(`/leave/applications/${id}`, data),
  downloadApplication: (id) => api.get(`/leave/applications/${id}/download`, { responseType: 'blob' }),
  updateApplicationStatus: (id, data) => api.put(`/leave/applications/${id}`, data),
  cancelApplication: (id) => api.delete(`/leave/applications/${id}`),
  getLeaveTypes: () => api.get('/leave/types'),
  getLeaveBalance: () => api.get('/leave/balance'),
  getCarryoverData: () => api.get('/leave/balance/carryover'),
  getAnalyticsTrends: (year) => api.get('/leave/analytics/trends', { params: { year } }),
  getTeamStats: (year) => api.get('/leave/analytics/team-stats', { params: { year } })
};

export const reportService = {
  getEmployeeHistory: (params) => api.get('/reports/employee-history', { params }),
  getDepartmentReport: (params) => api.get('/reports/department', { params }),
  getLeaveBalanceReport: (params) => api.get('/reports/balance', { params }),
  getPendingApprovals: (params) => api.get('/reports/pending-approvals', { params }),
  getMyApprovals: (params) => api.get('/approval/mine', { params }),
  getDelegates: () => api.get('/approval/delegates'),
  getMonthlyTrends: (params) => api.get('/reports/monthly-trends', { params }),
  getSummaryReport: (params) => api.get('/reports/summary', { params })
};

export const attachmentService = {
  uploadAttachment: (formData) => api.post('/attachments/upload', formData),
  getAttachments: (applicationId) => api.get(`/attachments/application/${applicationId}`),
  deleteAttachment: (attachmentId) => api.delete(`/attachments/${attachmentId}`),
  downloadAttachment: (attachmentId) => api.get(`/attachments/download/${attachmentId}`, { responseType: 'blob' })
};

export const workflowService = {
  delegate: (data) => api.post('/workflow/delegate', data),
  runEscalation: () => api.post('/workflow/escalate/run')
};

export const adminService = {
  getHolidays: () => api.get('/admin/holidays'),
  addHoliday: (data) => api.post('/admin/holidays', data),
  deleteHoliday: (id) => api.delete(`/admin/holidays/${id}`)
};

export const notificationService = {
  getMyNotifications: (params) => api.get('/notifications', { params }),
  markRead: (id) => api.put(`/notifications/${id}/read`)
};

// Leave types admin
adminService.getLeaveTypes = () => api.get('/admin/leave-types');
adminService.addLeaveType = (data) => api.post('/admin/leave-types', data);
adminService.deleteLeaveType = (id) => api.delete(`/admin/leave-types/${id}`);
adminService.getSettings = () => api.get('/admin/settings');
adminService.updateSetting = (key, data) => api.put(`/admin/settings/${key}`, data);

export default api;
