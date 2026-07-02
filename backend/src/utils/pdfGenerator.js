const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

const LOGO_PATH = path.join(__dirname, '../../../county logo.png');
const COLORS = {
  primary: '#1e3a5f',
  accent: '#2d6bb0',
  green: '#065f46',
  red: '#991b1b',
  amber: '#92400e',
  gray: '#64748b',
  lightGray: '#f1f5f9',
  white: '#ffffff',
  black: '#0f172a'
};

/**
 * Create a branded PDF document with shared header/footer.
 */
const createDocument = (title, options = {}) => {
  const doc = new PDFDocument({
    size: options.landscape ? [842, 595] : 'A4',
    margin: 40,
    bufferPages: true,
    info: {
      Title: title,
      Author: 'Busia County Leave Management System',
      Creator: 'Leave Management System'
    }
  });

  // Header
  const logoExists = fs.existsSync(LOGO_PATH);
  if (logoExists) {
    doc.image(LOGO_PATH, 40, 30, { width: 45 });
  }
  const headerX = logoExists ? 95 : 40;
  doc.fontSize(16).fillColor(COLORS.primary).font('Helvetica-Bold')
    .text('County Government of Busia', headerX, 35);
  doc.fontSize(10).fillColor(COLORS.gray).font('Helvetica')
    .text('Leave Management System', headerX, 55);
  doc.fontSize(14).fillColor(COLORS.primary).font('Helvetica-Bold')
    .text(title, headerX, 75);

  // Divider
  doc.moveTo(40, 100).lineTo(doc.page.width - 40, 100)
    .strokeColor(COLORS.accent).lineWidth(1.5).stroke();

  doc.y = 115;
  doc.fillColor(COLORS.black).font('Helvetica').fontSize(9);

  return doc;
};

/**
 * Draw a simple table on the PDF.
 */
const drawTable = (doc, headers, rows, options = {}) => {
  const startX = options.startX || 40;
  const colWidths = options.colWidths || headers.map(() => (doc.page.width - 80) / headers.length);
  const rowHeight = options.rowHeight || 22;
  const headerColor = options.headerColor || COLORS.primary;
  let y = doc.y;

  // Check if we need a new page
  const checkPage = () => {
    if (y + rowHeight > doc.page.height - 50) {
      doc.addPage();
      y = 40;
      return true;
    }
    return false;
  };

  // Header row
  doc.rect(startX, y, colWidths.reduce((a, b) => a + b, 0), rowHeight)
    .fill(headerColor);

  let x = startX;
  headers.forEach((header, i) => {
    doc.fillColor(COLORS.white).font('Helvetica-Bold').fontSize(8)
      .text(header, x + 4, y + 6, { width: colWidths[i] - 8, ellipsis: true });
    x += colWidths[i];
  });

  y += rowHeight;

  // Data rows
  rows.forEach((row, rowIdx) => {
    checkPage();
    const bg = rowIdx % 2 === 0 ? COLORS.lightGray : COLORS.white;
    doc.rect(startX, y, colWidths.reduce((a, b) => a + b, 0), rowHeight).fill(bg);

    x = startX;
    row.forEach((cell, i) => {
      doc.fillColor(COLORS.black).font('Helvetica').fontSize(8)
        .text(String(cell ?? ''), x + 4, y + 6, { width: colWidths[i] - 8, ellipsis: true });
      x += colWidths[i];
    });

    y += rowHeight;
  });

  // Table border
  const tableWidth = colWidths.reduce((a, b) => a + b, 0);
  const tableHeight = (rows.length + 1) * rowHeight;
  doc.rect(startX, doc.y - tableHeight + rowHeight, tableWidth, tableHeight)
    .strokeColor('#cbd5e1').lineWidth(0.5).stroke();

  doc.y = y + 10;
};

/**
 * Add a footer with date and page numbers.
 */
const addFooters = (doc) => {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc.fontSize(7).fillColor(COLORS.gray).font('Helvetica');
    const y = doc.page.height - 30;
    doc.text(
      `Generated on ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} — Leave Management System`,
      40, y, { width: doc.page.width - 160, align: 'left' }
    );
    doc.text(`Page ${i - range.start + 1} of ${range.count}`, doc.page.width - 120, y, { width: 80, align: 'right' });
  }
};

// ──────────────────────────────────────────────
// Report-specific generators
// ──────────────────────────────────────────────

const generateLeaveBalanceReport = (rows, year) => {
  const doc = createDocument(`Leave Balance Report — ${year}`, { landscape: true });

  doc.fontSize(9).fillColor(COLORS.gray)
    .text(`Year: ${year}  |  Total employees: ${new Set(rows.map(r => r.employee_id)).size}  |  Records: ${rows.length}`, 40, doc.y);
  doc.y += 10;

  const headers = ['Employee No', 'Name', 'Department', 'Leave Type', 'Total', 'Used', 'Remaining'];
  const colWidths = [80, 120, 160, 110, 55, 55, 65];
  const tableRows = rows.map(r => [
    r.employee_id, `${r.first_name} ${r.last_name}`, r.department || '',
    r.leave_type, r.total_days, r.used_days, r.remaining_days
  ]);

  drawTable(doc, headers, tableRows, { colWidths });
  addFooters(doc);
  return doc;
};

const generateDepartmentReport = (rows, year) => {
  const doc = createDocument(`Department Leave Report — ${year}`, { landscape: true });

  doc.fontSize(9).fillColor(COLORS.gray)
    .text(`Year: ${year}  |  Departments: ${new Set(rows.map(r => r.department)).size}`, 40, doc.y);
  doc.y += 10;

  const headers = ['Department', 'Total Employees', 'Approved Leaves', 'Days Approved', 'Pending', 'Rejected', 'Leave Type'];
  const colWidths = [160, 80, 80, 80, 60, 60, 110];
  const tableRows = rows.map(r => [
    r.department || '', r.total_employees, r.approved_leaves,
    r.total_days_approved || 0, r.pending_leaves || 0, r.rejected_leaves || 0, r.leave_type || ''
  ]);

  drawTable(doc, headers, tableRows, { colWidths });
  addFooters(doc);
  return doc;
};

const generatePendingApprovalsReport = (rows) => {
  const doc = createDocument('Pending Approvals Report', { landscape: true });

  doc.fontSize(9).fillColor(COLORS.gray)
    .text(`Total pending: ${rows.length}`, 40, doc.y);
  doc.y += 10;

  const headers = ['Employee No', 'Name', 'Department', 'Leave Type', 'Start', 'End', 'Days', 'Level', 'Waiting'];
  const colWidths = [75, 100, 130, 90, 70, 70, 40, 70, 55];
  const tableRows = rows.map(r => [
    r.employee_id, `${r.first_name} ${r.last_name}`, r.department || '',
    r.leave_type, r.start_date, r.end_date, r.number_of_days,
    (r.approval_level || '').replace(/_/g, ' '), r.days_pending ? `${r.days_pending}d` : '—'
  ]);

  drawTable(doc, headers, tableRows, { colWidths });
  addFooters(doc);
  return doc;
};

const generateMonthlyTrendsReport = (rows, year) => {
  const doc = createDocument(`Monthly Leave Trends — ${year}`);

  doc.fontSize(9).fillColor(COLORS.gray)
    .text(`Year: ${year}`, 40, doc.y);
  doc.y += 10;

  const headers = ['Month', 'Leave Type', 'Applications', 'Approved', 'Rejected', 'Pending', 'Days Approved'];
  const colWidths = [75, 100, 65, 60, 60, 60, 75];
  const tableRows = rows.map(r => [
    r.month_name || `Month ${r.month}`, r.leave_type || '', r.total_applications,
    r.approved_count, r.rejected_count, r.pending_count, r.approved_days
  ]);

  drawTable(doc, headers, tableRows, { colWidths });
  addFooters(doc);
  return doc;
};

module.exports = {
  generateLeaveBalanceReport,
  generateDepartmentReport,
  generatePendingApprovalsReport,
  generateMonthlyTrendsReport
};
