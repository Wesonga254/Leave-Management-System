# Leave Management System

A comprehensive leave management system for employees with authentication, leave applications, approval workflows, and detailed reporting capabilities.

## Features

### Employee Features
- User registration and login with username and Employee ID
- Submit leave applications with automatic day calculation
- View leave balance and history
- Track leave types (Annual, Sick, Maternity, etc.)
- Calendar integration showing leave duration
- System notifications for approval status

### Management/HR Features
- Multi-level approval workflow (Supervisor → HR → Chief Officer)
- Leave approval/rejection with comments
- Employee leave history reports
- Department leave reports
- Leave balance reports
- Pending approval reports
- Monthly leave trends analysis

### Reports Available
1. **Employee Leave History** - Complete leave records by employee
2. **Department Leave Report** - Aggregated department-wise leave data
3. **Leave Balance Report** - Current balance status for all employees
4. **Pending Approval Report** - Leaves awaiting approval by level
5. **Monthly Leave Trends** - Trends and patterns over time
6. **Summary Dashboard** - Overview statistics and KPIs

## Tech Stack

### Backend
- Node.js with Express.js
- SQLite database
- JWT authentication
- bcryptjs for password hashing

### Frontend
- React 18
- Chart.js for data visualization
- Axios for API calls
- React Router for navigation

## Project Structure

```
Leave.Form/
├── backend/
│   ├── src/
│   │   ├── controllers/
│   │   │   ├── authController.js
│   │   │   ├── leaveController.js
│   │   │   └── reportController.js
│   │   ├── middleware/
│   │   │   └── auth.js
│   │   ├── routes/
│   │   │   ├── authRoutes.js
│   │   │   ├── leaveRoutes.js
│   │   │   └── reportRoutes.js
│   │   ├── database.js
│   │   └── server.js
│   ├── package.json
│   └── .env.example
│
└── frontend/
    ├── src/
    │   ├── components/
    │   │   └── LeaveApplicationForm.js
    │   ├── pages/
    │   │   ├── LoginPage.js
    │   │   ├── RegisterPage.js
    │   │   ├── DashboardPage.js
    │   │   ├── LeaveHistoryPage.js
    │   │   ├── ReportsPage.js
    │   │   ├── ApprovalWorkflowPage.js
    │   │   └── Auth.css
    │   ├── services/
    │   │   └── api.js
    │   ├── App.js
    │   ├── index.js
    │   └── index.css
    ├── public/
    │   └── index.html
    └── package.json
```

## Installation

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file:
   ```bash
   cp .env.example .env
   ```

4. Configure the `.env` file with your settings

5. Start the backend server:
   ```bash
   npm run dev
   ```

The backend will be available at `http://localhost:5000`

### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm start
   ```

The frontend will be available at `http://localhost:3000`

## Default Leave Types

The system includes these leave types:
- Annual Leave (30 days)
- Sick Leave (10 days)
- Maternity Leave (90 days)
- Casual Leave (5 days)
- Bereavement Leave (3 days)

You can add more leave types through the admin interface.

## User Roles

1. **Employee** - Can submit leave applications and view own history
2. **Supervisor** - First level of approval
3. **HR** - Second level of approval and can generate reports
4. **Chief Officer/Admin** - Final approval and system administration

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user

### Leave Management
- `POST /api/leave/applications` - Submit leave application
- `GET /api/leave/applications` - Get leave applications
- `PUT /api/leave/applications/:id` - Update application status
- `GET /api/leave/types` - Get leave types
- `GET /api/leave/balance` - Get leave balance

### Reports
- `GET /api/reports/employee-history/:user_id` - Employee leave history
- `GET /api/reports/department` - Department leave report
- `GET /api/reports/balance` - Leave balance report
- `GET /api/reports/pending-approvals` - Pending approvals report
- `GET /api/reports/monthly-trends` - Monthly trends report
- `GET /api/reports/summary` - Summary dashboard

## Future Enhancements

- Email and SMS notifications
- Calendar integration (Google Calendar, Outlook)
- Mobile app
- Advanced analytics and dashboards
- Leave carry-over management
- Bulk leave approval
- Export reports to PDF/Excel
- Audit logs
- Public holidays integration

## License

MIT
