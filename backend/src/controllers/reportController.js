const { getDatabase } = require('../database');

const getDirectorDepartment = async (db, directorId) => {
  // First check directorates (preferred — directorate-scoped)
  const directorate = await db.get(
    `SELECT dir.id, dir.name, dir.department_id
     FROM directorates dir
     WHERE dir.director_id = ?
     LIMIT 1`,
    [directorId]
  );
  if (directorate) {
    return { id: directorate.department_id, name: directorate.name, directorate_id: directorate.id };
  }
  // Fallback to departments.director_id
  return db.get(
    `SELECT d.id, d.name
     FROM departments d
     WHERE d.director_id = ?
     LIMIT 1`,
    [directorId]
  );
};

// Employee Leave History Report
const getEmployeeLeaveHistory = async (req, res) => {
  try {
    const db = getDatabase();
    const { employeeId, startDate, endDate } = req.query;

    let query = `
      SELECT 
        la.id,
        la.start_date,
        la.end_date,
        la.number_of_days,
        la.requested_days,
        la.approved_days,
        la.reason,
        la.status,
        aw.comments as approval_comments,
        aw.approved_at,
        lt.name as leave_type,
        u.first_name,
        u.last_name,
        u.employee_id,
        la.created_at,
        la.updated_at
      FROM leave_applications la
      JOIN users u ON la.user_id = u.id
      JOIN leave_types lt ON la.leave_type_id = lt.id
      LEFT JOIN approval_workflow aw ON aw.leave_application_id = la.id
      WHERE 1=1
    `;

    const params = [];

    if (employeeId) {
      query += ` AND u.employee_id = ?`;
      params.push(employeeId);
    }

    if (startDate) {
      query += ` AND la.start_date >= ?`;
      params.push(startDate);
    }

    if (endDate) {
      query += ` AND la.end_date <= ?`;
      params.push(endDate);
    }

    query += ` ORDER BY la.start_date DESC`;

    const history = await db.all(query, params);
    res.json({
      success: true,
      data: history,
      count: history.length
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Department Leave Report
const getDepartmentLeaveReport = async (req, res) => {
  try {
    const db = getDatabase();
    const { department, year } = req.query;
    const currentYear = year || new Date().getFullYear();

    let query = `
      SELECT 
        u.department,
        COUNT(DISTINCT u.id) as total_employees,
        COUNT(DISTINCT CASE WHEN la.status = 'approved' THEN la.id END) as approved_leaves,
        SUM(CASE WHEN la.status = 'approved' THEN la.number_of_days ELSE 0 END) as total_days_approved,
        COUNT(DISTINCT CASE WHEN la.status = 'pending' THEN la.id END) as pending_leaves,
        COUNT(DISTINCT CASE WHEN la.status = 'rejected' THEN la.id END) as rejected_leaves,
        lt.name as leave_type
      FROM users u
      LEFT JOIN leave_applications la ON u.id = la.user_id
      LEFT JOIN leave_types lt ON la.leave_type_id = lt.id
      WHERE STRFTIME('%Y', la.start_date) = ? OR la.start_date IS NULL
    `;

    const params = [currentYear.toString()];

    // Scope to director's department
    if (req.user.role === 'director') {
      const dirDept = await getDirectorDepartment(db, req.user.id);
      if (dirDept) {
        query += ` AND u.department_id = ?`;
        params.push(dirDept.id);
      }
    } else if (department) {
      query += ` AND u.department = ?`;
      params.push(department);
    }

    query += ` GROUP BY u.department, lt.name
               ORDER BY u.department, lt.name`;

    const report = await db.all(query, params);
    res.json({
      success: true,
      data: report,
      year: currentYear
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Leave Balance Report
const getLeaveBalanceReport = async (req, res) => {
  try {
    const db = getDatabase();
    const { department, year } = req.query;
    const currentYear = year || new Date().getFullYear();

    let query = `
      SELECT 
        u.id,
        u.employee_id,
        u.first_name,
        u.last_name,
        u.gender,
        u.department,
        u.designation,
        lt.name as leave_type,
        lt.applicable_gender,
        lb.total_days,
        lb.used_days,
        lb.remaining_days,
        lb.year
      FROM leave_balance lb
      JOIN users u ON lb.user_id = u.id
      JOIN leave_types lt ON lb.leave_type_id = lt.id
      WHERE lb.year = ?
        AND (
          lt.applicable_gender = 'All'
          OR LOWER(lt.applicable_gender) = LOWER(u.gender)
        )
    `;

    const params = [currentYear];

    // Scope to director's department
    if (req.user.role === 'director') {
      const dirDept = await getDirectorDepartment(db, req.user.id);
      if (dirDept) {
        query += ` AND u.department_id = ?`;
        params.push(dirDept.id);
      }
    } else if (department) {
      query += ` AND u.department = ?`;
      params.push(department);
    }

    query += ` ORDER BY u.department, u.first_name`;

    const balances = await db.all(query, params);
    res.json({
      success: true,
      data: balances,
      year: currentYear
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Pending Approval Report
const getPendingApprovalReport = async (req, res) => {
  try {
    const db = getDatabase();
    const { department, approvalLevel } = req.query;

    let query = `
      SELECT 
        la.id,
        la.start_date,
        la.end_date,
        la.number_of_days,
        la.requested_days,
        la.approved_days,
        la.reason,
        la.status,
        lt.name as leave_type,
        u.employee_id,
        u.first_name,
        u.last_name,
        u.department,
        aw.approval_level,
        aw.status as approval_status,
        aw.comments as approval_comments,
        aw.created_at as submitted_date,
        lb.total_days as balance_total_days,
        lb.used_days as balance_used_days,
        lb.remaining_days as balance_remaining_days,
        CAST(julianday('now') - julianday(aw.created_at) AS INTEGER) as days_pending
      FROM leave_applications la
      JOIN users u ON la.user_id = u.id
      JOIN leave_types lt ON la.leave_type_id = lt.id
      JOIN approval_workflow aw ON la.id = aw.leave_application_id
      LEFT JOIN leave_balance lb ON lb.user_id = la.user_id
        AND lb.leave_type_id = la.leave_type_id
        AND lb.year = CAST(STRFTIME('%Y', la.start_date) AS INTEGER)
      WHERE la.status = 'pending' AND aw.status = 'pending'
    `;

    const params = [];

    if (department) {
      query += ` AND u.department = ?`;
      params.push(department);
    }

    if (approvalLevel) {
      query += ` AND aw.approval_level = ?`;
      params.push(approvalLevel);
    }

    query += ` ORDER BY aw.created_at ASC`;

    const pending = await db.all(query, params);
    res.json({
      success: true,
      data: pending,
      count: pending.length
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Monthly Leave Trends Report
const getMonthlyLeaveTrends = async (req, res) => {
  try {
    const db = getDatabase();
    const { year, department } = req.query;
    const currentYear = year || new Date().getFullYear();

    let query = `
      SELECT 
        CAST(STRFTIME('%m', la.start_date) AS INTEGER) as month,
        COUNT(DISTINCT la.id) as total_applications,
        COUNT(DISTINCT CASE WHEN la.status = 'approved' THEN la.id END) as approved_count,
        COUNT(DISTINCT CASE WHEN la.status = 'rejected' THEN la.id END) as rejected_count,
        COUNT(DISTINCT CASE WHEN la.status = 'pending' THEN la.id END) as pending_count,
        SUM(CASE WHEN la.status = 'approved' THEN la.number_of_days ELSE 0 END) as approved_days,
        lt.name as leave_type,
        u.department
      FROM leave_applications la
      JOIN users u ON la.user_id = u.id
      JOIN leave_types lt ON la.leave_type_id = lt.id
      WHERE STRFTIME('%Y', la.start_date) = ?
    `;

    const params = [currentYear.toString()];

    // Scope to director's department
    if (req.user.role === 'director') {
      const dirDept = await getDirectorDepartment(db, req.user.id);
      if (dirDept) {
        query += ` AND u.department_id = ?`;
        params.push(dirDept.id);
      }
    } else if (department) {
      query += ` AND u.department = ?`;
      params.push(department);
    }

    query += ` GROUP BY month, lt.name, u.department
               ORDER BY month ASC, lt.name`;

    const trends = await db.all(query, params);

    const formattedTrends = trends.map(trend => ({
      ...trend,
      month_name: new Date(currentYear, trend.month - 1).toLocaleString('default', { month: 'long' })
    }));

    res.json({
      success: true,
      data: formattedTrends,
      year: currentYear
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Summary Dashboard Report
const getSummaryDashboard = async (req, res) => {
  try {
    const db = getDatabase();
    const currentYear = new Date().getFullYear();
    const yr = currentYear.toString();

    // For directors, scope to their department only
    if (req.user.role === 'director') {
      const dirDept = await getDirectorDepartment(db, req.user.id);
      if (dirDept) {
        const summary = await db.get(`
          SELECT
            (SELECT COUNT(*) FROM users WHERE department_id = ?) as total_users,
            (SELECT COUNT(*) FROM users WHERE department_id = ? AND role = 'employee') as total_employees,
            (SELECT COUNT(*) FROM leave_applications la JOIN users u ON la.user_id = u.id WHERE u.department_id = ?) as total_applications,
            (SELECT COUNT(*) FROM leave_applications la JOIN users u ON la.user_id = u.id WHERE u.department_id = ? AND la.status = 'approved' AND STRFTIME('%Y', la.start_date) = ?) as total_approved_leaves,
            (SELECT COUNT(*) FROM leave_applications la JOIN users u ON la.user_id = u.id WHERE u.department_id = ? AND la.status = 'pending') as pending_approvals,
            (SELECT COUNT(*) FROM leave_applications la JOIN users u ON la.user_id = u.id WHERE u.department_id = ? AND la.status = 'rejected' AND STRFTIME('%Y', la.start_date) = ?) as total_rejected_leaves,
            COALESCE((SELECT SUM(la.number_of_days) FROM leave_applications la JOIN users u ON la.user_id = u.id WHERE u.department_id = ? AND la.status = 'approved' AND STRFTIME('%Y', la.start_date) = ?), 0) as total_days_used
        `, [dirDept.id, dirDept.id, dirDept.id, dirDept.id, yr, dirDept.id, dirDept.id, yr, dirDept.id, yr]);
        return res.json({ success: true, data: summary, year: currentYear });
      }
    }

    // Org-wide for HR/admin
    const summary = await db.get(`
      SELECT 
        (SELECT COUNT(*) FROM users) as total_users,
        (SELECT COUNT(*) FROM users WHERE role = 'employee') as total_employees,
        (SELECT COUNT(*) FROM leave_applications) as total_applications,
        (SELECT COUNT(*) FROM leave_applications WHERE status = 'approved' AND STRFTIME('%Y', start_date) = ?) as total_approved_leaves,
        (SELECT COUNT(*) FROM leave_applications WHERE status = 'pending') as pending_approvals,
        (SELECT COUNT(*) FROM leave_applications WHERE status = 'rejected' AND STRFTIME('%Y', start_date) = ?) as total_rejected_leaves,
        COALESCE((SELECT SUM(number_of_days) FROM leave_applications WHERE status = 'approved' AND STRFTIME('%Y', start_date) = ?), 0) as total_days_used,
        (SELECT COUNT(DISTINCT department) FROM users WHERE department IS NOT NULL AND department != '') as total_departments
    `, [yr, yr, yr]);

    res.json({
      success: true,
      data: summary,
      year: currentYear
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getDirectorEmployees = async (req, res) => {
  try {
    const db = getDatabase();
    const department = await getDirectorDepartment(db, req.user.id);
    if (!department) {
      return res.status(404).json({ success: false, message: 'No department is assigned to this Director' });
    }

    const employees = await db.all(
      `SELECT u.id, u.employee_id, u.first_name, u.middle_name, u.last_name, u.email, u.phone,
              u.designation, u.role, u.reporting_officer_id, u.registration_status, u.is_active,
              sup.first_name || ' ' || sup.last_name as supervisor_name
       FROM users u
       LEFT JOIN users sup ON u.reporting_officer_id = sup.id
       WHERE u.department_id = ?
       ORDER BY u.first_name, u.last_name`,
      [department.id]
    );

    res.json({
      success: true,
      department,
      data: employees,
      count: employees.length
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getDirectorLeaveDashboard = async (req, res) => {
  try {
    const db = getDatabase();
    const department = await getDirectorDepartment(db, req.user.id);
    if (!department) {
      return res.status(404).json({ success: false, message: 'No department is assigned to this Director' });
    }

    const today = new Date().toISOString().slice(0, 10);
    const upcomingDays = Math.max(1, Math.min(parseInt(req.query.days || '30', 10) || 30, 365));

    const onLeaveToday = await db.all(
      `SELECT u.id, u.employee_id, u.first_name, u.last_name, lt.name as leave_type,
              la.start_date, la.end_date, date(la.end_date, '+1 day') as return_date
       FROM leave_applications la
       JOIN users u ON la.user_id = u.id
       JOIN leave_types lt ON la.leave_type_id = lt.id
       WHERE u.department_id = ?
         AND la.status = 'approved'
         AND date(?) BETWEEN date(la.start_date) AND date(la.end_date)
       ORDER BY la.end_date ASC`,
      [department.id, today]
    );

    const upcomingLeave = await db.all(
      `SELECT u.id, u.employee_id, u.first_name, u.last_name, lt.name as leave_type,
              la.start_date, la.end_date, date(la.end_date, '+1 day') as return_date,
              la.number_of_days
       FROM leave_applications la
       JOIN users u ON la.user_id = u.id
       JOIN leave_types lt ON la.leave_type_id = lt.id
       WHERE u.department_id = ?
         AND la.status = 'approved'
         AND date(la.start_date) > date(?)
         AND date(la.start_date) <= date(?, '+' || ? || ' days')
       ORDER BY la.start_date ASC`,
      [department.id, today, today, upcomingDays]
    );

    const leaveTrends = await db.all(
      `SELECT u.id as user_id, u.employee_id, u.first_name, u.last_name,
              lt.name as leave_type,
              strftime('%Y', la.start_date) as year,
              strftime('%m', la.start_date) as month,
              COUNT(*) as leave_count,
              SUM(la.number_of_days) as total_days
       FROM users u
       LEFT JOIN leave_applications la ON la.user_id = u.id AND la.status = 'approved'
       LEFT JOIN leave_types lt ON la.leave_type_id = lt.id
       WHERE u.department_id = ?
       GROUP BY u.id, lt.name, year, month
       ORDER BY u.first_name, u.last_name, year DESC, month DESC`,
      [department.id]
    );

    const employeeBalances = await db.all(
      `SELECT u.id, u.employee_id, u.first_name, u.last_name, u.designation,
              u.reporting_officer_id,
              supervisor.first_name || ' ' || supervisor.last_name as supervisor_name,
              lt.name as leave_type,
              lb.total_days,
              lb.used_days,
              lb.remaining_days,
              lb.year
       FROM leave_balance lb
       JOIN users u ON lb.user_id = u.id
       JOIN leave_types lt ON lb.leave_type_id = lt.id
       LEFT JOIN users supervisor ON u.reporting_officer_id = supervisor.id
       WHERE u.department_id = ?
         AND lb.year = CAST(STRFTIME('%Y', 'now') AS INTEGER)
         AND (
           lt.applicable_gender = 'All'
           OR LOWER(lt.applicable_gender) = LOWER(u.gender)
         )
       ORDER BY u.first_name, u.last_name, lt.name`,
      [department.id]
    );

    const allRequests = await db.all(
      `SELECT la.id, u.id as user_id, u.employee_id, u.first_name, u.last_name,
              supervisor.first_name || ' ' || supervisor.last_name as supervisor_name,
              lt.name as leave_type,
              la.start_date, la.end_date, la.number_of_days, la.status, la.created_at,
              aw.comments as approval_comments, aw.approved_at
       FROM leave_applications la
       JOIN users u ON la.user_id = u.id
       JOIN leave_types lt ON la.leave_type_id = lt.id
       LEFT JOIN users supervisor ON u.reporting_officer_id = supervisor.id
       LEFT JOIN approval_workflow aw ON aw.leave_application_id = la.id
       WHERE u.department_id = ?
       ORDER BY la.created_at DESC
       LIMIT 100`,
      [department.id]
    );

    res.json({
      success: true,
      department,
      today,
      metrics: {
        employees_on_leave_today: onLeaveToday.length,
        upcoming_leave_count: upcomingLeave.length,
        pending_approvals: allRequests.filter(request => request.status === 'pending').length,
        total_employees: new Set(employeeBalances.map(row => row.id)).size
      },
      onLeaveToday,
      upcomingLeave,
      leaveTrends,
      employeeBalances,
      allRequests
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Export CSV helper
const toCSV = (rows) => {
  if (!rows || rows.length === 0) return '';
  const keys = Object.keys(rows[0]);
  const header = keys.join(',');
  const lines = rows.map(r => keys.map(k => `"${String(r[k] ?? '').replace(/"/g, '""')}"`).join(','));
  return [header].concat(lines).join('\n');
};

// Export endpoints
const exportReport = async (req, res) => {
  try {
    const db = getDatabase();
    const { type } = req.params;
    let rows = [];
    const year = req.query.year || new Date().getFullYear();

    if (type === 'balance') {
      rows = await db.all(`
        SELECT u.employee_id, u.first_name, u.last_name, u.gender, u.department, lt.name as leave_type, lt.applicable_gender, lb.total_days, lb.used_days, lb.remaining_days
        FROM leave_balance lb
        JOIN users u ON lb.user_id = u.id
        JOIN leave_types lt ON lb.leave_type_id = lt.id
        WHERE lb.year = ?
          AND (
            lt.applicable_gender = 'All'
            OR LOWER(lt.applicable_gender) = LOWER(u.gender)
          )
        ORDER BY u.department, u.first_name
      `, [year]);
    } else if (type === 'pending') {
      rows = await db.all(`
        SELECT la.id as application_id, u.employee_id, u.first_name, u.last_name, lt.name as leave_type, la.start_date, la.end_date, la.number_of_days, aw.approval_level, aw.created_at as submitted_date
        FROM approval_workflow aw
        JOIN leave_applications la ON aw.leave_application_id = la.id
        JOIN users u ON la.user_id = u.id
        JOIN leave_types lt ON la.leave_type_id = lt.id
        WHERE aw.status = 'pending'
        ORDER BY aw.created_at ASC
      `);
    } else if (type === 'department') {
      const dept = req.query.department;
      rows = await db.all(`
        SELECT u.department, COUNT(DISTINCT u.id) as total_employees, COUNT(DISTINCT CASE WHEN la.status = 'approved' THEN la.id END) as approved_leaves, SUM(CASE WHEN la.status = 'approved' THEN la.number_of_days ELSE 0 END) as total_days_approved, lt.name as leave_type
        FROM users u
        LEFT JOIN leave_applications la ON u.id = la.user_id
        LEFT JOIN leave_types lt ON la.leave_type_id = lt.id
        WHERE STRFTIME('%Y', la.start_date) = ? OR la.start_date IS NULL
        ${dept ? 'AND u.department = ?' : ''}
        GROUP BY u.department, lt.name
        ORDER BY u.department, lt.name
      `, dept ? [year.toString(), dept] : [year.toString()]);
    } else if (type === 'monthly') {
      rows = await db.all(`
        SELECT CAST(STRFTIME('%m', la.start_date) AS INTEGER) as month, lt.name as leave_type, COUNT(DISTINCT la.id) as total_applications, SUM(CASE WHEN la.status = 'approved' THEN la.number_of_days ELSE 0 END) as approved_days
        FROM leave_applications la
        JOIN leave_types lt ON la.leave_type_id = lt.id
        WHERE STRFTIME('%Y', la.start_date) = ?
        GROUP BY month, lt.name
        ORDER BY month ASC
      `, [year.toString()]);
    } else {
      return res.status(400).json({ success: false, message: 'Unknown export type' });
    }

    const csv = toCSV(rows);
    res.header('Content-Type', 'text/csv');
    res.attachment(`${type}_report_${year}.csv`);
    return res.send(csv);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  getEmployeeLeaveHistory,
  getDepartmentLeaveReport,
  getLeaveBalanceReport,
  getPendingApprovalReport,
  getMonthlyLeaveTrends,
  getSummaryDashboard,
  getDirectorEmployees,
  getDirectorLeaveDashboard
};

module.exports.exportReport = exportReport;

