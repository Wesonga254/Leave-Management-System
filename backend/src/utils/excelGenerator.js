const ExcelJS = require('exceljs');

const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1e3a5f' } };
const HEADER_FONT = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10, name: 'Calibri' };
const HEADER_BORDER = {
  top: { style: 'thin', color: { argb: 'FFcbd5e1' } },
  bottom: { style: 'thin', color: { argb: 'FFcbd5e1' } },
  left: { style: 'thin', color: { argb: 'FFcbd5e1' } },
  right: { style: 'thin', color: { argb: 'FFcbd5e1' } }
};
const CELL_BORDER = {
  top: { style: 'hair', color: { argb: 'FFe2e8f0' } },
  bottom: { style: 'hair', color: { argb: 'FFe2e8f0' } },
  left: { style: 'hair', color: { argb: 'FFe2e8f0' } },
  right: { style: 'hair', color: { argb: 'FFe2e8f0' } }
};
const EVEN_ROW_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };

/**
 * Create a styled workbook with a title row and column headers.
 */
const createWorkbook = (sheetName, title, columns) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Leave Management System';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(sheetName, {
    properties: { defaultColWidth: 15 },
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true }
  });

  // Title row
  sheet.mergeCells(1, 1, 1, columns.length);
  const titleCell = sheet.getCell('A1');
  titleCell.value = title;
  titleCell.font = { bold: true, size: 14, color: { argb: 'FF1e3a5f' }, name: 'Calibri' };
  titleCell.alignment = { horizontal: 'left', vertical: 'middle' };
  sheet.getRow(1).height = 30;

  // Subtitle row
  sheet.mergeCells(2, 1, 2, columns.length);
  const subtitleCell = sheet.getCell('A2');
  subtitleCell.value = `Generated: ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} — County Government of Busia`;
  subtitleCell.font = { size: 9, color: { argb: 'FF64748b' }, italic: true, name: 'Calibri' };
  sheet.getRow(2).height = 20;

  // Empty separator row
  sheet.getRow(3).height = 8;

  // Header row (row 4)
  const headerRow = sheet.getRow(4);
  columns.forEach((col, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = col.header;
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.border = HEADER_BORDER;
    cell.alignment = { horizontal: col.align || 'left', vertical: 'middle', wrapText: true };
    sheet.getColumn(i + 1).width = col.width || 15;
  });
  headerRow.height = 24;

  return { workbook, sheet };
};

/**
 * Add data rows with alternating fill and auto-fit.
 */
const addRows = (sheet, columns, data) => {
  data.forEach((row, idx) => {
    const excelRow = sheet.getRow(5 + idx);
    columns.forEach((col, i) => {
      const cell = excelRow.getCell(i + 1);
      cell.value = col.key ? row[col.key] : '';
      cell.font = { size: 10, name: 'Calibri' };
      cell.border = CELL_BORDER;
      cell.alignment = { horizontal: col.align || 'left', vertical: 'middle' };
      if (idx % 2 === 0) cell.fill = EVEN_ROW_FILL;
    });
    excelRow.height = 20;
  });
};

// ──────────────────────────────────────────────
// Report-specific generators
// ──────────────────────────────────────────────

const generateLeaveBalanceExcel = async (rows, year) => {
  const columns = [
    { header: 'Employee No', key: 'employee_id', width: 14 },
    { header: 'First Name', key: 'first_name', width: 14 },
    { header: 'Last Name', key: 'last_name', width: 14 },
    { header: 'Department', key: 'department', width: 30 },
    { header: 'Leave Type', key: 'leave_type', width: 18 },
    { header: 'Total Days', key: 'total_days', width: 12, align: 'center' },
    { header: 'Used Days', key: 'used_days', width: 12, align: 'center' },
    { header: 'Remaining', key: 'remaining_days', width: 12, align: 'center' }
  ];

  const { workbook, sheet } = createWorkbook('Leave Balance', `Leave Balance Report — ${year}`, columns);
  addRows(sheet, columns, rows);

  // Summary row
  const summaryRowIdx = 5 + rows.length + 1;
  const summaryRow = sheet.getRow(summaryRowIdx);
  summaryRow.getCell(1).value = 'TOTAL';
  summaryRow.getCell(1).font = { bold: true, size: 10, name: 'Calibri' };
  summaryRow.getCell(6).value = rows.reduce((s, r) => s + (r.total_days || 0), 0);
  summaryRow.getCell(7).value = rows.reduce((s, r) => s + (r.used_days || 0), 0);
  summaryRow.getCell(8).value = rows.reduce((s, r) => s + (r.remaining_days || 0), 0);
  [6, 7, 8].forEach(col => {
    summaryRow.getCell(col).font = { bold: true, size: 10, name: 'Calibri' };
    summaryRow.getCell(col).alignment = { horizontal: 'center' };
  });

  return workbook;
};

const generateDepartmentExcel = async (rows, year) => {
  const columns = [
    { header: 'Department', key: 'department', width: 35 },
    { header: 'Total Employees', key: 'total_employees', width: 16, align: 'center' },
    { header: 'Approved Leaves', key: 'approved_leaves', width: 16, align: 'center' },
    { header: 'Days Approved', key: 'total_days_approved', width: 14, align: 'center' },
    { header: 'Pending', key: 'pending_leaves', width: 10, align: 'center' },
    { header: 'Rejected', key: 'rejected_leaves', width: 10, align: 'center' },
    { header: 'Leave Type', key: 'leave_type', width: 18 }
  ];

  const { workbook, sheet } = createWorkbook('Department Report', `Department Leave Report — ${year}`, columns);
  addRows(sheet, columns, rows);
  return workbook;
};

const generatePendingApprovalsExcel = async (rows) => {
  const columns = [
    { header: 'Employee No', key: 'employee_id', width: 14 },
    { header: 'First Name', key: 'first_name', width: 14 },
    { header: 'Last Name', key: 'last_name', width: 14 },
    { header: 'Department', key: 'department', width: 28 },
    { header: 'Leave Type', key: 'leave_type', width: 16 },
    { header: 'Start Date', key: 'start_date', width: 12 },
    { header: 'End Date', key: 'end_date', width: 12 },
    { header: 'Days', key: 'number_of_days', width: 8, align: 'center' },
    { header: 'Approval Level', key: 'approval_level', width: 14 },
    { header: 'Days Pending', key: 'days_pending', width: 13, align: 'center' }
  ];

  const { workbook, sheet } = createWorkbook('Pending Approvals', 'Pending Approvals Report', columns);
  addRows(sheet, columns, rows);
  return workbook;
};

const generateMonthlyTrendsExcel = async (rows, year) => {
  const columns = [
    { header: 'Month', key: 'month_name', width: 14 },
    { header: 'Leave Type', key: 'leave_type', width: 16 },
    { header: 'Applications', key: 'total_applications', width: 13, align: 'center' },
    { header: 'Approved', key: 'approved_count', width: 10, align: 'center' },
    { header: 'Rejected', key: 'rejected_count', width: 10, align: 'center' },
    { header: 'Pending', key: 'pending_count', width: 10, align: 'center' },
    { header: 'Days Approved', key: 'approved_days', width: 14, align: 'center' }
  ];

  const { workbook, sheet } = createWorkbook('Monthly Trends', `Monthly Leave Trends — ${year}`, columns);

  // Add month_name if missing
  const enrichedRows = rows.map(r => ({
    ...r,
    month_name: r.month_name || new Date(year, (r.month || 1) - 1).toLocaleString('default', { month: 'long' })
  }));

  addRows(sheet, columns, enrichedRows);
  return workbook;
};

module.exports = {
  generateLeaveBalanceExcel,
  generateDepartmentExcel,
  generatePendingApprovalsExcel,
  generateMonthlyTrendsExcel
};
