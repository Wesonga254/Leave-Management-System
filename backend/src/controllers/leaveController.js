const { getDatabase } = require('../database');
const { notifyUser, sendLeaveApprovalEmail, sendLeaveRejectionEmail, sendLeaveSubmissionEmail } = require('../utils/notifications');
const { isLeaveTypeApplicableToGender } = require('../utils/leaveTypeGender');

const formatDate = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const calculateBusinessDays = async (db, startDate, endDate) => {
  const holidayRows = await db.all(
    `SELECT date FROM public_holidays WHERE date BETWEEN ? AND ?`,
    [formatDate(startDate), formatDate(endDate)]
  );
  const holidaySet = new Set((holidayRows || []).map(h => formatDate(h.date)));

  let count = 0;
  let d = new Date(`${formatDate(startDate)}T00:00:00`);
  const ed = new Date(`${formatDate(endDate)}T00:00:00`);
  while (d <= ed) {
    const day = d.getDay();
    const iso = formatDate(d);
    if (day !== 0 && day !== 6 && !holidaySet.has(iso)) {
      count += 1;
    }
    d.setDate(d.getDate() + 1);
  }
  return count;
};

const OVERLAP_MESSAGE = 'You already have an active or pending leave application of the same type for overlapping dates. Please choose different dates or a different leave type.';

const getOverlappingLeaveApplication = async (db, userId, leaveTypeId, startDate, endDate, excludeApplicationId = null) => {
  const params = [userId, leaveTypeId, endDate, startDate];
  let excludeClause = '';
  if (excludeApplicationId) {
    excludeClause = 'AND id != ?';
    params.push(excludeApplicationId);
  }

  return db.get(
    `SELECT id, status, start_date, end_date
     FROM leave_applications
     WHERE user_id = ?
       AND leave_type_id = ?
       AND status IN ('pending', 'approved')
       AND date(start_date) <= date(?) AND date(end_date) >= date(?)
       ${excludeClause}
     LIMIT 1`,
    params
  );
};

const getCurrentUserGender = async (db, userId, fallbackGender) => {
  const user = await db.get('SELECT gender FROM users WHERE id = ?', [userId]);
  return user?.gender || fallbackGender;
};

const countCalendarDays = (start, end) => {
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return 0;
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.floor((endDate - startDate) / msPerDay) + 1;
};

const getApplicationWorkflow = async (db, applicationId) => {
  return db.all(
    `SELECT
      aw.id,
      aw.approval_level,
      aw.status,
      aw.comments,
      aw.approved_at,
      aw.updated_at,
      approver.first_name || ' ' || approver.last_name as approver_name,
      delegate.first_name || ' ' || delegate.last_name as delegated_to_name
     FROM approval_workflow aw
     LEFT JOIN users approver ON aw.approver_id = approver.id
     LEFT JOIN users delegate ON aw.delegated_to = delegate.id
     WHERE aw.leave_application_id = ?
     ORDER BY aw.id ASC`,
    [applicationId]
  );
};

const addWorkflowToApplications = async (db, applications) => {
  return Promise.all((applications || []).map(async (application) => ({
    ...application,
    workflow: await getApplicationWorkflow(db, application.id).catch(() => [])
  })));
};

// Submit Leave Application
const submitLeaveApplication = async (req, res) => {
  const db = getDatabase();
  try {
    const {
      leave_type_id,
      start_date,
      end_date,
      reason,
      designation,
      contact_number,
      phone
    } = req.body;

    if (!leave_type_id || !start_date || !end_date) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    await db.run('BEGIN TRANSACTION');

    // Update user designation if provided
    if (designation) {
      await db.run(
        'UPDATE users SET designation = ? WHERE id = ?',
        [designation, req.user.id]
      );
    }

    const contactNumber = contact_number || phone;
    if (contactNumber) {
      await db.run(
        'UPDATE users SET phone = ? WHERE id = ?',
        [contactNumber, req.user.id]
      );
    }

    // Calculate number of business days (exclude weekends and public holidays)
    const numberOfDays = await calculateBusinessDays(db, start_date, end_date);
    if (numberOfDays < 1) {
      await db.run('ROLLBACK');
      return res.status(400).json({ message: 'Requested leave dates contain no working days' });
    }

    const employeeGender = await getCurrentUserGender(db, req.user.id, req.user.gender);
    const leaveType = await db.get('SELECT name, applicable_gender FROM leave_types WHERE id = ?', [leave_type_id]);
    if (!leaveType) {
      await db.run('ROLLBACK');
      return res.status(400).json({ message: 'Invalid leave type' });
    }

    if (!isLeaveTypeApplicableToGender(leaveType, employeeGender)) {
      await db.run('ROLLBACK');
      return res.status(400).json({ message: 'This leave type is not applicable to your gender' });
    }

    // Check leave balance
    const currentYear = new Date(start_date).getFullYear();
    const leaveBalance = await db.get(
      `SELECT * FROM leave_balance WHERE user_id = ? AND leave_type_id = ? AND year = ?`,
      [req.user.id, leave_type_id, currentYear]
    );

    // Enforce attachment rules for certain leave types
    const leaveName = (leaveType?.name || '').toLowerCase();
    if ((leaveName.includes('sick') && numberOfDays >= 3) || leaveName.includes('compassion')) {
      if (!req.body.has_attachment && !req.body.hasAttachment) {
        await db.run('ROLLBACK');
        return res.status(400).json({ message: 'Supporting attachment required for this leave type. Please upload before submitting.' });
      }
    }

    if (!leaveBalance || leaveBalance.remaining_days < numberOfDays) {
      await db.run('ROLLBACK');
      return res.status(400).json({
        message: `You do not have enough leave days. Available balance: ${leaveBalance?.remaining_days || 0} days, Requested: ${numberOfDays} days.`
      });
    }

    const overlappingApplication = await getOverlappingLeaveApplication(db, req.user.id, leave_type_id, start_date, end_date);
    if (overlappingApplication) {
      await db.run('ROLLBACK');
      return res.status(400).json({ message: OVERLAP_MESSAGE });
    }

    // Insert leave application
    const result = await db.run(
      `INSERT INTO leave_applications (user_id, leave_type_id, start_date, end_date, number_of_days, reason, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [req.user.id, leave_type_id, start_date, end_date, numberOfDays, reason || '', 'pending']
    );

    // Create approval workflow records
    const user = await db.get('SELECT reporting_officer_id, department FROM users WHERE id = ?', [req.user.id]);

    let supervisorId = user?.reporting_officer_id;
    if (!supervisorId && user?.department) {
      // First try to find a supervisor in the same directorate
      const applicant = await db.get('SELECT directorate_id FROM users WHERE id = ?', [req.user.id]);
      let deptSupervisor = null;
      if (applicant?.directorate_id) {
        deptSupervisor = await db.get(
          `SELECT id FROM users WHERE role = 'supervisor' AND directorate_id = ? LIMIT 1`,
          [applicant.directorate_id]
        );
      }
      // Fall back to same department if no directorate match
      if (!deptSupervisor) {
        deptSupervisor = await db.get(
          `SELECT id FROM users WHERE role = 'supervisor' AND LOWER(department) = LOWER(?) LIMIT 1`,
          [user.department]
        );
      }
      if (deptSupervisor) {
        supervisorId = deptSupervisor.id;
        await db.run('UPDATE users SET reporting_officer_id = ? WHERE id = ?', [supervisorId, req.user.id]);
      }
    }

    // Supervisor approval (only approval step required)
    if (supervisorId) {
      await db.run(
        `INSERT INTO approval_workflow (leave_application_id, approver_id, approval_level, status)
         VALUES (?, ?, ?, ?)`,
        [result.lastID, supervisorId, 'supervisor', 'pending']
      );
    } else {
      await db.run(
        `UPDATE leave_applications SET status = 'approved', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [result.lastID]
      );
      await db.run(
        `UPDATE leave_balance
         SET used_days = used_days + ?, remaining_days = remaining_days - ?, updated_at = CURRENT_TIMESTAMP
         WHERE user_id = ? AND leave_type_id = ? AND year = ?`,
        [numberOfDays, numberOfDays, req.user.id, leave_type_id, currentYear]
      );
    }

    await db.run('COMMIT');

    // Notify all stakeholders immediately.
    try {
      // req.user from JWT only has { id, role } — fetch full user data from DB
      const fullUser = await db.get('SELECT id, email, phone, first_name, last_name, username, department, department_id FROM users WHERE id = ?', [req.user.id]);
      const applicantName = fullUser.first_name || fullUser.username;

      // 1. Notify the employee (applicant) — in-app
      await notifyUser({
        userId: fullUser.id,
        email: fullUser.email,
        phone: fullUser.phone,
        type: 'leave_submission',
        title: 'Leave Request Submitted',
        message: `Your ${leaveType.name} request from ${start_date} to ${end_date} has been submitted for approval.`,
        referenceId: result.lastID
      });

      // 1b. Send polished HTML submission email to applicant
      sendLeaveSubmissionEmail({
        to: fullUser.email,
        firstName: applicantName,
        leaveType: leaveType.name,
        startDate: start_date,
        endDate: end_date,
        numberOfDays
      }).catch(err => console.error('Submission email error:', err.message));

      if (supervisorId) {
        // 2. Notify the supervisor (CAN ACT)
        const firstApprover = await db.get(
          `SELECT aw.approver_id, approver.email, approver.phone, approver.first_name
           FROM approval_workflow aw
           JOIN users approver ON aw.approver_id = approver.id
           WHERE aw.leave_application_id = ? AND aw.status = 'pending'
           ORDER BY aw.id ASC
           LIMIT 1`,
          [result.lastID]
        );

        if (firstApprover) {
          await notifyUser({
            userId: firstApprover.approver_id,
            email: firstApprover.email,
            phone: firstApprover.phone,
            type: 'leave_submission',
            title: 'Leave awaiting your approval',
            message: `${applicantName} submitted a leave request (${leaveType.name}) from ${start_date} to ${end_date}. Please review and approve or reject.`,
            referenceId: result.lastID
          });
        }

        // 3. Notify all HR users (VIEW ONLY — informational)
        const hrUsers = await db.all(`SELECT id, email, phone FROM users WHERE role = 'hr'`);
        for (const hr of hrUsers) {
          await notifyUser({
            userId: hr.id,
            email: hr.email,
            phone: hr.phone,
            type: 'leave_submission_info',
            title: 'New Leave Application Submitted',
            message: `${applicantName} submitted a ${leaveType.name} request from ${start_date} to ${end_date}. This is for your information — only the supervisor can act on this request.`,
            referenceId: result.lastID
          });
        }

        // 4. Notify the department director (VIEW ONLY — informational)
        if (fullUser.department_id) {
          const dept = await db.get('SELECT director_id FROM departments WHERE id = ?', [fullUser.department_id]);
          if (dept?.director_id) {
            const director = await db.get('SELECT id, email, phone FROM users WHERE id = ?', [dept.director_id]);
            if (director) {
              await notifyUser({
                userId: director.id,
                email: director.email,
                phone: director.phone,
                type: 'leave_submission_info',
                title: 'New Leave Application Submitted',
                message: `${applicantName} submitted a ${leaveType.name} request from ${start_date} to ${end_date}. This is for your information — only the supervisor can act on this request.`,
                referenceId: result.lastID
              });
            }
          }
        }
        // Fallback: if no department director, notify all users with role 'director'
        if (!fullUser.department_id || !(await db.get('SELECT director_id FROM departments WHERE id = ?', [fullUser.department_id]))?.director_id) {
          const directors = await db.all(`SELECT id, email, phone FROM users WHERE role = 'director'`);
          for (const dir of directors) {
            await notifyUser({
              userId: dir.id,
              email: dir.email,
              phone: dir.phone,
              type: 'leave_submission_info',
              title: 'New Leave Application Submitted',
              message: `${applicantName} submitted a ${leaveType.name} request from ${start_date} to ${end_date}. This is for your information — only the supervisor can act on this request.`,
              referenceId: result.lastID
            });
          }
        }

        // 5. Notify admin users (informational)
        const adminUsers = await db.all(`SELECT id, email, phone FROM users WHERE role = 'admin'`);
        for (const admin of adminUsers) {
          await notifyUser({
            userId: admin.id,
            type: 'leave_submission_info',
            title: 'New Leave Application',
            message: `${applicantName} submitted a ${leaveType.name} request from ${start_date} to ${end_date} (${numberOfDays} day(s)).`,
            referenceId: result.lastID
          });
        }
      } else {
        // No supervisor — auto-approved, notify HR
        const hrUsers = await db.all(`SELECT id, email, phone FROM users WHERE role = 'hr'`);
        for (const hr of hrUsers) {
          await notifyUser({
            userId: hr.id,
            email: hr.email,
            phone: hr.phone,
            type: 'leave_hr_notice',
            title: 'Leave Auto-Approved (No Supervisor)',
            message: `${applicantName} submitted a ${leaveType.name} request (${start_date} to ${end_date}) with no assigned supervisor. The request was auto-approved. No HR action is required.`,
            referenceId: result.lastID
          });
        }
      }
    } catch (err) {
      console.error('Notification error:', err.message);
    }

    res.status(201).json({
      success: true,
      message: 'Leave application submitted successfully',
      application_id: result.lastID
    });
  } catch (error) {
    await db.run('ROLLBACK').catch(() => {});
    res.status(500).json({
      success: false,
      message: 'Error submitting leave application',
      error: error.message
    });
  }
};

// Get Leave Applications
const getLeaveApplications = async (req, res) => {
  try {
    const db = getDatabase();
    const { status, user_id, scope } = req.query;

    let query = `
      SELECT 
        la.id,
        la.user_id,
        u.first_name,
        u.last_name,
        u.employee_id,
        u.department,
        la.leave_type_id,
        lt.name as leave_type,
        lt.name as leave_type_name,
        la.start_date,
        la.end_date,
        la.number_of_days,
        la.reason,
        la.status,
        la.created_at
      FROM leave_applications la
      JOIN users u ON la.user_id = u.id
      JOIN leave_types lt ON la.leave_type_id = lt.id
      WHERE 1=1
    `;

    const params = [];

    if (status) {
      query += ' AND la.status = ?';
      params.push(status);
    }

    // scope=own forces filtering to the logged-in user only,
    // regardless of role. Used by "My Requests" page.
    if (scope === 'own') {
      query += ' AND la.user_id = ?';
      params.push(req.user.id);
    } else {
      const canViewOthers = ['admin', 'hr', 'director'].includes(req.user.role);
      if (user_id && canViewOthers) {
        query += ' AND la.user_id = ?';
        params.push(user_id);
      } else if (!canViewOthers) {
        query += ' AND la.user_id = ?';
        params.push(req.user.id);
      }
    }

    // Directors can only see applications from their department
    if (req.user.role === 'director') {
      const directorDept = await db.get(
        `SELECT d.id FROM departments d WHERE d.director_id = ? LIMIT 1`,
        [req.user.id]
      );
      if (directorDept) {
        query += ' AND u.department_id = ?';
        params.push(directorDept.id);
      }
    }

    query += ' ORDER BY la.created_at DESC';

    const applications = await db.all(query, params);
    const applicationsWithWorkflow = await addWorkflowToApplications(db, applications);

    res.json({
      success: true,
      data: applicationsWithWorkflow
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching leave applications',
      error: error.message
    });
  }
};

// Approve/Reject Leave Application
const updateLeaveApplicationStatus = async (req, res) => {
  const db = getDatabase();
  try {
    const { id } = req.params;
    const { approval_level, status, comments } = req.body;

    if (!approval_level || !['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Valid approval level and status are required' });
    }

    const workflow = await db.get(
      `SELECT aw.*, la.status as application_status
       FROM approval_workflow aw
       JOIN leave_applications la ON aw.leave_application_id = la.id
       WHERE aw.leave_application_id = ?
         AND aw.approval_level = ?
         AND aw.status = 'pending'
         AND (aw.approver_id = ? OR aw.delegated_to = ?)`,
      [id, approval_level, req.user.id, req.user.id]
    );

    if (!workflow) {
      return res.status(403).json({ success: false, message: 'This approval is not pending for your account' });
    }

    if (workflow.application_status !== 'pending') {
      return res.status(400).json({ success: false, message: 'This application has already been actioned' });
    }

    const earlierPending = await db.get(
      `SELECT id FROM approval_workflow
       WHERE leave_application_id = ?
         AND status = 'pending'
         AND id < ?
       LIMIT 1`,
      [id, workflow.id]
    );

    if (earlierPending) {
      return res.status(400).json({ success: false, message: 'An earlier approval step must be completed first' });
    }

    await db.run('BEGIN TRANSACTION');

    // Update approval workflow
    await db.run(
      `UPDATE approval_workflow
       SET status = ?, comments = ?, approved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [status, comments || null, workflow.id]
    );

    const actionedApplication = await db.get(
      `SELECT u.id, u.email, u.phone, lt.name as leave_type, la.start_date, la.end_date
       FROM leave_applications la
       JOIN users u ON la.user_id = u.id
       JOIN leave_types lt ON la.leave_type_id = lt.id
       WHERE la.id = ?`,
      [id]
    );

    let applicationStatus = 'pending';
    let leaveApp = null;

    if (status === 'rejected') {
      applicationStatus = 'rejected';

      await db.run(
        `UPDATE approval_workflow
         SET status = 'not_required', updated_at = CURRENT_TIMESTAMP
         WHERE leave_application_id = ? AND status = 'pending'`,
        [id]
      );

      await db.run(
        `UPDATE leave_applications SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [applicationStatus, id]
      );
    } else {
      const nextApprover = await db.get(
        `SELECT aw.*, approver.email, approver.phone, approver.first_name
         FROM approval_workflow aw
         JOIN users approver ON aw.approver_id = approver.id
         WHERE aw.leave_application_id = ? AND aw.status = 'pending'
         ORDER BY aw.id ASC
         LIMIT 1`,
        [id]
      );

      if (!nextApprover) {
        applicationStatus = 'approved';

        leaveApp = await db.get(
          `SELECT la.user_id, la.leave_type_id, la.number_of_days, la.start_date, la.end_date,
            lt.name as leave_type,
            u.email as applicant_email, u.phone as applicant_phone,
            u.first_name as applicant_first, u.last_name as applicant_last, u.employee_id
           FROM leave_applications la
           JOIN leave_types lt ON la.leave_type_id = lt.id
           JOIN users u ON la.user_id = u.id
           WHERE la.id = ?`,
          [id]
        );

        if (leaveApp) {
          const currentYear = new Date(leaveApp.start_date).getFullYear();
          await db.run(
            `UPDATE leave_balance
             SET used_days = used_days + ?, remaining_days = remaining_days - ?, updated_at = CURRENT_TIMESTAMP
             WHERE user_id = ? AND leave_type_id = ? AND year = ?`,
            [leaveApp.number_of_days, leaveApp.number_of_days, leaveApp.user_id, leaveApp.leave_type_id, currentYear]
          );

          await db.run(
            `UPDATE leave_applications SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [applicationStatus, id]
          );
        }
      }
    }

    await db.run('COMMIT');

    // Send emails / notifications outside transaction
    if (status === 'rejected') {
      try {
        const applicant = await db.get(
          `SELECT u.id, u.email, u.phone, u.first_name, lt.name as leave_type, la.start_date, la.end_date, la.number_of_days
           FROM leave_applications la
           JOIN users u ON la.user_id = u.id
           JOIN leave_types lt ON la.leave_type_id = lt.id
           WHERE la.id = ?`,
          [id]
        );
        if (applicant) {
          await notifyUser({
            userId: applicant.id,
            email: applicant.email,
            phone: applicant.phone,
            type: 'rejection',
            title: 'Leave Request Rejected',
            message: `Your leave request (${applicant.leave_type}) from ${applicant.start_date} to ${applicant.end_date} has been rejected. Reason: ${comments || 'No reason provided'}`,
            referenceId: id
          });

          // Send rejection email
          sendLeaveRejectionEmail({
            to: applicant.email,
            firstName: applicant.first_name,
            leaveType: applicant.leave_type,
            startDate: applicant.start_date,
            endDate: applicant.end_date,
            numberOfDays: applicant.number_of_days,
            comments: comments
          }).catch(err => console.error('Rejection email error:', err.message));
        }
      } catch (err) {
        console.error('Notification error:', err.message);
      }
    } else {
      const nextApprover = await db.get(
        `SELECT aw.*, approver.email, approver.phone, approver.first_name
         FROM approval_workflow aw
         JOIN users approver ON aw.approver_id = approver.id
         WHERE aw.leave_application_id = ? AND aw.status = 'pending'
         ORDER BY aw.id ASC
         LIMIT 1`,
        [id]
      );

      if (nextApprover) {
        try {
          if (actionedApplication) {
            await notifyUser({
              userId: actionedApplication.id,
              email: actionedApplication.email,
              phone: actionedApplication.phone,
              type: 'approval_step',
              title: `${approval_level.replace(/_/g, ' ')} approval completed`,
              message: `Your ${actionedApplication.leave_type} request from ${actionedApplication.start_date} to ${actionedApplication.end_date} was approved at the ${approval_level.replace(/_/g, ' ')} step and is awaiting the next approver.`,
              referenceId: id
            });
          }

          const leaveAppDetail = await db.get(
            `SELECT la.*, u.first_name as applicant_first, lt.name as leave_type
             FROM leave_applications la
             JOIN users u ON la.user_id = u.id
             JOIN leave_types lt ON la.leave_type_id = lt.id
             WHERE la.id = ?`,
            [id]
          );
          if (leaveAppDetail) {
            await notifyUser({
              userId: nextApprover.approver_id,
              email: nextApprover.email,
              phone: nextApprover.phone,
              type: 'approval_request',
              title: 'Leave awaiting your approval',
              message: `${leaveAppDetail.applicant_first} has a ${leaveAppDetail.leave_type} request awaiting your approval from ${leaveAppDetail.start_date} to ${leaveAppDetail.end_date}.`,
              referenceId: id
            });
          }
        } catch (err) {
          console.error('Notification error:', err.message);
        }
      } else {
        // Fully approved
        if (leaveApp) {
          sendFinalApprovalEmails(db, id, leaveApp.number_of_days)
            .catch(err => console.error('Final approval email error:', err.message));

          try {
            await notifyUser({
              userId: leaveApp.user_id,
              email: leaveApp.applicant_email,
              phone: leaveApp.applicant_phone,
              type: 'approval',
              title: 'Leave Request Approved',
              message: `Your leave request (${leaveApp.leave_type}) from ${leaveApp.start_date} to ${leaveApp.end_date} has been approved by your supervisor.`,
              referenceId: id
            });

            const hrUsers = await db.all(
              `SELECT id, email, phone, first_name FROM users WHERE role = 'hr'`
            );
            const applicantName = [leaveApp.applicant_first, leaveApp.applicant_last].filter(Boolean).join(' ');
            for (const hr of hrUsers) {
              await notifyUser({
                userId: hr.id,
                email: hr.email,
                phone: hr.phone,
                type: 'leave_hr_notice',
                title: 'Leave Approved by Supervisor',
                message: `${applicantName} (${leaveApp.employee_id || 'N/A'}) had their ${leaveApp.leave_type} request (${leaveApp.start_date} to ${leaveApp.end_date}) approved by their supervisor. No HR action is required.`,
                referenceId: id
              });
            }
          } catch (err) {
            console.error('Notification error:', err.message);
          }
        }
      }
    }

    res.json({
      success: true,
      message: `Leave application ${status} successfully`,
      application_status: applicationStatus
    });
  } catch (error) {
    await db.run('ROLLBACK').catch(() => {});
    res.status(500).json({
      success: false,
      message: 'Error updating leave application',
      error: error.message
    });
  }
};

// Get Leave Types
const getLeaveTypes = async (req, res) => {
  try {
    const db = getDatabase();
    const leaveTypes = await db.all('SELECT * FROM leave_types');

    res.json({
      success: true,
      data: leaveTypes
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching leave types',
      error: error.message
    });
  }
};

// Get Leave Balance
const getLeaveBalance = async (req, res) => {
  try {
    const db = getDatabase();
    const currentYear = new Date().getFullYear();

    const balance = await db.all(
      `SELECT 
        lb.*,
        lt.name as leave_type_name
       FROM leave_balance lb
       JOIN leave_types lt ON lb.leave_type_id = lt.id
       WHERE lb.user_id = ? AND lb.year = ?
       ORDER BY lt.name`,
      [req.user.id, currentYear]
    );

    res.json({
      success: true,
      year: currentYear,
      data: balance
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching leave balance',
      error: error.message
    });
  }
};

// Get Single Leave Application (for reapply)
const getLeaveApplicationById = async (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;

    const application = await db.get(
      `SELECT 
        la.*,
        lt.name as leave_type_name,
        lt.id as leave_type_id,
        u.first_name,
        u.last_name,
        u.employee_id,
        u.department,
        u.designation
       FROM leave_applications la
       JOIN leave_types lt ON la.leave_type_id = lt.id
       JOIN users u ON la.user_id = u.id
       WHERE la.id = ?`,
      [id]
    );

    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    const isOwner = application.user_id === req.user.id;
    const isAdmin = req.user.role === 'admin';
    const isHR = req.user.role === 'hr';
    const isDirector = req.user.role === 'director';
    const approvalAccess = await db.get(
      `SELECT id FROM approval_workflow
       WHERE leave_application_id = ?
         AND (approver_id = ? OR delegated_to = ?)
       LIMIT 1`,
      [id, req.user.id, req.user.id]
    );

    // Directors can only view applications from their own department
    let directorDeptAccess = false;
    if (isDirector) {
      const directorDept = await db.get(
        `SELECT d.id FROM departments d WHERE d.director_id = ? LIMIT 1`,
        [req.user.id]
      );
      if (directorDept) {
        const applicantUser = await db.get(
          'SELECT department_id FROM users WHERE id = ?',
          [application.user_id]
        );
        directorDeptAccess = applicantUser?.department_id === directorDept.id;
      }
    }

    if (!isOwner && !isAdmin && !isHR && !directorDeptAccess && !approvalAccess) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    const workflow = await getApplicationWorkflow(db, id);

    res.json({
      success: true,
      data: {
        ...application,
        workflow
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching application',
      error: error.message
    });
  }
};

const updateOwnLeaveApplication = async (req, res) => {
  const db = getDatabase();
  try {
    const { id } = req.params;
    const { leave_type_id, start_date, end_date, reason } = req.body;

    const application = await db.get(
      'SELECT * FROM leave_applications WHERE id = ?',
      [id]
    );

    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    if (application.user_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    if (application.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Only pending applications can be edited' });
    }

    if (!leave_type_id || !start_date || !end_date) {
      return res.status(400).json({ success: false, message: 'Leave type, start date, and end date are required' });
    }

    await db.run('BEGIN TRANSACTION');

    const numberOfDays = await calculateBusinessDays(db, start_date, end_date);
    if (numberOfDays < 1) {
      await db.run('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Requested leave dates contain no working days' });
    }

    const employeeGender = await getCurrentUserGender(db, req.user.id, req.user.gender);
    const leaveType = await db.get('SELECT name, applicable_gender FROM leave_types WHERE id = ?', [leave_type_id]);
    if (!leaveType) {
      await db.run('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Invalid leave type' });
    }

    if (!isLeaveTypeApplicableToGender(leaveType, employeeGender)) {
      await db.run('ROLLBACK');
      return res.status(400).json({ success: false, message: 'This leave type is not applicable to your gender' });
    }

    const currentYear = new Date(start_date).getFullYear();
    const leaveBalance = await db.get(
      `SELECT * FROM leave_balance WHERE user_id = ? AND leave_type_id = ? AND year = ?`,
      [req.user.id, leave_type_id, currentYear]
    );

    if (!leaveBalance || leaveBalance.remaining_days < numberOfDays) {
      await db.run('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: `Insufficient leave balance. Available: ${leaveBalance?.remaining_days || 0} days, Requested: ${numberOfDays} days.`
      });
    }

    const overlappingApplication = await getOverlappingLeaveApplication(db, req.user.id, leave_type_id, start_date, end_date, id);
    if (overlappingApplication) {
      await db.run('ROLLBACK');
      return res.status(400).json({ success: false, message: OVERLAP_MESSAGE });
    }

    await db.run(
      `UPDATE leave_applications
       SET leave_type_id = ?, start_date = ?, end_date = ?, number_of_days = ?, reason = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [leave_type_id, start_date, end_date, numberOfDays, reason || '', id]
    );

    await db.run(
      `UPDATE approval_workflow
       SET status = 'pending', comments = NULL, approved_at = NULL, updated_at = CURRENT_TIMESTAMP
       WHERE leave_application_id = ? AND status IN ('pending', 'not_required')`,
      [id]
    );

    await db.run('COMMIT');

    try {
      await notifyUser({
        userId: req.user.id,
        email: req.user.email,
        phone: req.user.phone,
        type: 'leave_update',
        title: 'Leave Request Updated',
        message: `Your leave request has been updated to run from ${start_date} to ${end_date}.`,
        referenceId: id
      });
    } catch (err) {
      console.error('Notification error:', err.message);
    }

    res.json({
      success: true,
      message: 'Leave application updated successfully'
    });
  } catch (error) {
    await db.run('ROLLBACK').catch(() => {});
    res.status(500).json({
      success: false,
      message: 'Error updating application',
      error: error.message
    });
  }
};

const downloadLeaveApplication = async (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;

    const application = await db.get(
      `SELECT
        la.*,
        lt.name as leave_type_name,
        u.first_name,
        u.middle_name,
        u.last_name,
        u.employee_id,
        u.department,
        u.designation,
        u.email,
        u.phone
       FROM leave_applications la
       JOIN leave_types lt ON la.leave_type_id = lt.id
       JOIN users u ON la.user_id = u.id
       WHERE la.id = ?`,
      [id]
    );

    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    const isOwner = application.user_id === req.user.id;
    const isPrivileged = ['admin', 'hr', 'director'].includes(req.user.role);
    if (!isOwner && !isPrivileged) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    const workflow = await getApplicationWorkflow(db, id);
    const employeeName = [application.first_name, application.middle_name, application.last_name].filter(Boolean).join(' ');

    // Generate PDF
    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ size: 'A4', margin: 50 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="leave-application-${application.id}.pdf"`);
    doc.pipe(res);

    const pageWidth = doc.page.width - 100;

    // --- HEADER ---
    doc.fontSize(16).font('Helvetica-Bold').text('COUNTY GOVERNMENT OF BUSIA', { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(10).font('Helvetica').text('Leave Management System', { align: 'center' });
    doc.moveDown(0.5);

    // Divider
    doc.moveTo(50, doc.y).lineTo(50 + pageWidth, doc.y).lineWidth(1.5).stroke('#1B7340');
    doc.moveDown(0.5);

    // Title
    doc.fontSize(14).font('Helvetica-Bold').text('LEAVE APPLICATION FORM', { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(9).font('Helvetica').fillColor('#666666')
      .text(`Reference No: LA-${String(application.id).padStart(5, '0')}`, { align: 'center' });
    doc.fillColor('#000000');
    doc.moveDown(1);

    // --- SECTION: Employee Details ---
    const sectionY = doc.y;
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#1B7340').text('EMPLOYEE DETAILS');
    doc.fillColor('#000000');
    doc.moveDown(0.3);
    doc.moveTo(50, doc.y).lineTo(50 + pageWidth, doc.y).lineWidth(0.5).stroke('#cccccc');
    doc.moveDown(0.5);

    const fieldRows = [
      ['Full Name', employeeName, 'Employee ID', application.employee_id || 'N/A'],
      ['Department', application.department || 'N/A', 'Designation', application.designation || 'N/A'],
      ['Email', application.email || 'N/A', 'Phone', application.phone || 'N/A'],
    ];

    doc.fontSize(9).font('Helvetica');
    fieldRows.forEach(([label1, val1, label2, val2]) => {
      const y = doc.y;
      doc.font('Helvetica-Bold').text(label1 + ':', 50, y, { width: 90, continued: false });
      doc.font('Helvetica').text(val1, 145, y, { width: 170 });
      doc.font('Helvetica-Bold').text(label2 + ':', 330, y, { width: 90 });
      doc.font('Helvetica').text(val2, 425, y, { width: 130 });
      doc.moveDown(0.6);
    });
    doc.moveDown(0.8);

    // --- SECTION: Leave Details ---
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#1B7340').text('LEAVE DETAILS');
    doc.fillColor('#000000');
    doc.moveDown(0.3);
    doc.moveTo(50, doc.y).lineTo(50 + pageWidth, doc.y).lineWidth(0.5).stroke('#cccccc');
    doc.moveDown(0.5);

    const leaveRows = [
      ['Leave Type', application.leave_type_name, 'Number of Days', String(application.number_of_days)],
      ['Start Date', formatDate(application.start_date), 'End Date', formatDate(application.end_date)],
      ['Status', application.status.toUpperCase(), 'Date Applied', formatDate(application.created_at)],
    ];

    doc.fontSize(9).font('Helvetica');
    leaveRows.forEach(([label1, val1, label2, val2]) => {
      const y = doc.y;
      doc.font('Helvetica-Bold').text(label1 + ':', 50, y, { width: 90 });
      doc.font('Helvetica').text(val1, 145, y, { width: 170 });
      doc.font('Helvetica-Bold').text(label2 + ':', 330, y, { width: 90 });
      doc.font('Helvetica').text(val2, 425, y, { width: 130 });
      doc.moveDown(0.6);
    });

    if (application.reason) {
      doc.moveDown(0.3);
      doc.font('Helvetica-Bold').text('Reason:', 50);
      doc.moveDown(0.2);
      doc.font('Helvetica').text(application.reason, 50, doc.y, { width: pageWidth });
    }
    doc.moveDown(1);

    // --- SECTION: Approval Workflow ---
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#1B7340').text('APPROVAL WORKFLOW');
    doc.fillColor('#000000');
    doc.moveDown(0.3);
    doc.moveTo(50, doc.y).lineTo(50 + pageWidth, doc.y).lineWidth(0.5).stroke('#cccccc');
    doc.moveDown(0.5);

    if (workflow.length === 0) {
      doc.fontSize(9).font('Helvetica').text('No approval records available.', 50);
    } else {
      // Table header
      const tableTop = doc.y;
      doc.fontSize(8).font('Helvetica-Bold');
      doc.text('Level', 50, tableTop, { width: 100 });
      doc.text('Status', 155, tableTop, { width: 80 });
      doc.text('Approver', 240, tableTop, { width: 120 });
      doc.text('Date', 365, tableTop, { width: 90 });
      doc.text('Comments', 455, tableTop, { width: 100 });
      doc.moveDown(0.3);
      doc.moveTo(50, doc.y).lineTo(50 + pageWidth, doc.y).lineWidth(0.3).stroke('#dddddd');
      doc.moveDown(0.3);

      doc.fontSize(8).font('Helvetica');
      workflow.forEach(step => {
        const y = doc.y;
        doc.text(step.approval_level || 'N/A', 50, y, { width: 100 });
        doc.text(step.status || 'Pending', 155, y, { width: 80 });
        doc.text(step.approver_name || 'N/A', 240, y, { width: 120 });
        doc.text(step.approved_at ? formatDate(step.approved_at) : '—', 365, y, { width: 90 });
        doc.text(step.comments || '—', 455, y, { width: 100 });
        doc.moveDown(0.5);
      });
    }

    // --- FOOTER ---
    doc.moveDown(2);
    doc.moveTo(50, doc.y).lineTo(50 + pageWidth, doc.y).lineWidth(1).stroke('#1B7340');
    doc.moveDown(0.5);
    doc.fontSize(8).font('Helvetica').fillColor('#888888')
      .text(`Generated on ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} at ${new Date().toLocaleTimeString('en-GB')}`, { align: 'center' });
    doc.moveDown(0.2);
    doc.text('County Government of Busia — Leave Management System — ICT & Digital Economy Directorate', { align: 'center' });

    doc.end();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error downloading application',
      error: error.message
    });
  }
};

// Cancel Leave Application (only if pending)
const cancelLeaveApplication = async (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;

    const application = await db.get(
      `SELECT la.status, la.user_id, la.leave_type_id, la.start_date, la.end_date, la.number_of_days,
              lt.name as leave_type, u.first_name, u.last_name, u.reporting_officer_id
       FROM leave_applications la
       JOIN leave_types lt ON la.leave_type_id = lt.id
       JOIN users u ON la.user_id = u.id
       WHERE la.id = ?`,
      [id]
    );

    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    if (application.user_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    if (application.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Can only cancel pending applications' });
    }

    // Cancel the application
    await db.run(
      'UPDATE leave_applications SET status = ? WHERE id = ?',
      ['cancelled', id]
    );

    const applicantName = `${application.first_name} ${application.last_name}`;

    try {
      // Notify the applicant
      await notifyUser({
        userId: req.user.id,
        type: 'leave_cancelled',
        title: 'Leave Request Cancelled',
        message: `Your ${application.leave_type} request (${application.start_date} to ${application.end_date}) has been cancelled.`,
        referenceId: id
      });

      // Notify the supervisor
      if (application.reporting_officer_id) {
        const supervisor = await db.get('SELECT id, email, phone FROM users WHERE id = ?', [application.reporting_officer_id]);
        if (supervisor) {
          await notifyUser({
            userId: supervisor.id,
            email: supervisor.email,
            type: 'leave_cancelled',
            title: 'Leave Request Cancelled',
            message: `${applicantName} has cancelled their ${application.leave_type} request (${application.start_date} to ${application.end_date}).`,
            referenceId: id
          });
        }
      }

      // Notify admin users
      const adminUsers = await db.all(`SELECT id FROM users WHERE role = 'admin'`);
      for (const admin of adminUsers) {
        await notifyUser({
          userId: admin.id,
          type: 'leave_cancelled',
          title: 'Leave Request Cancelled',
          message: `${applicantName} cancelled their ${application.leave_type} request (${application.start_date} to ${application.end_date}).`,
          referenceId: id
        });
      }
    } catch (err) {
      console.error('Notification error:', err.message);
    }

    res.json({
      success: true,
      message: 'Leave application cancelled successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error cancelling application',
      error: error.message
    });
  }
};

// Get Analytics & Trends Data
const getAnalyticsTrends = async (req, res) => {
  try {
    const db = getDatabase();
    const { year } = req.query;
    const targetYear = year ? parseInt(year) : new Date().getFullYear();

    // Monthly usage by leave type
    const monthlyData = await db.all(
      `SELECT 
        lt.id,
        lt.name as leave_type,
        strftime('%m', la.start_date) as month,
        COUNT(*) as count,
        SUM(la.number_of_days) as total_days
       FROM leave_applications la
       JOIN leave_types lt ON la.leave_type_id = lt.id
       WHERE la.user_id = ? 
         AND la.status = 'approved'
         AND strftime('%Y', la.start_date) = ?
       GROUP BY lt.id, lt.name, month
       ORDER BY month, lt.name`,
      [req.user.id, targetYear.toString()]
    );

    // Leave type breakdown (total usage)
    const leaveTypeBreakdown = await db.all(
      `SELECT 
        lt.id,
        lt.name,
        COUNT(*) as count,
        SUM(la.number_of_days) as total_days
       FROM leave_applications la
       JOIN leave_types lt ON la.leave_type_id = lt.id
       WHERE la.user_id = ? 
         AND la.status = 'approved'
         AND strftime('%Y', la.start_date) = ?
       GROUP BY lt.id, lt.name`,
      [req.user.id, targetYear.toString()]
    );

    // Year-over-year comparison
    const yearOverYear = await db.all(
      `SELECT 
        strftime('%Y', la.start_date) as year,
        COUNT(*) as count,
        SUM(la.number_of_days) as total_days
       FROM leave_applications la
       WHERE la.user_id = ? AND la.status = 'approved'
       GROUP BY year
       ORDER BY year DESC`,
      [req.user.id]
    );

    // Longest leave
    const longestLeave = await db.get(
      `SELECT 
        la.number_of_days,
        la.start_date,
        lt.name as leave_type
       FROM leave_applications la
       JOIN leave_types lt ON la.leave_type_id = lt.id
       WHERE la.user_id = ? AND la.status = 'approved'
       ORDER BY la.number_of_days DESC
       LIMIT 1`,
      [req.user.id]
    );

    // Total applications this year
    const yearStats = await db.get(
      `SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
        SUM(CASE WHEN status = 'approved' THEN number_of_days ELSE 0 END) as total_approved_days
       FROM leave_applications
       WHERE user_id = ? AND strftime('%Y', start_date) = ?`,
      [req.user.id, targetYear.toString()]
    );

    res.json({
      success: true,
      year: targetYear,
      monthlyData,
      leaveTypeBreakdown,
      yearOverYear,
      longestLeave,
      yearStats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching analytics',
      error: error.message
    });
  }
};

// Get Team Statistics (for comparison)
const getTeamStats = async (req, res) => {
  try {
    const db = getDatabase();
    const { year } = req.query;
    const targetYear = year ? parseInt(year) : new Date().getFullYear();

    // Get user's department
    const user = await db.get('SELECT department FROM users WHERE id = ?', [req.user.id]);

    if (!user || !user.department) {
      return res.json({
        success: true,
        teamAverage: 0,
        userUsage: 0,
        comparison: 'Unable to compare'
      });
    }

    // Team average (excluding current user)
    const teamStats = await db.get(
      `SELECT 
        COUNT(DISTINCT u.id) as team_members,
        ROUND(AVG(CASE WHEN la.status = 'approved' THEN la.number_of_days ELSE 0 END), 1) as avg_days_used
       FROM users u
       LEFT JOIN leave_applications la ON u.id = la.user_id 
         AND la.status = 'approved'
         AND strftime('%Y', la.start_date) = ?
       WHERE u.department = ? AND u.id != ?`,
      [targetYear.toString(), user.department, req.user.id]
    );

    // User's usage
    const userUsage = await db.get(
      `SELECT 
        COALESCE(SUM(number_of_days), 0) as total_days
       FROM leave_applications
       WHERE user_id = ? AND status = 'approved' AND strftime('%Y', start_date) = ?`,
      [req.user.id, targetYear.toString()]
    );

    const avgDays = teamStats?.avg_days_used || 0;
    const userDays = userUsage?.total_days || 0;
    const difference = userDays - avgDays;

    res.json({
      success: true,
      teamAverage: avgDays,
      userUsage: userDays,
      difference,
      teamSize: teamStats?.team_members || 0,
      comparison: difference > 0 
        ? `You use ${Math.abs(difference).toFixed(1)} more days than team average`
        : difference < 0
        ? `You use ${Math.abs(difference).toFixed(1)} fewer days than team average`
        : 'You match team average'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching team statistics',
      error: error.message
    });
  }
};

// Get Carry-over and Expiry Information
const getCarryoverData = async (req, res) => {
  try {
    const db = getDatabase();
    const currentYear = new Date().getFullYear();
    const lastYear = currentYear - 1;

    // Get carry-over from last year
    const carryoverData = await db.all(
      `SELECT 
        lt.name as leave_type,
        lb.remaining_days as carried_over_days,
        CASE WHEN lb.remaining_days > 0 THEN 'Active' ELSE 'Expired' END as status
       FROM leave_balance lb
       JOIN leave_types lt ON lb.leave_type_id = lt.id
       WHERE lb.user_id = ? AND lb.year = ?
       ORDER BY lt.name`,
      [req.user.id, lastYear]
    );

    // Get current year balance for expiry info
    const currentBalance = await db.all(
      `SELECT 
        lt.name as leave_type,
        lt.annual_limit,
        lb.remaining_days,
        CASE WHEN lb.remaining_days > 0 THEN 'Safe' ELSE 'Expired' END as status
       FROM leave_balance lb
       JOIN leave_types lt ON lb.leave_type_id = lt.id
       WHERE lb.user_id = ? AND lb.year = ?
       ORDER BY lt.name`,
      [req.user.id, currentYear]
    );

    const totalCarriedOver = carryoverData.reduce((sum, item) => sum + (item.carried_over_days || 0), 0);
    const totalExpiring = currentBalance.reduce((sum, item) => sum + (item.remaining_days || 0), 0);

    res.json({
      success: true,
      carriedFromLastYear: carryoverData,
      totalCarriedOver,
      currentYearBalance: currentBalance,
      totalExpiringSoon: totalExpiring
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching carry-over data',
      error: error.message
    });
  }
};

/**
 * Send final approval emails when a leave application is fully approved.
 * Called from both leaveController and approvalRoutes.
 */
const sendFinalApprovalEmails = async (db, applicationId, approvedDays) => {
  try {
    const leaveApp = await db.get(
      `SELECT la.user_id, la.leave_type_id, la.start_date, la.end_date, la.number_of_days,
        lt.name as leave_type,
        u.email as applicant_email, u.phone as applicant_phone,
        u.first_name as applicant_first, u.last_name as applicant_last, u.employee_id
       FROM leave_applications la
       JOIN leave_types lt ON la.leave_type_id = lt.id
       JOIN users u ON la.user_id = u.id
       WHERE la.id = ?`,
      [applicationId]
    );

    if (!leaveApp) return;

    const days = approvedDays || leaveApp.number_of_days;

    // Send polished HTML approval email to applicant
    await sendLeaveApprovalEmail({
      to: leaveApp.applicant_email,
      firstName: leaveApp.applicant_first,
      leaveType: leaveApp.leave_type,
      startDate: leaveApp.start_date,
      endDate: leaveApp.end_date,
      numberOfDays: days,
      comments: null
    }).catch(err => console.error('Approval email error:', err.message));

  } catch (err) {
    console.error('sendFinalApprovalEmails error:', err.message);
  }
};

module.exports = {
  submitLeaveApplication,
  getLeaveApplications,
  updateLeaveApplicationStatus,
  getLeaveTypes,
  getLeaveBalance,
  getLeaveApplicationById,
  updateOwnLeaveApplication,
  downloadLeaveApplication,
  cancelLeaveApplication,
  getAnalyticsTrends,
  getTeamStats,
  getCarryoverData,
  sendFinalApprovalEmails
};
