/**
 * iCal (.ics) generator for leave applications.
 * Produces a valid iCalendar file that can be imported into
 * Google Calendar, Outlook, Apple Calendar, etc.
 */

const formatICalDate = (dateStr) => {
  // Convert YYYY-MM-DD to YYYYMMDD (all-day event format)
  return dateStr.replace(/-/g, '');
};

const escapeICalText = (text) => {
  if (!text) return '';
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
};

const generateUID = (appId, domain) => {
  return `leave-${appId}@${domain || 'leave-management.local'}`;
};

/**
 * Generate an iCal string for a single leave application.
 */
const generateSingleEvent = (app) => {
  const startDate = formatICalDate(app.start_date);
  // End date for all-day events is exclusive, so add 1 day
  const endDateObj = new Date(app.end_date);
  endDateObj.setDate(endDateObj.getDate() + 1);
  const endDate = endDateObj.toISOString().slice(0, 10).replace(/-/g, '');

  const name = [app.first_name, app.last_name].filter(Boolean).join(' ') || 'Employee';
  const leaveType = app.leave_type || app.leave_type_name || 'Leave';
  const summary = `${name} - ${leaveType}`;
  const description = [
    `Leave Type: ${leaveType}`,
    `Days: ${app.number_of_days || ''}`,
    `Status: ${(app.status || '').charAt(0).toUpperCase() + (app.status || '').slice(1)}`,
    app.reason ? `Reason: ${app.reason}` : ''
  ].filter(Boolean).join('\\n');

  const now = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

  return [
    'BEGIN:VEVENT',
    `UID:${generateUID(app.id)}`,
    `DTSTART;VALUE=DATE:${startDate}`,
    `DTEND;VALUE=DATE:${endDate}`,
    `SUMMARY:${escapeICalText(summary)}`,
    `DESCRIPTION:${escapeICalText(description)}`,
    `STATUS:CONFIRMED`,
    `TRANSP:OPAQUE`,
    `DTSTAMP:${now}`,
    `CREATED:${now}`,
    'END:VEVENT'
  ].join('\r\n');
};

/**
 * Generate a complete .ics file for multiple leave applications.
 */
const generateICalFeed = (applications, calendarName) => {
  const header = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Busia County//Leave Management System//EN',
    `X-WR-CALNAME:${escapeICalText(calendarName || 'Leave Calendar')}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH'
  ].join('\r\n');

  const events = applications.map(app => generateSingleEvent(app)).join('\r\n');

  const footer = 'END:VCALENDAR';

  return `${header}\r\n${events}\r\n${footer}\r\n`;
};

module.exports = {
  generateICalFeed,
  generateSingleEvent
};
