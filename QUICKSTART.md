# Quick Start Guide - Leave Management System

## Prerequisites
- Node.js (v14 or higher)
- npm or yarn
- Git (optional)

## Quick Setup (5 minutes)

### 1. Backend Setup

```bash
# Navigate to backend folder
cd backend

# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Initialize database and seed default leave types
npm run seed

# Start the server
npm run dev
```

The backend will start on `http://localhost:5000`

### 2. Frontend Setup (in a new terminal)

```bash
# Navigate to frontend folder
cd frontend

# Install dependencies
npm install

# Start the application
npm start
```

The frontend will open at `http://localhost:3000`

## Default Login Credentials

After setup, you can create accounts by registering new users. 

### User Registration
1. Go to the Register page
2. Fill in all required fields:
   - Username
   - Employee ID / PF Number
   - Password
   - Email
   - Phone (optional)
   - First Name
   - Last Name
   - Department (select from dropdown)
   - Designation (select from dropdown)
3. Click "Create Account"
4. Login with your credentials

## Available Departments
- HR
- Finance
- Operations
- IT
- Sales
- Marketing
- Admin

## Available Designations
- Executive
- Senior Executive
- Manager
- Supervisor
- Officer
- Clerk
- Intern

## Default Leave Types

The system comes with these leave types pre-configured:
- Annual Leave (30 days)
- Sick Leave (10 days)
- Maternity Leave (90 days)
- Casual Leave (5 days)
- Bereavement Leave (3 days)
- Parental Leave (15 days)

## User Roles & Permissions

### Employee Role
- Submit leave applications
- View own leave balance
- View own leave history
- View pending requests

### Manager/Supervisor Role
- All employee features
- View pending approvals
- Approve/Reject leave applications
- View department reports

### HR Role
- All manager features
- Generate comprehensive reports
- View all employee leave data
- Manage leave types

### Admin/Chief Officer Role
- All HR features
- System-wide administration
- Final approval authority

## Key Features

### Leave Application Process
1. Login to your account
2. Click "Apply Leave"
3. Select leave type from dropdown
4. Choose start and end dates
5. System automatically calculates days
6. Add optional reason
7. Submit application

### Approval Workflow
- Supervisor Approval (First level)
- HR Approval (Second level)
- Chief Officer Approval (Final level)
- Status changes to Approved/Rejected
- Employee notified of decision

### Reporting Dashboard
Navigate to "Reports" to view:
- **Summary Dashboard** - Overview statistics
- **Leave Balance Report** - Current balance by employee
- **Monthly Trends** - Trends over time with charts
- **Pending Approvals** - Applications awaiting action
- **Employee History** - Individual leave records
- **Department Report** - Departmental statistics

## Database

The system uses SQLite database (`database.sqlite`) with the following tables:
- `users` - Employee accounts
- `leave_types` - Leave type definitions
- `leave_balance` - Leave balance tracking
- `leave_applications` - Leave application records
- `approval_workflow` - Approval process tracking
- `notifications` - System notifications
- `activity_log` - Audit trail

## Environment Variables (.env)

```
PORT=5000
NODE_ENV=development
JWT_SECRET=your_jwt_secret_key_here
DB_PATH=./database.sqlite

# Email (optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_password

# SMS (optional)
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890
```

## Troubleshooting

### Port already in use
If port 5000 or 3000 is already in use:
```bash
# Backend (change PORT in .env)
# Frontend (change port when running: PORT=3001 npm start)
```

### Database errors
```bash
# Reset database (delete database.sqlite)
# Then run seed again:
npm run seed
```

### Module not found errors
```bash
# Clear node_modules and reinstall
rm -rf node_modules
npm install
```

## API Testing

You can test API endpoints using Postman or curl:

```bash
# Register
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"john","employee_id":"EMP001","password":"pass123","email":"john@example.com","first_name":"John","last_name":"Doe","department":"IT","designation":"Manager"}'

# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"john","employee_id":"EMP001","password":"pass123"}'

# Get Leave Types
curl http://localhost:5000/api/leave/types \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Production Deployment

For production deployment:
1. Use a production database (PostgreSQL/MySQL)
2. Set `NODE_ENV=production` in .env
3. Use strong JWT secret
4. Configure HTTPS
5. Set up proper CORS policies
6. Configure email/SMS services
7. Deploy to a server (Heroku, AWS, DigitalOcean, etc.)

## Support & Documentation

For detailed documentation, see README.md in the project root.

## License

MIT License - Feel free to use and modify as needed.
