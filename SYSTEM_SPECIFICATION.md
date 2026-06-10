# Online Leave Application System (OLAS) — System Specification

Version: 1.0
Date: 30 May 2026
Author: System Development Team

## 1. Introduction

### 1.1 Purpose
This document provides a technical and functional specification for the Online Leave Application System (OLAS). It is intended for system administrators, developers, HR personnel, and management stakeholders who will deploy, operate, and maintain the system.

### 1.2 Scope
OLAS automates employee leave management including:
- Submission of leave requests by employees
- Multi-level approval workflows with delegation and escalation
- Real-time leave balance tracking and accrual
- Automated notifications (email, SMS, in-app)
- Reporting and analytics with export capabilities
- Calendar integration and visibility across teams

### 1.3 Conventions
- **Bold** denotes modules or major components
- *Italic* denotes fields or UI elements

### 1.4 Intended Audience
- HR Administrators — manage policies, approvals, reports
- Employees — submit and track requests
- Supervisors / Managers — review and approve team requests
- Directors — final approver for selected categories
- System Administrators — deployment and maintenance

## 2. System Overview

### 2.1 Description
OLAS is a web-based platform with a React frontend and Node/Express backend with a relational database. It provides configurable leave types, multi-level approval, leave balances, notifications and reporting.

### 2.2 Key Features
- Digital leave submission and attachments
- Configurable leave types and entitlements
- Multi-level approval workflow (Supervisor → HR → Director)
- Real-time balance calculation and accrual
- Notification engine: Email (SMTP), SMS (Twilio), In-app
- Reports: Employee history, Department report, Pending approvals, Trends
- Leave calendar visualization

### 2.3 Architecture
- Presentation Layer: React SPA (frontend)
- Application Layer: Express REST API (backend)
- Data Layer: SQLite (local) or RDBMS in production

### 2.4 Technology Stack
- Frontend: React, Axios
- Backend: Node.js, Express
- Database: SQLite (development), RDBMS for production
- Notifications: Nodemailer (SMTP), Twilio (SMS)
- Authentication: JWT, Role-Based Access Control (RBAC)

## 3. User Roles & Access Control

OLAS supports the following roles:
- Employee — submit/view own requests
- Supervisor — approve/reject team requests
- HR Officer — validate entitlements, approve
- Director — final approval authority
- System Administrator — full configuration and audit access

Access is enforced via middleware that verifies JWT tokens and role membership.

## 4. Functional Requirements (Summary)

### 4.1 Leave Application Form
Required fields: *Employee Name*, *Staff ID*, *Department*, *Designation*, *Supervisor*, *Contact Number*, *Email*, *Leave Type*, *Start Date*, *End Date*, *Number of Days*, *Attachments* as per policy.

Number of days is calculated excluding weekends and registered public holidays. Certain leave types require supporting attachments (e.g., sick leave for 3+ consecutive days, compassionate leave).

### 4.2 Leave Types (configurable)
- Annual Leave — default entitlement (e.g., 24 days)
- Sick Leave — medical certificate for 3+ days
- Maternity / Paternity — statutory provisions
- Compassionate Leave — supporting documentation required
- Study Leave, Unpaid Leave — management discretion

## 5. Approval Workflow

OLAS implements a structured approval workflow. Each stage is recorded in an approval_workflow table. Typical flow:
1. Employee submits request — status: Pending
2. Supervisor reviews — Approve/Reject
3. HR validates entitlements — Approve/Reject
4. Director (if required) — Final decision

Rules:
- Approvers may add comments
- Delegation supported via user configuration
- Escalation: requests unactioned past configurable timeout are escalated to the next authority

## 6. Leave Balance Management

- Leave balances stored per user, per leave type, per year
- Balances update automatically upon final approval
- Weekends and public holidays excluded from day calculations
- Negative balances flagged and require managerial override
- Carry-over rules configurable per policy

## 7. Notifications

Channels: Email (SMTP), SMS (Twilio), In-app (notifications table)

Triggers:
- Submission: notify supervisor and HR
- Approval/Rejection at each stage: notify applicant and next approver
- Final decision: notify all parties and update balances

Notification templates include employee name, leave type, dates, status and direct link to the application.

## 8. Reporting Module

Standard reports:
- Employee Leave History
- Department Leave Report
- Leave Balance Report
- Pending Approvals Report
- Monthly Leave Trends

Export formats: PDF, XLSX, CSV (backend endpoints return CSV/JSON; PDF/XLSX produced server-side or via export tools)

## 9. Approval Dashboard

Dashboard components:
- Pending Requests panel
- Approved Requests log
- Rejected Requests log
- Department Leave Statistics
- Leave Calendar (visual)

Frontend: consolidated approval view with filters by date, department, leave type, and approver.

## 10. Non-Functional Requirements

- Security: HTTPS/TLS, JWT, RBAC, audit logs, session timeout
- Performance: balance calculations < 2s, dashboard refresh < 5s, 12-month report < 30s
- Availability: target 99.5% uptime during business hours
- Usability: responsive UI, accessible across modern browsers

## 11. Integrations

- HR/Payroll: sync employee master and unpaid leave deductions
- Email/SMS gateways: configurable SMTP and Twilio
- Calendar: export or publish approved leaves to organisational calendars

## 12. Glossary
- OLAS — Online Leave Application System
- RBAC — Role-Based Access Control
- MFA — Multi-Factor Authentication
- SMTP — Simple Mail Transfer Protocol

## 13. Document Control
Version 1.0 — Initial release — 30 May 2026

---

Contact the System Administrator or HR for questions about this specification.
