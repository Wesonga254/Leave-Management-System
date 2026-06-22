const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const authController = require('../controllers/authController');
const { authenticateToken, authorizeExactRole } = require('../middleware/auth');

// All admin routes require authentication and admin role
router.use(authenticateToken);

// Users management
router.get('/users', authorizeExactRole('hr', 'admin', 'director'), adminController.listUsers);
router.get('/users/:id', authorizeExactRole('hr', 'admin', 'director'), adminController.getUser);
router.put('/users/:id/registration', authorizeExactRole('admin'), adminController.reviewRegistration);
router.put('/users/:id', authorizeExactRole('hr', 'admin'), adminController.updateUser);
router.delete('/users/:id', authorizeExactRole('admin'), adminController.deleteUser);
// Admin can create users
router.post('/users', authorizeExactRole('admin'), async (req, res) => authController.registerUser(req, res));
router.post('/privileged-users', authorizeExactRole('admin'), adminController.createPrivilegedAccount);

// Departments listing (for dropdowns)
router.get('/departments', authorizeExactRole('hr', 'admin', 'director'), async (req, res) => {
  try {
    const { getDatabase } = require('../database');
    const db = getDatabase();
    const departments = await db.all('SELECT id, name FROM departments ORDER BY name');
    res.json({ success: true, data: departments });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Directorates listing (child of departments)
router.get('/directorates', authorizeExactRole('hr', 'admin', 'director'), async (req, res) => {
  try {
    const { getDatabase } = require('../database');
    const db = getDatabase();
    const { department_id } = req.query;
    let query = `SELECT d.id, d.name, d.department_id, dep.name as department_name,
                        d.director_id,
                        u.first_name || ' ' || u.last_name as director_name
                 FROM directorates d
                 JOIN departments dep ON d.department_id = dep.id
                 LEFT JOIN users u ON d.director_id = u.id`;
    const params = [];
    if (department_id) {
      query += ' WHERE d.department_id = ?';
      params.push(department_id);
    }
    query += ' ORDER BY dep.name, d.name';
    const directorates = await db.all(query, params);
    res.json({ success: true, data: directorates });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Supervisors listing (for assignment dropdowns)
router.get('/supervisors', authorizeExactRole('hr', 'admin'), async (req, res) => {
  try {
    const { getDatabase } = require('../database');
    const db = getDatabase();
    const { department, directorate_id } = req.query;
    let query = `SELECT u.id, u.first_name, u.last_name, u.employee_id, u.department, u.directorate_id,
                        d.name as directorate_name
                 FROM users u
                 LEFT JOIN directorates d ON u.directorate_id = d.id
                 WHERE u.role = 'supervisor'`;
    const params = [];
    if (department) {
      query += ' AND LOWER(u.department) = LOWER(?)';
      params.push(department);
    }
    if (directorate_id) {
      query += ' AND u.directorate_id = ?';
      params.push(directorate_id);
    }
    query += ' ORDER BY u.first_name, u.last_name';
    const supervisors = await db.all(query, params);
    res.json({ success: true, data: supervisors });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Holidays management
router.get('/holidays', authorizeExactRole('admin'), async (req, res) => adminController.listHolidays(req, res));
router.post('/holidays', authorizeExactRole('admin'), async (req, res) => adminController.addHoliday(req, res));
router.delete('/holidays/:id', authorizeExactRole('admin'), async (req, res) => adminController.deleteHoliday(req, res));

// Leave types management (admin only)
router.get('/leave-types', authorizeExactRole('admin'), async (req, res) => adminController.listLeaveTypesAdmin(req, res));
router.post('/leave-types', authorizeExactRole('admin'), async (req, res) => adminController.addLeaveType(req, res));
router.put('/leave-types/:id', authorizeExactRole('admin'), async (req, res) => adminController.updateLeaveType(req, res));
router.delete('/leave-types/:id', authorizeExactRole('admin'), async (req, res) => adminController.deleteLeaveType(req, res));

// Settings (admin only)
router.get('/settings', authorizeExactRole('admin'), async (req, res) => adminController.listSettings(req, res));
router.put('/settings/:key', authorizeExactRole('admin'), async (req, res) => adminController.updateSetting(req, res));

// Leave year carry-forward
router.post('/carry-forward/run', authorizeExactRole('admin'), adminController.runCarryForwardNow);
router.get('/carry-forward/log', authorizeExactRole('admin'), adminController.listCarryForwardLog);

// System Activity Log (audit trail)
router.get('/activity-log', authorizeExactRole('admin'), async (req, res) => {
  try {
    const { getDatabase } = require('../database');
    const db = getDatabase();

    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const offset = (page - 1) * limit;
    const category = req.query.category || '';
    const search = req.query.search || '';
    const dateFrom = req.query.date_from || '';
    const dateTo = req.query.date_to || '';

    let where = '1=1';
    const params = [];

    if (category) {
      where += ' AND category = ?';
      params.push(category);
    }
    if (search) {
      where += ' AND (action LIKE ? OR user_name LIKE ? OR details LIKE ?)';
      const q = `%${search}%`;
      params.push(q, q, q);
    }
    if (dateFrom) {
      where += ' AND created_at >= ?';
      params.push(dateFrom);
    }
    if (dateTo) {
      where += ' AND created_at <= ?';
      params.push(dateTo + ' 23:59:59');
    }

    const countRow = await db.get(`SELECT COUNT(*) as total FROM activity_log WHERE ${where}`, params);
    const total = countRow?.total || 0;

    const rows = await db.all(
      `SELECT * FROM activity_log WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    // Get distinct categories for filter dropdown
    const categories = await db.all('SELECT DISTINCT category FROM activity_log ORDER BY category');

    res.json({
      success: true,
      data: rows,
      categories: categories.map(c => c.category),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Clear activity log (admin only)
router.delete('/activity-log', authorizeExactRole('admin'), async (req, res) => {
  try {
    const { getDatabase } = require('../database');
    const db = getDatabase();
    const result = await db.run('DELETE FROM activity_log');
    res.json({ success: true, message: `Activity log cleared (${result.changes} entries removed)` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
