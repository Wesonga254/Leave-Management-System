# Notifications & Approvals System

## Overview

The Leave Management System includes a comprehensive notification system that keeps employees, managers, and HR informed about leave application status at every stage.

---

## Notification Types

### 1. Application Submitted Notification
**When:** Immediately after employee submits leave application
**Who Receives:** Employee
**Content:**
```
Your leave application has been submitted successfully.
Leave Type: Annual Leave
Duration: June 1-5, 2026 (5 days)
Status: Pending Supervisor Approval
Application ID: #12345
Next Action: Waiting for supervisor review

You can upload supporting documents for faster processing.
```

**Where Sent:**
- ✓ System notification (dashboard)
- ✓ Email (if configured)
- ✓ SMS (if configured)

---

### 2. Supervisor Review Notification
**When:** Application forwarded to supervisor
**Who Receives:** Supervisor/Manager
**Content:**
```
New Leave Application Awaiting Your Review
Employee: John Doe (EMP001)
Leave Type: Annual Leave
Dates: June 1-5, 2026
Reason: Family vacation

Action Required: Review and approve/reject
You can download supporting documents for verification
Link to review: [Click here]
```

**Dashboard Indicator:** "1 pending approval" shown in Approvals tab

---

### 3. Supervisor Decision Notification
**When:** Supervisor approves or rejects application
**Who Receives:** Employee, HR Department
**Content - If Approved:**
```
✓ Your leave application has been approved by your supervisor

Leave Type: Annual Leave
Dates: June 1-5, 2026 (5 days)
Approval Level: Supervisor ✓ → HR Review → Chief Officer
Status: Now awaiting HR approval
```

**Content - If Rejected:**
```
✗ Your leave application has been rejected by your supervisor

Leave Type: Annual Leave
Dates: June 1-5, 2026
Reason: Coverage issues during this period
Comments: "We have critical project timeline. Please try different dates."

You can submit a new application with different dates or discuss with supervisor.
```

---

### 4. HR Review Notification
**When:** Application forwarded to HR
**Who Receives:** HR Officer
**Content:**
```
New Leave Application Awaiting HR Review
Employee: John Doe (EMP001) - IT Department
Leave Type: Annual Leave
Dates: June 1-5, 2026 (5 days)
Supervisor Approval: ✓ Approved

Documents Attached: 3 files
Action Required: Policy compliance check and approval/rejection
Link to review: [Click here]
```

---

### 5. HR Decision Notification
**When:** HR approves or rejects
**Who Receives:** Employee, Supervisor, Chief Officer
**Content - If Approved:**
```
✓ Your leave application has been approved by HR

Leave Type: Annual Leave
Dates: June 1-5, 2026 (5 days)
Approvals: Supervisor ✓ → HR ✓ → Chief Officer
Status: Awaiting final approval from Chief Officer
```

---

### 6. Chief Officer Final Decision
**When:** Chief Officer approves or rejects
**Who Receives:** Employee, All Approvers, HR
**Content - If Approved:**
```
✓✓✓ LEAVE APPROVED - FINAL DECISION

Congratulations! Your leave application has been fully approved.

Leave Type: Annual Leave
Dates: June 1-5, 2026 (5 days)
Your Updated Balance:
  - Total Days: 30
  - Previously Used: 5
  - New Usage: +5
  - Remaining: 20 days

Your leave is confirmed. Have a great time!
```

**Content - If Rejected:**
```
✗ Your leave application has been rejected at final review

Leave Type: Annual Leave
Dates: June 1-5, 2026
All Approval Levels: [Status]
Reason: Business critical period identified

You can submit a new application or contact your supervisor to discuss alternatives.
```

---

### 7. Document Upload Notification
**When:** New document uploaded to application
**Who Receives:** All Approvers
**Content:**
```
New Document Uploaded to Leave Application

Employee: John Doe
Leave Type: Annual Leave
Document: Medical_Certificate.pdf (285 KB)
Uploaded: May 26, 2026 at 2:30 PM

This may assist in faster approval decision.
Download: [Link]
```

---

### 8. Approval Delay Reminder
**When:** Application pending for 3+ days
**Who Receives:** Current approver (supervisor/HR/chief)
**Content:**
```
⏰ Reminder: Pending Leave Application

Employee: John Doe
Leave Type: Annual Leave
Application submitted: May 24, 2026
Current status: Awaiting your review for 3 days

Please review and make a decision at your earliest convenience.
Link: [Click here]
```

---

## Notification Channels

### 1. System Notifications
- **Display:** Dashboard notification bell icon
- **Access:** Click to expand notification center
- **Features:**
  - Mark as read/unread
  - Filter by type
  - Show timestamp
  - One-click links to relevant pages
- **Persistence:** Stored in database, accessible anytime

### 2. Email Notifications (If Configured)
- **Trigger:** Important status changes
- **Content:** Full details + action links
- **Configuration:**
  - SMTP server settings in .env
  - Gmail, Outlook, or custom SMTP
  - HTML-formatted emails
  - Unsubscribe options

### 3. SMS Notifications (If Configured)
- **Trigger:** Critical decisions (approval/rejection)
- **Content:** Brief summary + case number
- **Configuration:**
  - Twilio account required
  - Phone numbers on file
  - 160 character limits

---

## Approval Workflow With Notifications

```
Step 1: Employee Submits Application
├─ Notification → Employee: "Application submitted"
├─ Notification → Supervisor: "New application to review"
└─ Stored in database

Step 2: Supervisor Reviews
├─ Approves → Notification → Employee: "Approved by supervisor"
│           → Notification → HR: "Ready for HR review"
│           → Document upload reminder enabled
│
└─ Rejects  → Notification → Employee: "Rejected with comments"
            → Application ends

Step 3: HR Reviews (if approved)
├─ Approves → Notification → Employee: "Approved by HR"
│           → Notification → Chief Officer: "Ready for final review"
│
└─ Rejects  → Notification → Employee: "Rejected with policy reason"
            → Application ends

Step 4: Chief Officer Final Decision
├─ Approves → Notification → Employee: "Leave approved - balance updated"
│           → Notification → HR: "Add to official calendar"
│           → Balance automatically deducted
│           → Official leave calendar updated
│
└─ Rejects  → Notification → Employee: "Final rejection"
            → Suggestion to resubmit
```

---

## Setting Up Notifications

### System Notifications
- **Automatic:** Enabled by default
- **No configuration:** Works out of the box
- **View:** Dashboard → Notification bell icon

### Email Notifications

**Configuration (.env file):**
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_app_password
SMTP_FROM_NAME=Leave Management System
```

**Gmail Setup:**
1. Enable 2-factor authentication
2. Generate App Password
3. Use app password in .env
4. Test with "Send Test Email"

### SMS Notifications

**Configuration (.env file):**
```
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890
```

**Twilio Setup:**
1. Create Twilio account
2. Get Account SID and Auth Token
3. Create/configure phone number
4. Add employee phone numbers
5. Enable SMS in system settings

---

## Notification Preferences

**Future Enhancement:** Allow employees to customize notification channels:
```
□ System notifications
□ Email notifications
□ SMS for critical updates only
□ Daily digest instead of real-time
□ Disable notifications for specific times
```

---

## Notification Templates

The system can be extended with custom templates:

### Approval Templates
```
[STATUS] - Your Leave Application
Employee: {{employeeName}}
Leave Type: {{leaveType}}
Duration: {{startDate}} to {{endDate}}
Decision: {{decision}}
Comments: {{comments}}
Next Step: {{nextStep}}
```

### Reminder Templates
```
Action Required: Pending Leave Application
From: {{applicantName}}
Applied: {{submissionDate}}
Days Pending: {{daysPending}}
Documents: {{documentCount}} attached
Action Link: {{actionUrl}}
```

---

## Notification History

**Access:**
1. Dashboard → Notifications
2. View all notifications with timestamps
3. Filter by:
   - Type (submitted, approved, rejected)
   - Date range
   - Status (read/unread)
4. Re-read or delete old notifications

---

## Best Practices

### For Employees
1. **Check notifications regularly** - Don't miss approval updates
2. **Enable email notifications** - Prevents missing notifications
3. **Provide clear reasons** - Leads to faster approvals
4. **Upload documents promptly** - Speeds up review process

### For Managers
1. **Check approvals daily** - Meet 2-3 day SLA
2. **Provide constructive feedback** - If rejecting
3. **Review uploaded documents** - Verify authenticity
4. **Communicate decisions** - Clear comments help

### For HR
1. **Monitor pending approvals** - Ensure timely processing
2. **Generate reports** - Track approval metrics
3. **Send reminders** - For overdue approvals
4. **Maintain audit trail** - All decisions logged

---

## Troubleshooting Notifications

### Missing Notifications
- **Check:** System notification bell in dashboard
- **Check:** Email spam/junk folder
- **Action:** Enable notifications in preferences
- **Contact:** System administrator if issues persist

### Email Not Sending
- **Check:** SMTP configuration in .env
- **Check:** Firewall/network port 587 open
- **Test:** Send test email from admin panel
- **Contact:** System administrator

### SMS Not Arriving
- **Check:** Phone number format (+country_code)
- **Check:** Twilio account balance
- **Check:** Phone can receive international SMS
- **Contact:** Twilio support for delivery status

---

## Notification Metrics & Reporting

### Monitor
- Average approval time per level
- Notification delivery rate
- Employee check-in rate
- Most common rejection reasons

### Reports Available
- Approval SLA compliance
- Notification delivery log
- Employee engagement with system
- Department approval patterns

---

## Future Enhancements

1. **Push Notifications** - Mobile app support
2. **Slack Integration** - Send notifications to Slack
3. **Calendar Integration** - Auto-add approved leaves
4. **Smart Reminders** - Intelligent retry timing
5. **Notification Analytics** - Engagement metrics
6. **Custom Workflows** - Rule-based notifications
7. **Batch Notifications** - Daily digest option
8. **Multi-language** - Localized notifications

---

**For notification-related issues or configuration help, contact your system administrator.**
