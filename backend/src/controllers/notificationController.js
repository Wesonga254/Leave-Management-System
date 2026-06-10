const { getDatabase } = require('../database');

const createLeaveEndingReminders = async (db, userId) => {
  const today = new Date();
  const reminderWindow = new Date(today);
  reminderWindow.setDate(today.getDate() + 3);
  const toISO = (date) => date.toISOString().slice(0, 10);

  const approvedLeaves = await db.all(
    `SELECT la.id, la.end_date, lt.name as leave_type
     FROM leave_applications la
     JOIN leave_types lt ON la.leave_type_id = lt.id
     WHERE la.user_id = ?
       AND la.status = 'approved'
       AND date(la.end_date) BETWEEN date(?) AND date(?)`,
    [userId, toISO(today), toISO(reminderWindow)]
  );

  for (const leave of approvedLeaves) {
    const existing = await db.get(
      `SELECT id FROM notifications
       WHERE user_id = ?
         AND type = 'leave_ending_reminder'
         AND reference_id = ?
       LIMIT 1`,
      [userId, leave.id]
    );

    if (!existing) {
      await db.run(
        `INSERT INTO notifications (user_id, type, title, message, reference_id)
         VALUES (?, ?, ?, ?, ?)`,
        [
          userId,
          'leave_ending_reminder',
          'Leave Ending Soon',
          `Your approved ${leave.leave_type} leave ends on ${leave.end_date}. Please prepare to resume duty or submit an extension if needed.`,
          leave.id
        ]
      );
    }
  }
};

const listMyNotifications = async (req, res) => {
  try {
    const db = getDatabase();
    const userId = req.user.id;
    await createLeaveEndingReminders(db, userId);
    const page = Math.max(1, parseInt(req.query.page || '1'));
    const limit = Math.min(100, Math.max(5, parseInt(req.query.limit || '20')));
    const unreadOnly = req.query.unread === '1' || req.query.unread === 'true';

    const whereClause = unreadOnly ? 'AND is_read = 0' : '';

    // total and unread counts
    const totalRow = await db.get(`SELECT COUNT(*) as total FROM notifications WHERE user_id = ? ${whereClause}`, [userId]);
    const unreadRow = await db.get('SELECT COUNT(*) as unread FROM notifications WHERE user_id = ? AND is_read = 0', [userId]);

    const offset = (page - 1) * limit;
    const rows = await db.all(
      `SELECT id, type, title, message, reference_id, is_read, created_at FROM notifications WHERE user_id = ? ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [userId, limit, offset]
    );

    res.json({ success: true, data: rows, meta: { page, limit, total: totalRow.total, unreadCount: unreadRow.unread } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const markAsRead = async (req, res) => {
  try {
    const db = getDatabase();
    const userId = req.user.id;
    const id = req.params.id;
    // ensure notification belongs to user
    const notif = await db.get('SELECT id FROM notifications WHERE id = ? AND user_id = ?', [id, userId]);
    if (!notif) return res.status(404).json({ success: false, message: 'Notification not found' });
    await db.run('UPDATE notifications SET is_read = 1 WHERE id = ?', [id]);
    res.json({ success: true, message: 'Marked as read' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  listMyNotifications,
  markAsRead
};
