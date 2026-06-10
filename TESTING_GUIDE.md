# Testing Guide - Leave Management System

This guide covers comprehensive testing of the Leave Management System with all features including authentication, leave applications, approvals, document uploads, and reports.

---

## Prerequisites

- Backend running on `http://localhost:5000`
- Frontend running on `http://localhost:3000`
- Database initialized with seed data
- Multer uploads directory created

---

## Test Accounts

### Accounts created during seed/registration:

**Employee Account**
- Username: `john_doe`
- Employee ID: `EMP001`
- Password: `password123`
- Role: Employee
- Department: IT

**Supervisor Account**
- Username: `jane_smith`
- Employee ID: `SUP001`
- Password: `password123`
- Role: Supervisor
- Department: IT

**HR Account**
- Username: `hr_officer`
- Employee ID: `HR001`
- Password: `password123`
- Role: HR
- Department: Human Resources

**Admin Account**
- Username: `admin_user`
- Employee ID: `ADM001`
- Password: `password123`
- Role: Admin
- Department: Administration

---

## Test Scenarios

### 1. AUTHENTICATION TESTS

#### Test 1.1: Valid Login
**Steps:**
1. Navigate to `http://localhost:3000`
2. Enter username: `john_doe`
3. Enter employee_id: `EMP001`
4. Enter password: `password123`
5. Click Login

**Expected Result:**
- ✓ Successful authentication
- ✓ Redirect to dashboard
- ✓ Token stored in localStorage
- ✓ Navigation shows logged-in user

**Validation:**
```javascript
// In browser console
localStorage.getItem('token')  // Should return JWT token
localStorage.getItem('userRole')  // Should return 'employee'
localStorage.getItem('userId')  // Should return user ID
```

---

#### Test 1.2: Invalid Credentials
**Steps:**
1. Navigate to login page
2. Enter username: `john_doe`
3. Enter employee_id: `WRONG001`
4. Enter password: `password123`
5. Click Login

**Expected Result:**
- ✗ Error message: "Invalid credentials"
- ✗ Stay on login page
- ✗ No token created

---

#### Test 1.3: Registration & Login
**Steps:**
1. Click "Register" link on login page
2. Fill in all required fields:
   - Username: `test_emp`
   - Employee ID: `EMP999`
   - Password: `Test@1234`
   - Email: `test@company.com`
   - Phone: `9876543210`
   - First Name: `Test`
   - Last Name: `Employee`
   - Department: `IT`
   - Designation: `Officer`
3. Click Register
4. Wait for redirect to login
5. Log in with new credentials

**Expected Result:**
- ✓ Account created
- ✓ Leave balances initialized for all leave types
- ✓ Able to login with new credentials
- ✓ Dashboard loads with 0 days used

---

### 2. DASHBOARD TESTS

#### Test 2.1: View Leave Balance
**Steps:**
1. Login as employee
2. Click "Dashboard" in navigation
3. Observe statistics and tables

**Expected Result:**
- ✓ Total leave days displayed (sum of all types)
- ✓ Days used displayed (0 for new employee)
- ✓ Remaining days displayed
- ✓ Table shows breakdown by leave type
- ✓ Initial balances match seed data:
  - Annual: 30 days
  - Sick: 10 days
  - Casual: 5 days
  - Maternity: 90 days
  - Bereavement: 3 days
  - Parental: 15 days

**Validation:**
```javascript
// Expected totals
Total: 153 days
Used: 0 days
Remaining: 153 days
```

---

### 3. LEAVE APPLICATION TESTS

#### Test 3.1: Submit Valid Leave Application
**Steps:**
1. Login as employee (john_doe)
2. Click "Apply Leave"
3. Fill form:
   - Leave Type: Annual Leave
   - Start Date: Select date 5 days from today
   - End Date: Select date 10 days from today
   - Reason: "Team building event"
4. Verify "Number of Days" calculates correctly
5. Click "Submit Application"

**Expected Result:**
- ✓ Success message: "Leave application submitted successfully"
- ✓ Form clears
- ✓ AttachmentManager section appears
- ✓ ApplicationId available for uploads

**Validation - Database:**
```sql
SELECT * FROM leave_applications 
WHERE user_id = (SELECT id FROM users WHERE username = 'john_doe')
LIMIT 1;

-- Should show:
-- id, user_id, leave_type_id, start_date, end_date, number_of_days, reason
-- status: 'pending', created_at: timestamp
```

---

#### Test 3.2: Day Calculation
**Steps:**
1. Apply Leave with:
   - Start: June 1, 2026
   - End: June 5, 2026

**Expected Result:**
- ✓ Number of Days = 5
- ✓ Calculation: 5 days inclusive

**Test multiple scenarios:**
- Same day: 1 day
- Next day: 2 days
- 1 week: 8 days

---

#### Test 3.3: Insufficient Balance
**Steps:**
1. Login as employee with low balance
2. Apply for 50 days of Annual Leave (only 30 available)
3. Submit

**Expected Result:**
- ✗ Error message: "Insufficient leave balance"
- ✗ Application not submitted

---

#### Test 3.4: Invalid Date Range
**Steps:**
1. Apply Leave with:
   - Start: June 5, 2026
   - End: June 1, 2026
2. Click Submit

**Expected Result:**
- ✗ Error message: "End date must be after start date"
- ✗ Form validation prevents submission

---

### 4. DOCUMENT UPLOAD TESTS

#### Test 4.1: Single Document Upload
**Steps:**
1. Submit leave application (as in Test 3.1)
2. AttachmentManager appears
3. Click "Choose file..." button
4. Select a PDF file (< 5MB)
5. Click Upload button

**Expected Result:**
- ✓ Upload success message
- ✓ File appears in table with:
  - File name
  - File size (formatted as KB/MB)
  - File type (icon)
  - Uploader name
  - Upload timestamp
  - Download button
  - Delete button

**Validation - Database:**
```sql
SELECT * FROM attachments 
WHERE leave_application_id = (SELECT id FROM leave_applications 
                              WHERE user_id = 1 ORDER BY id DESC LIMIT 1);

-- Should show: id, application_id, file_name, file_path, file_size, file_type, uploaded_by, created_at
```

---

#### Test 4.2: Multiple Document Upload
**Steps:**
1. After Test 4.1, upload another document:
   - Medical Certificate (JPEG)
2. Upload third document:
   - Hospital Report (PDF)

**Expected Result:**
- ✓ All 3 documents visible in table
- ✓ Each with correct metadata
- ✓ Table scrolls if many files

---

#### Test 4.3: File Type Validation
**Steps:**
1. Try uploading: `.exe` file
2. Try uploading: `.zip` file
3. Try uploading: `.doc` file

**Expected Result:**
- ✗ EXE/ZIP rejected: "File type not allowed"
- ✓ DOC accepted

---

#### Test 4.4: File Size Validation
**Steps:**
1. Create/select file > 5MB
2. Try uploading

**Expected Result:**
- ✗ Error: "File size exceeds 5MB limit"
- ✗ Upload blocked

---

#### Test 4.5: Download Document
**Steps:**
1. Have document uploaded (Test 4.1)
2. Click Download button for that file

**Expected Result:**
- ✓ File downloads to browser default location
- ✓ Original filename preserved
- ✓ File content correct and uncorrupted

---

#### Test 4.6: Delete Document
**Steps:**
1. Have document uploaded
2. Click Delete button
3. Confirm deletion in dialog

**Expected Result:**
- ✓ Document removed from table
- ✓ File deleted from server filesystem
- ✓ Record deleted from database

**Validation - File System:**
```bash
# Document should no longer exist
ls -la backend/uploads/ | grep {filename}
# Should return no results
```

---

### 5. LEAVE HISTORY TESTS

#### Test 5.1: View Applications
**Steps:**
1. Click "History" in navigation
2. Observe applications list

**Expected Result:**
- ✓ Shows all personal applications
- ✓ Latest first
- ✓ Shows: Leave Type, Dates, Days, Reason, Status, Submit Date

---

#### Test 5.2: Filter by Status
**Steps:**
1. On History page
2. Click Status filter dropdown
3. Select "Pending"

**Expected Result:**
- ✓ Shows only pending applications
- ✓ Other statuses hidden
- ✓ Count updated

---

### 6. APPROVAL WORKFLOW TESTS

#### Test 6.1: Supervisor Review
**Steps:**
1. Login as supervisor (jane_smith)
2. Click "Approvals" in navigation
3. Verify pending applications shown
4. Click "Review" button on john_doe's application

**Expected Result:**
- ✓ Modal opens with full details:
  - Employee name and ID
  - Leave type and duration
  - Reason
  - Submitted date
  - **Supporting Documents section**
  - All uploaded files listed
  - Download buttons for each document

---

#### Test 6.2: Download Document in Review
**Steps:**
1. In approval modal (Test 6.1)
2. Click Download for a document
3. Verify document content

**Expected Result:**
- ✓ Document downloads correctly
- ✓ Can verify authenticity offline
- ✓ Original format preserved

---

#### Test 6.3: Approve Application
**Steps:**
1. In approval modal
2. Add comment: "Approved - All documents verified"
3. Click "Approve" button

**Expected Result:**
- ✓ Modal closes
- ✓ Success message
- ✓ Application moves to next level (HR)
- ✓ Employee receives notification
- ✓ Balance not yet deducted (awaiting final approval)

**Validation - Database:**
```sql
SELECT * FROM approval_workflow 
WHERE leave_application_id = {app_id};

-- Should show:
-- approval_level=1: status='approved', comments='Approved - All documents verified'
-- approval_level=2: status='pending'
```

---

#### Test 6.4: Reject Application
**Steps:**
1. Submit another leave application (Test 3.1)
2. Login as supervisor
3. Click Review on new application
4. Add comment: "Cannot spare staff during this period"
5. Click "Reject" button

**Expected Result:**
- ✓ Application status = 'rejected'
- ✓ Employee receives rejection notification
- ✓ No further approvals occur
- ✓ Leave balance not deducted
- ✓ Documents still viewable

---

#### Test 6.5: Multi-Level Approval
**Steps:**
1. Application approved by supervisor ✓
2. Login as HR (hr_officer)
3. Click Approvals
4. Review and approve application
5. Login as Admin
6. Review and approve application
7. Check employee balance

**Expected Result:**
- ✓ Each level reviews documents
- ✓ Final approval deducts from balance
- ✓ Employee balance: 30 - 5 = 25 for Annual Leave
- ✓ Notifications sent at each stage

---

### 7. REPORTS TESTS

#### Test 7.1: Access Reports
**Steps:**
1. Login as HR (hr_officer)
2. Click "Reports" in navigation
3. Observe tabs

**Expected Result:**
- ✓ Reports page accessible (HR/Admin only)
- ✓ Tabs visible: Summary, Balance, Trends, Pending, History
- ✓ Year filter available (2024, 2025, 2026)

---

#### Test 7.2: Summary Dashboard
**Steps:**
1. On Reports page
2. Ensure "Summary" tab selected
3. Observe statistics

**Expected Result:**
- ✓ Total employees count
- ✓ Approved applications count
- ✓ Pending applications count
- ✓ Rejected applications count
- ✓ Department breakdown table

---

#### Test 7.3: Leave Balance Report
**Steps:**
1. Click "Balance" tab
2. Observe chart and table

**Expected Result:**
- ✓ Bar chart shows days by leave type
- ✓ Table shows detailed breakdown:
  - Leave Type, Total Days, Used, Remaining, %
- ✓ Totals accurate
- ✓ Year filter works

---

#### Test 7.4: Monthly Trends
**Steps:**
1. Click "Trends" tab
2. Observe line chart
3. Review monthly breakdown

**Expected Result:**
- ✓ Line chart shows trend
- ✓ Table shows monthly data
- ✓ Projections calculated
- ✓ Responsive design

---

#### Test 7.5: Pending Approvals Report
**Steps:**
1. Click "Pending" tab
2. Observe applications awaiting action

**Expected Result:**
- ✓ Shows applications by approval level
- ✓ Days pending calculated
- ✓ Employee and leave type visible
- ✓ Filtered by current approver

---

#### Test 7.6: Report Filtering
**Steps:**
1. On any report tab
2. Change year filter to 2024
3. Observe data updates
4. Change back to 2025

**Expected Result:**
- ✓ Data updates based on filter
- ✓ Charts re-render
- ✓ Tables refresh
- ✓ No errors

---

### 8. ROLE-BASED ACCESS TESTS

#### Test 8.1: Employee Permissions
**Steps:**
1. Login as employee
2. Check navigation menu

**Expected Result:**
- ✓ Dashboard - Available
- ✓ Apply Leave - Available
- ✓ History - Available
- ✓ Approvals - NOT available
- ✓ Reports - NOT available

---

#### Test 8.2: Supervisor Permissions
**Steps:**
1. Login as supervisor
2. Check navigation menu

**Expected Result:**
- ✓ Dashboard - Available
- ✓ Apply Leave - Available
- ✓ History - Available
- ✓ Approvals - Available ✓
- ✓ Reports - NOT available

---

#### Test 8.3: HR Permissions
**Steps:**
1. Login as HR
2. Check navigation menu

**Expected Result:**
- ✓ Dashboard - Available
- ✓ Apply Leave - Available
- ✓ History - Available
- ✓ Approvals - Available
- ✓ Reports - Available ✓

---

#### Test 8.4: Admin Permissions
**Steps:**
1. Login as admin
2. Check navigation menu

**Expected Result:**
- ✓ All options available
- ✓ Can access all reports
- ✓ Can perform all approvals

---

### 9. SECURITY TESTS

#### Test 9.1: Token Expiry
**Steps:**
1. Login successfully
2. Wait 24 hours (or manually modify token expiry in code)
3. Perform action requiring authentication
4. Observe behavior

**Expected Result:**
- ✗ Action fails with "Unauthorized"
- ✗ Redirects to login
- ✗ Must login again

---

#### Test 9.2: Direct URL Access
**Steps:**
1. Logout
2. Navigate directly to: `http://localhost:3000/dashboard`
3. Observe redirect

**Expected Result:**
- ✗ Redirects to login page
- ✗ Protected routes enforced

---

#### Test 9.3: SQL Injection Test
**Steps:**
1. Login page
2. Username field: `' OR '1'='1`
3. Password: `anything`
4. Click Login

**Expected Result:**
- ✗ Error: "Invalid credentials"
- ✗ Query parameterization prevents injection

---

#### Test 9.4: CORS Test
**Steps:**
1. Open browser console
2. From different origin, make API call
3. Verify CORS headers

**Expected Result:**
- ✓ Proper CORS headers returned
- ✓ Cross-origin requests handled correctly

---

### 10. EDGE CASE TESTS

#### Test 10.1: Same Day Leave
**Steps:**
1. Apply leave: Start = End (same date)
2. Check days calculation

**Expected Result:**
- ✓ Days = 1
- ✓ Application accepted

---

#### Test 10.2: Weekend Leave
**Steps:**
1. Apply leave: Friday to Monday (crosses weekend)
2. Check days calculation

**Expected Result:**
- ✓ Days = 4 (includes weekend days)
- ✓ No special weekend handling

---

#### Test 10.3: Zero Documents
**Steps:**
1. Submit leave application
2. Don't upload any documents
3. Proceed to approval

**Expected Result:**
- ✓ Application valid without documents
- ✓ Approval workflow proceeds
- ✓ Empty attachments table shown

---

#### Test 10.4: Many Documents
**Steps:**
1. Submit leave
2. Upload 5 documents (max allowed)
3. Try uploading 6th document

**Expected Result:**
- ✓ First 5 upload successfully
- ✓ 6th rejected with error: "Max 5 documents allowed"

---

### 11. PERFORMANCE TESTS

#### Test 11.1: Report Generation Speed
**Steps:**
1. Generate summary report with 100+ applications
2. Measure load time

**Expected Result:**
- ✓ Report loads within 2 seconds
- ✓ Charts render smoothly
- ✓ No UI freezing

---

#### Test 11.2: Large File Upload
**Steps:**
1. Upload 4.9MB file
2. Monitor network activity

**Expected Result:**
- ✓ Upload succeeds
- ✓ Progress indication works
- ✓ No timeout errors

---

### 12. INTEGRATION TESTS

#### Test 12.1: Complete Workflow
**Steps:**
1. Employee logs in
2. Views dashboard
3. Applies for leave with reason
4. Uploads 2 supporting documents
5. Supervisor reviews documents
6. Supervisor approves
7. HR reviews and approves
8. Chief approves
9. Employee checks balance updated
10. HR generates reports

**Expected Result:**
- ✓ Complete workflow succeeds
- ✓ Balance updated correctly
- ✓ Documents visible throughout
- ✓ Approvals tracked properly
- ✓ Reports show accurate data

---

## Test Data Checklist

- [ ] 5+ employees created
- [ ] 3+ leave applications submitted
- [ ] Applications at different approval stages
- [ ] Documents uploaded to applications
- [ ] At least one rejected application
- [ ] At least one fully approved application
- [ ] Leave balances deducted correctly

---

## Expected Database State After Tests

```sql
-- Check users created
SELECT COUNT(*) FROM users;  -- Should be 5+ (seed + new registrations)

-- Check applications
SELECT COUNT(*) FROM leave_applications;  -- Should be 3+

-- Check approvals
SELECT COUNT(*) FROM approval_workflow;  -- Should be 9+ (3 levels per app)

-- Check attachments
SELECT COUNT(*) FROM attachments;  -- Should be 5+

-- Check updated balances
SELECT * FROM leave_balance 
WHERE user_id = (SELECT id FROM users WHERE username = 'john_doe')
ORDER BY leave_type_id;  -- Should show deductions for approved leaves
```

---

## Troubleshooting Test Issues

### Application Won't Submit
- Check: All required fields filled
- Check: Leave balance sufficient
- Check: Database connection active
- Action: Check console for error messages

### Documents Won't Upload
- Check: File under 5MB
- Check: File type in allowed list
- Check: Uploads directory exists and is writable
- Action: Check server logs for errors

### Reports Won't Load
- Check: Logged in as HR/Admin
- Check: Year filter set correctly
- Check: Database has data
- Action: Check network tab in DevTools

### Approval Won't Process
- Check: Logged in as supervisor/HR/admin
- Check: User has correct role
- Check: Application not already approved/rejected
- Action: Check backend logs

---

## Test Results Documentation

### Template for Recording Results

```
Test ID: [e.g., 3.1]
Test Name: [e.g., Submit Valid Leave Application]
Date: [YYYY-MM-DD]
Tester: [Name]
Result: [PASS / FAIL]
Notes: [Any issues or observations]
Time: [MM:SS]
```

### Example Log
```
Test ID: 3.1
Test Name: Submit Valid Leave Application
Date: 2026-05-27
Tester: QA Team
Result: PASS
Notes: Form validation working, day calculation correct
Time: 02:15

Test ID: 4.1
Test Name: Single Document Upload
Date: 2026-05-27
Tester: QA Team
Result: PASS
Notes: PDF uploaded successfully, displayed in table with metadata
Time: 01:45
```

---

## Regression Testing

After any code changes:

1. Run all authentication tests (Section 1)
2. Run all leave application tests (Section 3)
3. Run all document tests (Section 4)
4. Run all approval tests (Section 6)
5. Run integration test (Section 12.1)

**Time Estimate:** 30-45 minutes

---

**For detailed debugging, check:**
- Browser Console (F12 → Console tab)
- Network Tab (F12 → Network tab)
- Backend Terminal logs
- Database directly using SQLite client

---

**Test Status:** Ready for QA
**Last Updated:** May 27, 2026
**Version:** 1.0
