# System Architecture & Reports Documentation

## System Overview

The Leave Management System is a comprehensive employee leave tracking application with advanced reporting capabilities. It follows a client-server architecture with separate frontend and backend components.

### Technology Stack

**Backend:**
- Node.js with Express.js framework
- SQLite database for data persistence
- JWT for secure authentication
- bcryptjs for password encryption

**Frontend:**
- React 18 for UI
- Chart.js for data visualization
- Axios for API communication
- React Router for navigation

## Database Schema

### Users Table
Stores employee account information and role management.

```sql
users (
  id INTEGER PRIMARY KEY,
  username TEXT UNIQUE,
  employee_id TEXT UNIQUE,
  password_hash TEXT,
  email TEXT,
  phone TEXT,
  first_name TEXT,
  last_name TEXT,
  department TEXT,
  designation TEXT,
  reporting_officer_id INTEGER,
  role TEXT (employee/supervisor/hr/admin),
  created_at DATETIME,
  updated_at DATETIME
)
```

### Leave Types Table
Defines available leave categories and limits.

```sql
leave_types (
  id INTEGER PRIMARY KEY,
  name TEXT UNIQUE,
  annual_limit INTEGER,
  description TEXT,
  created_at DATETIME
)
```

### Leave Balance Table
Tracks individual leave balances per employee, leave type, and year.

```sql
leave_balance (
  id INTEGER PRIMARY KEY,
  user_id INTEGER,
  leave_type_id INTEGER,
  year INTEGER,
  total_days INTEGER,
  used_days INTEGER,
  remaining_days INTEGER,
  created_at DATETIME,
  updated_at DATETIME
)
```

### Leave Applications Table
Records all leave requests submitted by employees.

```sql
leave_applications (
  id INTEGER PRIMARY KEY,
  user_id INTEGER,
  leave_type_id INTEGER,
  start_date DATE,
  end_date DATE,
  number_of_days INTEGER,
  reason TEXT,
  status TEXT (pending/approved/rejected),
  created_at DATETIME,
  updated_at DATETIME
)
```

### Approval Workflow Table
Manages the multi-level approval process.

```sql
approval_workflow (
  id INTEGER PRIMARY KEY,
  leave_application_id INTEGER,
  approver_id INTEGER,
  approval_level TEXT (supervisor/hr/chief_officer),
  status TEXT (pending/approved/rejected),
  comments TEXT,
  approved_at DATETIME,
  created_at DATETIME
)
```

### Notifications Table
Stores system notifications for users.

```sql
notifications (
  id INTEGER PRIMARY KEY,
  user_id INTEGER,
  leave_application_id INTEGER,
  type TEXT,
  message TEXT,
  is_read INTEGER,
  notification_method TEXT (email/sms/system),
  created_at DATETIME
)
```

## Report Types & Functionality

### 1. Summary Dashboard Report
**Endpoint:** `GET /api/reports/summary`

**Purpose:** Provides an overview of leave statistics and KPIs

**Data Returned:**
- Total employees on leave
- Total approved leaves (current year)
- Total pending leaves
- Total rejected leaves
- Total days used
- Department-wise breakdown

**Use Cases:**
- Executive dashboards
- Quick overview of leave status
- Department performance analysis

### 2. Employee Leave History Report
**Endpoint:** `GET /api/reports/employee-history/:user_id`

**Purpose:** Comprehensive leave record for a specific employee

**Data Returned:**
- All leave applications by employee
- Leave types used
- Start and end dates
- Number of days
- Approval status
- Submission dates

**Use Cases:**
- Individual employee records
- Verification of leave history
- Personal leave tracking

**Filters Available:**
- Date range
- Status (pending/approved/rejected)

### 3. Department Leave Report
**Endpoint:** `GET /api/reports/department`

**Purpose:** Aggregated leave data at department level

**Data Returned:**
- Department name
- Total employees
- Approved leaves count
- Pending leaves count
- Rejected leaves count
- Total days approved
- Leave type breakdown

**Use Cases:**
- Department head reporting
- Resource planning
- Workload assessment

**Filters Available:**
- Department selection
- Year selection

### 4. Leave Balance Report
**Endpoint:** `GET /api/reports/balance`

**Purpose:** Current leave balance status for all employees

**Data Returned:**
- Employee information
- Leave type
- Total days allocated
- Days used
- Remaining days
- Year

**Use Cases:**
- Leave balance verification
- Employee benefits tracking
- Forecasting leave availability
- Audit trails

**Features:**
- Export capability
- Filter by department
- Sort by remaining days

### 5. Pending Approval Report
**Endpoint:** `GET /api/reports/pending-approvals`

**Purpose:** Track all leaves awaiting approval

**Data Returned:**
- Employee details
- Leave type and duration
- Submission date
- Current approval level
- Days pending
- Reason for leave

**Use Cases:**
- Approval management
- SLA tracking
- Bottleneck identification
- Performance metrics

**Filters Available:**
- Approval level (supervisor/hr/chief)
- Department
- Days pending threshold

### 6. Monthly Leave Trends Report
**Endpoint:** `GET /api/reports/monthly-trends`

**Purpose:** Analyze leave patterns and trends over time

**Data Returned:**
- Month-wise statistics
- Total applications by month
- Approved/rejected/pending counts
- Days used by leave type
- Trend visualization

**Features:**
- Line charts showing trends
- Month-over-month comparison
- Leave type distribution
- Predictive insights

**Use Cases:**
- Capacity planning
- Seasonal trend analysis
- Workload forecasting
- Policy evaluation

## Approval Workflow

The system implements a three-level approval process:

### Level 1: Supervisor Approval
- Immediate reporting officer reviews
- Can approve or reject
- Add comments or feedback

### Level 2: HR Approval
- HR department reviews compliance
- Policy verification
- Balance checking

### Level 3: Chief Officer/Admin Approval
- Final authorization
- High-level review
- Override capability

### Status Flow
```
Submitted (Employee)
    ↓
Pending Supervisor Approval
    ↓ (Approved)
Pending HR Approval
    ↓ (Approved)
Pending Chief Officer Approval
    ↓ (Approved)
APPROVED ✓
    
    OR at any level → REJECTED ✗
```

## Report Queries & Calculations

### Days Calculation
```javascript
numberOfDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1
```

### Leave Balance Update
```
remaining_days = total_days - used_days
```

### Monthly Aggregation
```sql
GROUP BY MONTH(leave_date), leave_type
SUM(number_of_days) for total
COUNT(*) for application count
```

## Access Control

### Role-Based Report Access

| Report | Employee | Supervisor | HR | Admin |
|--------|----------|------------|-----|-------|
| Employee History | Own only | Own team | All | All |
| Department Report | - | Own dept | All | All |
| Leave Balance | Own only | Own dept | All | All |
| Pending Approvals | - | Own level | All | All |
| Monthly Trends | - | - | Yes | Yes |
| Summary Dashboard | - | - | Yes | Yes |

## Report Export Features (Future)

The system is designed to support:
- PDF export of all reports
- Excel export with formatting
- CSV for data analysis
- Email scheduling
- Automatic report generation

## Performance Considerations

### Database Indexing
Key fields are indexed for performance:
- `users.employee_id`
- `leave_applications.user_id`
- `leave_applications.status`
- `leave_balance.year`
- `approval_workflow.approval_level`

### Query Optimization
- Use of parameterized queries to prevent SQL injection
- Efficient JOIN operations
- Filtered queries with date ranges
- Aggregation at database level

### Caching (Future Implementation)
- Cache monthly trends (regenerate monthly)
- Cache department summaries (regenerate daily)
- Cache leave types and balances

## Error Handling

The system includes comprehensive error handling:
- Invalid date ranges
- Insufficient leave balance
- Concurrent approvals
- Database constraints
- Authentication failures

## Notifications Integration

The system supports notifications for:
- Leave application submitted
- Approval granted/rejected
- Pending approval reminders
- Leave balance reminders
- Department alerts

**Supported Channels:**
- System notifications
- Email (configured via SMTP)
- SMS (configured via Twilio)

## Data Privacy & Security

- Password hashing using bcryptjs (10 salt rounds)
- JWT token authentication (24-hour expiry)
- Role-based access control
- Data encryption for sensitive fields
- Audit logging of all changes
- CORS protection

## Future Enhancements

1. **Advanced Analytics**
   - Predictive leave patterns
   - Employee turnover insights
   - Workload distribution analysis

2. **Integrations**
   - Calendar integration (Google, Outlook)
   - Payroll system integration
   - Public holiday API

3. **Mobile App**
   - Native iOS/Android apps
   - Push notifications
   - Offline support

4. **Machine Learning**
   - Leave pattern prediction
   - Anomaly detection
   - Recommendation engine

5. **Business Intelligence**
   - Advanced dashboards
   - Custom report builder
   - Real-time data sync

## Support

For issues or questions:
- Check the QUICKSTART.md for setup help
- Review README.md for features overview
- Check API documentation below
