# API Documentation

## Base URL
```
http://localhost:5000/api
```

## Authentication
All endpoints (except login/register) require a JWT token in the Authorization header:
```
Authorization: Bearer <your_token>
```

---

## Authentication Endpoints

### 1. Register User
**POST** `/auth/register`

**Request Body:**
```json
{
  "username": "john_doe",
  "employee_id": "EMP001",
  "password": "securepass123",
  "email": "john@example.com",
  "phone": "+1234567890",
  "first_name": "John",
  "last_name": "Doe",
  "department": "IT",
  "designation": "Manager"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "User registered successfully",
  "user_id": 1
}
```

### 2. Login
**POST** `/auth/login`

**Request Body:**
```json
{
  "username": "john_doe",
  "employee_id": "EMP001",
  "password": "securepass123"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "john_doe",
    "email": "john@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "employee_id": "EMP001",
    "department": "IT",
    "designation": "Manager",
    "role": "employee"
  }
}
```

### 3. Get Current User
**GET** `/auth/me`

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "user": {
    "id": 1,
    "username": "john_doe",
    "email": "john@example.com",
    "phone": "+1234567890",
    "first_name": "John",
    "last_name": "Doe",
    "employee_id": "EMP001",
    "department": "IT",
    "designation": "Manager",
    "role": "employee"
  }
}
```

---

## Leave Management Endpoints

### 1. Get Leave Types
**GET** `/leave/types`

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Annual Leave",
      "annual_limit": 30,
      "description": "Regular paid leave"
    },
    {
      "id": 2,
      "name": "Sick Leave",
      "annual_limit": 10,
      "description": "Leave for medical purposes"
    }
  ]
}
```

### 2. Get Leave Balance
**GET** `/leave/balance`

**Response (200 OK):**
```json
{
  "success": true,
  "year": 2026,
  "data": [
    {
      "id": 1,
      "user_id": 1,
      "leave_type_id": 1,
      "year": 2026,
      "total_days": 30,
      "used_days": 5,
      "remaining_days": 25,
      "leave_type_name": "Annual Leave"
    }
  ]
}
```

### 3. Submit Leave Application
**POST** `/leave/applications`

**Request Body:**
```json
{
  "leave_type_id": 1,
  "start_date": "2026-06-01",
  "end_date": "2026-06-05",
  "reason": "Family vacation"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Leave application submitted successfully",
  "application_id": 42
}
```

### 4. Get Leave Applications
**GET** `/leave/applications`

**Query Parameters:**
- `status` (optional): pending, approved, rejected
- `user_id` (optional): filter by user

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": 42,
      "user_id": 1,
      "first_name": "John",
      "last_name": "Doe",
      "employee_id": "EMP001",
      "leave_type": "Annual Leave",
      "start_date": "2026-06-01",
      "end_date": "2026-06-05",
      "number_of_days": 5,
      "reason": "Family vacation",
      "status": "pending",
      "created_at": "2026-05-26T10:30:00Z"
    }
  ]
}
```

### 5. Update Application Status
**PUT** `/leave/applications/:id`

**Request Body:**
```json
{
  "approval_level": "supervisor",
  "status": "approved",
  "comments": "Approved by supervisor"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Leave application approved successfully",
  "application_status": "approved"
}
```

---

## Report Endpoints

### 1. Get Summary Dashboard
**GET** `/reports/summary`

**Response (200 OK):**
```json
{
  "success": true,
  "overall": {
    "total_employees_on_leave": 15,
    "total_approved_leaves": 120,
    "total_pending_leaves": 8,
    "total_rejected_leaves": 2,
    "total_days_used": 450
  },
  "by_department": [
    {
      "department": "IT",
      "total_employees": 25,
      "approved_leaves": 35,
      "days_used": 120
    },
    {
      "department": "HR",
      "total_employees": 10,
      "approved_leaves": 15,
      "days_used": 40
    }
  ]
}
```

### 2. Get Employee Leave History
**GET** `/reports/employee-history/:user_id`

**Query Parameters:**
- `startDate` (optional): Filter from date
- `endDate` (optional): Filter to date

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": 42,
      "start_date": "2026-06-01",
      "end_date": "2026-06-05",
      "number_of_days": 5,
      "reason": "Family vacation",
      "status": "approved",
      "leave_type": "Annual Leave",
      "first_name": "John",
      "last_name": "Doe",
      "employee_id": "EMP001",
      "created_at": "2026-05-26T10:30:00Z"
    }
  ],
  "count": 1
}
```

### 3. Get Department Leave Report
**GET** `/reports/department`

**Query Parameters:**
- `department` (optional): Department name
- `year` (optional): Year (default: current year)

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "department": "IT",
      "total_employees": 25,
      "approved_leaves": 35,
      "total_days_approved": 120,
      "pending_leaves": 3,
      "rejected_leaves": 1,
      "leave_type": "Annual Leave"
    }
  ],
  "year": 2026
}
```

### 4. Get Leave Balance Report
**GET** `/reports/balance`

**Query Parameters:**
- `department` (optional): Filter by department
- `year` (optional): Year (default: current year)

**Response (200 OK):**
```json
{
  "success": true,
  "year": 2026,
  "data": [
    {
      "id": 1,
      "employee_id": "EMP001",
      "first_name": "John",
      "last_name": "Doe",
      "department": "IT",
      "designation": "Manager",
      "leave_type": "Annual Leave",
      "total_days": 30,
      "used_days": 5,
      "remaining_days": 25
    }
  ]
}
```

### 5. Get Pending Approvals Report
**GET** `/reports/pending-approvals`

**Query Parameters:**
- `department` (optional): Filter by department
- `approvalLevel` (optional): supervisor, hr, chief_officer

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": 42,
      "start_date": "2026-06-01",
      "end_date": "2026-06-05",
      "number_of_days": 5,
      "reason": "Family vacation",
      "status": "pending",
      "leave_type": "Annual Leave",
      "employee_id": "EMP001",
      "first_name": "John",
      "last_name": "Doe",
      "department": "IT",
      "approval_level": "supervisor",
      "approval_status": "pending",
      "submitted_date": "2026-05-26T10:30:00Z"
    }
  ],
  "count": 1
}
```

### 6. Get Monthly Leave Trends
**GET** `/reports/monthly-trends`

**Query Parameters:**
- `year` (optional): Year (default: current year)
- `department` (optional): Filter by department

**Response (200 OK):**
```json
{
  "success": true,
  "year": 2026,
  "data": [
    {
      "month": "06",
      "month_name": "June",
      "leave_type": "Annual Leave",
      "total_applications": 8,
      "approved": 6,
      "pending": 2,
      "rejected": 0,
      "total_days": 25
    },
    {
      "month": "07",
      "month_name": "July",
      "leave_type": "Annual Leave",
      "total_applications": 5,
      "approved": 4,
      "pending": 0,
      "rejected": 1,
      "total_days": 15
    }
  ]
}
```

### 7. Get Approval Workflow
**GET** `/approval/applications/:applicationId`

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "leave_application_id": 42,
      "approver_id": 2,
      "approval_level": "supervisor",
      "status": "approved",
      "comments": "Approved",
      "approved_at": "2026-05-27T14:30:00Z",
      "first_name": "Jane",
      "last_name": "Manager",
      "email": "jane@example.com"
    },
    {
      "id": 2,
      "leave_application_id": 42,
      "approver_id": 3,
      "approval_level": "hr",
      "status": "pending",
      "comments": null,
      "approved_at": null,
      "first_name": "HR",
      "last_name": "Officer",
      "email": "hr@example.com"
    }
  ]
}
```

### 8. Update Approval Status
**PUT** `/approval/applications/:applicationId/approve`

**Request Body:**
```json
{
  "approval_level": "supervisor",
  "status": "approved",
  "comments": "Looks good"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Application approved successfully",
  "application_status": "approved"
}
```

---

## Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "message": "Missing required fields"
}
```

### 401 Unauthorized
```json
{
  "success": false,
  "message": "Invalid or expired token"
}
```

### 403 Forbidden
```json
{
  "success": false,
  "message": "Insufficient permissions"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "message": "Error message",
  "error": "Detailed error information"
}
```

---

## Rate Limiting & Best Practices

1. **Token Expiry**: Tokens expire after 24 hours
2. **Pagination**: Future versions will include pagination for large datasets
3. **Caching**: Consider implementing client-side caching for reports
4. **Batch Operations**: Use batch endpoints for multiple operations
5. **Error Handling**: Always check `success` field in response

---

## Example Workflows

### Complete Leave Application Flow
```
1. GET /leave/types           → Get available leave types
2. GET /leave/balance         → Check available balance
3. POST /leave/applications   → Submit application
4. GET /leave/applications    → View application status
5. GET /approval/applications/42 → Track approval status
```

### Manager Approval Flow
```
1. GET /reports/pending-approvals   → View pending leaves
2. GET /approval/applications/42    → View approval chain
3. PUT /approval/applications/42    → Approve/Reject
```

### Report Generation Flow
```
1. GET /reports/summary              → Overview
2. GET /reports/balance              → Leave balances
3. GET /reports/monthly-trends       → Trend analysis
4. GET /reports/department           → Department stats
```

## New Workflow Endpoints

### Delegate Approval
**POST** `/workflow/delegate`

**Request Body:**
```json
{
  "applicationId": 42,
  "delegatedTo": 5
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Delegation applied"
}
```

### Run Escalation
**POST** `/workflow/escalate/run`

Triggers escalation checks for pending approvals older than the configured timeout (`ESCALATION_DAYS` environment variable). Intended for scheduled invocation via cron or task scheduler.

**Response (200 OK):**
```json
{
  "success": true,
  "escalated": 3
}
```

### Get Potential Delegates
**GET** `/approval/delegates`

Returns potential delegates (users in the same department) for approvers to choose from.

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    { "id": 5, "first_name": "Alice", "last_name": "Smith", "role": "supervisor", "email": "alice@example.com" }
  ]
}
```

### Admin: Manage Settings
**GET** `/admin/settings` — List all system settings

**PUT** `/admin/settings/:key` — Update a setting

Request example:
```json
{ "value": "5" }
```

Settings include:
- `ESCALATION_DAYS` — number of days before a pending approval is escalated
- `SICK_ATTACHMENT_THRESHOLD` — minimum consecutive sick days requiring attachment
- `COMPASSIONATE_ATTACHMENT_REQUIRED` — set to `1` to require attachments for compassionate leave

