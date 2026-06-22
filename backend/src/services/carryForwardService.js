const { getDatabase } = require('../database');

const DEFAULT_LEAVE_YEAR_END_DATE = '12-31';

const normalizeYearEndDate = (value) => {
  const raw = String(value || DEFAULT_LEAVE_YEAR_END_DATE).trim();
  const match = raw.match(/^(\d{2})-(\d{2})$/);
  if (!match) return DEFAULT_LEAVE_YEAR_END_DATE;
  const month = Number(match[1]);
  const day = Number(match[2]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return DEFAULT_LEAVE_YEAR_END_DATE;
  return `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

const parseLimit = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

const toDateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const addDays = (date, days) => {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
};

const getSetting = async (db, key, fallback) => {
  const row = await db.get('SELECT value FROM settings WHERE key = ?', [key]);
  return row?.value ?? fallback;
};

const getScheduledCarryForwardYears = (date, leaveYearEndDate) => {
  const normalized = normalizeYearEndDate(leaveYearEndDate);
  const [month, day] = normalized.split('-').map(Number);
  const todayKey = toDateKey(date);

  for (const candidateYear of [date.getFullYear() - 1, date.getFullYear()]) {
    const endDate = new Date(candidateYear, month - 1, day);
    const runDate = addDays(endDate, 1);
    if (toDateKey(runDate) === todayKey) {
      return { fromYear: candidateYear, toYear: candidateYear + 1 };
    }
  }

  return null;
};

const runCarryForward = async ({ fromYear, toYear, source = 'manual', processedBy = null } = {}) => {
  const db = getDatabase();
  const currentYear = new Date().getFullYear();
  const sourceYear = Number(fromYear) || currentYear - 1;
  const targetYear = Number(toYear) || sourceYear + 1;

  if (targetYear !== sourceYear + 1) {
    throw new Error('Target year must be exactly one year after source year');
  }

  const balances = await db.all(
    `SELECT
       lb.user_id,
       lb.leave_type_id,
       lb.remaining_days,
       lb.used_days,
       u.gender,
       lt.annual_limit,
       lt.max_carry_forward_days,
       lt.applicable_gender
     FROM leave_balance lb
     JOIN users u ON lb.user_id = u.id
     JOIN leave_types lt ON lb.leave_type_id = lt.id
     WHERE lb.year = ?
       AND (
         lt.applicable_gender = 'All'
         OR LOWER(lt.applicable_gender) = LOWER(u.gender)
       )`,
    [sourceYear]
  );

  const summary = {
    fromYear: sourceYear,
    toYear: targetYear,
    processed: 0,
    carriedForward: 0,
    forfeited: 0
  };

  await db.exec('BEGIN TRANSACTION');
  try {
    for (const balance of balances) {
      const remaining = Math.max(0, Number(balance.remaining_days) || 0);
      const limit = parseLimit(balance.max_carry_forward_days);
      const carried = Math.min(remaining, limit);
      const forfeited = Math.max(0, remaining - carried);
      const openingTotal = (Number(balance.annual_limit) || 0) + carried;

      await db.run(
        `INSERT OR IGNORE INTO leave_balance (user_id, leave_type_id, year, total_days, used_days, remaining_days)
         VALUES (?, ?, ?, ?, 0, ?)`,
        [balance.user_id, balance.leave_type_id, targetYear, openingTotal, openingTotal]
      );

      await db.run(
        `UPDATE leave_balance
         SET total_days = ?,
             remaining_days = MAX(0, ? - COALESCE(used_days, 0)),
             updated_at = CURRENT_TIMESTAMP
         WHERE user_id = ? AND leave_type_id = ? AND year = ?`,
        [openingTotal, openingTotal, balance.user_id, balance.leave_type_id, targetYear]
      );

      await db.run(
        `INSERT OR REPLACE INTO leave_carry_forward_log (
           user_id, leave_type_id, from_year, to_year, remaining_days,
           amount_carried, amount_forfeited, max_carry_forward_days,
           processed_by, source, processed_at
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [
          balance.user_id,
          balance.leave_type_id,
          sourceYear,
          targetYear,
          remaining,
          carried,
          forfeited,
          limit,
          processedBy,
          source
        ]
      );

      summary.processed += 1;
      summary.carriedForward += carried;
      summary.forfeited += forfeited;
    }

    await db.exec('COMMIT');
  } catch (error) {
    await db.exec('ROLLBACK');
    throw error;
  }

  return summary;
};

const runScheduledCarryForwardIfDue = async (date = new Date()) => {
  const db = getDatabase();
  const configuredEndDate = await getSetting(db, 'LEAVE_YEAR_END_DATE', DEFAULT_LEAVE_YEAR_END_DATE);
  const years = getScheduledCarryForwardYears(date, configuredEndDate);
  if (!years) {
    return { due: false };
  }

  const summary = await runCarryForward({
    fromYear: years.fromYear,
    toYear: years.toYear,
    source: 'scheduled'
  });

  return { due: true, ...summary };
};

const startCarryForwardScheduler = () => {
  const run = async () => {
    try {
      const result = await runScheduledCarryForwardIfDue();
      if (result.due) {
        console.log('Leave carry-forward completed:', result);
      }
    } catch (error) {
      console.error('Leave carry-forward job failed:', error.message);
    }
  };

  run();
  return setInterval(run, 6 * 60 * 60 * 1000);
};

module.exports = {
  DEFAULT_LEAVE_YEAR_END_DATE,
  normalizeYearEndDate,
  runCarryForward,
  runScheduledCarryForwardIfDue,
  startCarryForwardScheduler
};
