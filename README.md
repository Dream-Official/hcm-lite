# HCM Lite – Human Capital Management System

> **Saylani Hackathon Project**  
> A clean, responsive, local-first Human Capital Management (HCM) web application built with pure vanilla HTML5, CSS3, and modern JavaScript. Designed with the **Executive Slate HCM** design system.

---

## 📋 Table of Contents
1. [Overview & Architecture](#overview--architecture)
2. [Key Modules & Features](#key-modules--features)
3. [Design System & Aesthetics](#design-system--aesthetics)
4. [LocalStorage Data Model](#localstorage-data-model)
5. [Role Enforcement & Security Architecture](#role-enforcement--security-architecture)
6. [How to Run Locally](#how-to-run-locally)
7. [Step-by-Step Testing Guide](#step-by-step-testing-guide)
8. [Deployment Instructions](#deployment-instructions)
9. [Important Disclosures & Limitations](#important-disclosures--limitations)

---

## 🌟 Overview & Architecture

**HCM Lite** provides core enterprise HR capabilities without requiring heavy frameworks, build steps, Node packages, or backend databases:
- **Zero External Runtime Dependencies:** Pure vanilla JavaScript, vanilla CSS with high-performance native system font hierarchy, and standard HTML5. 100% offline and air-gap compatible—no CDNs, external web fonts, or remote trackers.
- **Offline / Local-First:** All records are stored and persisted inside the browser's standard Web Storage (`localStorage` and `sessionStorage`).
- **Device-Local Date Engine:** All attendance logs, date pickers, and live stamps utilize the client's local calendar date rather than raw UTC timestamps, preventing cross-midnight shift desynchronization.
- **No Seeded / Fabricated Data:** Fresh installations start completely uninitialized with zero records. The administrator creates their own company profile and admin user upon first launch.
- **Role-Aware Navigation & Privacy:** Hard separation between Administrator management modules and Employee Self-Service portal.

---

## 🚀 Key Modules & Features

### 1. First-Run Setup & Authentication
- **Initial Setup Wizard:** On first visit, automatically detects uninitialized storage and prompts the user to define their Company Name, Admin Full Name, Email, and Master Password.
- **Role-Based Login:** Dual sign-in tabs for **Administrator** and **Employee**.
- **Password Strength Meter:** Real-time feedback enforcing minimum length, numbers, and uppercase characters.
- **Session Management:** Secure active session tracked via `sessionStorage` with safe logout.
- **Deactivated Account Guard:** Inactive employees are strictly prevented from authenticating or restoring active sessions.

### 2. Administrator Workspace
- **Executive Dashboard:** Live metrics for active headcount, today's attendance turnout percentage (calculated strictly against active staff), pending leave requests, and total payroll disbursed (reflecting settled/paid vouchers). Department distribution progress bar chart.
- **Employee Directory:**
  - Create, view, edit, and deactivate employee records.
  - Generates auto-incrementing employee identifiers (e.g. `EMP-001`).
  - Account linking modal to generate employee portal sign-in credentials (blocked for inactive employees).
  - Live search by name/email and filtering by department and employment status.
- **Attendance Oversight:**
  - Date picker to view or audit attendance logs for any given day.
  - Department filter and status breakdowns (Present, Late, Half-Day, Absent).
  - Manual override and correction modal with custom notes.
  - CSV export capability for attendance records.
- **Leave Management:**
  - Review incoming employee leave applications with working days computed automatically (excluding weekends).
  - One-click Approve / Reject with reviewer stamping and persistent status tracking.
- **Monthly Payslip Engine:**
  - Automated batch payroll generation for all active employees for any given month (`YYYY-MM`).
  - Individual pay voucher creation with customizable basic salary, allowances, and deductions.
  - Executive printable salary voucher with amount in digits and words, company header, and formal signature lines.
- **Internal Notice Board:**
  - Broadcast company bulletins, urgent alerts, and policy changes.
  - Targeted distribution (Company-wide vs. specific Department).
  - Pinning to top and removal controls.
- **Company Settings:**
  - Enterprise profile (Name, phone, address, default currency: PKR, USD, EUR, GBP, AED, SAR).
  - Shift configuration (Work start, work end, grace period in minutes).
  - Annual, Sick, and Casual leave quotas.
  - **Schema-Validated JSON Backup & Restore:** Complete export with structural integrity validation preventing corrupted restores or key injection.
  - Hard reset / factory clear option.

### 3. Employee Self-Service Portal
- **Personal Dashboard:** Greeting banner, live digital clock, today's check-in/out terminal, leave balance summary, latest issued payslip, and company notices.
- **Today's Check-In Terminal:**
  - One-click Check In / Check Out.
  - Punctuality detection against company grace minutes (marks Late if checked in after start time + grace).
  - **Duplicate Check-In Protection:** Prevents multiple check-ins on the same calendar day.
- **Attendance Log:** Personal historical record of arrivals, departures, logged duration, and notes.
- **Leave Requests:**
  - Interactive leave application form with real-time working days calculation (excluding Saturdays and Sundays).
  - Real-time leave balance tracking (Annual, Sick, Casual remaining).
  - Live status tracking (Pending, Approved, Rejected).
- **Personal Payslips & Confidentiality:** Access, inspect, and print official company payslips. Draft vouchers remain strictly invisible to employees until formally issued.
- **Profile & Security:** View personal employment profile details and change sign-in password with real-time validation without locking out accounts.

### 4. Smart Helper (Local Rule-Based Assistant)
- Embedded interactive HR assistant that answers queries locally without external AI APIs or cloud networks.
- **Session Isolation & Privacy:** Helper conversations are strictly scoped per authenticated session and cleared on logout, preventing cross-user conversation leakage.
- **Role-Aware Data Protection:** Provides employees with their own personal records while reserving executive totals and deactivated employee metrics exclusively for administrators.

---

## 🎨 Design System & Aesthetics

Implemented in accordance with the **Executive Slate HCM** design tokens:
- **Primary Color:** Deep Corporate Slate Navy (`#0F172A`)
- **Accent Color:** Sky Blue (`#0284C7` / `#0EA5E9`)
- **Backgrounds:** Clean neutral light background (`#F8FAFC`), crisp white surface cards (`#FFFFFF`)
- **Typography:** Modern clean system sans-serif hierarchy (`-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`) with tabular numeric alignment for currencies and dates. Zero web font dependencies.
- **Inline SVG Icons:** Self-contained, lightweight vector graphics without CDN font dependencies.
- **Responsive Layout:** Adaptive sidebar navigation with hamburger drawer on mobile devices (`<= 768px`).

---

## 💾 LocalStorage Data Model

All application state is persisted across 9 structured keys prefixed with `hcm_`:

| Storage Key | Type | Description |
|---|---|---|
| `hcm_initialized` | `boolean` | Set to `true` once company & admin setup is completed. |
| `hcm_company` | `Object` | Company name, contact information, creation date. |
| `hcm_users` | `Array<User>` | Authenticated accounts (`id`, `role`, `name`, `email`, `passwordHash`, `employeeId`). |
| `hcm_employees` | `Array<Employee>` | Employee profiles (`id`, `employeeId`, `name`, `email`, `department`, `designation`, `salary`, `status`). |
| `hcm_attendance` | `Array<Record>` | Daily attendance records (`id`, `employeeId`, `date`, `checkIn`, `checkOut`, `status`, `notes`). |
| `hcm_leaves` | `Array<Leave>` | Time-off applications (`id`, `employeeId`, `leaveType`, `startDate`, `endDate`, `days`, `status`, `reviewedBy`). |
| `hcm_payslips` | `Array<Payslip>` | Issued pay vouchers (`id`, `slipNumber`, `employeeId`, `month`, `basicSalary`, `allowances`, `deductions`, `netSalary`, `status`). |
| `hcm_announcements`| `Array<Announcement>` | Internal announcements (`id`, `title`, `body`, `category`, `targetDept`, `pinned`, `author`, `createdAt`). |
| `hcm_settings` | `Object` | Work shift hours, grace period, leave quotas, currency code. |

---

## 🔒 Role Enforcement & Security Architecture

1. **Strict Client-Side Routing Guards:** Navigation checks the authenticated user's role before mounting screens. An employee navigating to an admin module is immediately redirected to their employee dashboard.
2. **Deactivated Employee Lockdown:** All access points—including initial login, session rehydration, route changes, attendance terminals, leave submissions, and helper queries—actively verify that employee records are `active`. Deactivated accounts are terminated immediately.
3. **Admin-Only Mutation Guards:** All administrative actions (attendance adjustments, leave approvals/rejections, payslip issuance/deletion, bulletin broadcasting, profile/policy editing, database backup/restore, and factory reset) enforce explicit administrator authorization guards.
4. **Draft Payslip Confidentiality:** Payslips in draft state are strictly hidden from employee dashboards, payslip indexes, and viewing modals until marked paid by an administrator.
5. **Session Integrity & Privacy:** Active login is verified on page load and reload. Smart Helper conversation history is isolated per account and cleared on logout.
6. **Robust Backup Schema Validation:** JSON database restoration verifies table types, schemas, and whitelisted keys, rejecting malformed, truncated, or malicious payloads.

---

## 💻 How to Run Locally

Because this application uses standard static web technologies, no build commands, npm installations, or compilation steps are required:

### Option A: Direct Browser File
Double-click `index.html` in your file manager or drag it into any modern web browser (Google Chrome, Microsoft Edge, Firefox, Safari).

### Option B: Local Static Server (Recommended)
You can serve the directory using any static web server:

```bash
# Using Node.js npx serve
npx serve .

# Using Python 3
python -m http.server 8080

# Using PHP built-in server
php -S localhost:8080
```
Open your browser at `http://localhost:8080`.

---

## 🧪 Step-by-Step Testing Guide

Follow this guide to verify the core workflows:

1. **First-Run Setup:**
   - Open `index.html`. You will see the **Create Company Workspace** screen.
   - Enter your company name (e.g. `Acme Corp`), your name, work email (`admin@acme.com`), and password (`AdminPass123!`).
   - Click **Create Workspace & Account**.
2. **Admin Dashboard:**
   - Sign in using your new administrator credentials.
   - Verify all stat cards display `0` (clean initial state).
3. **Add Employee & Create Portal Account:**
   - Go to **Employees** -> click **Add Employee**.
   - Enter `Sarah Connor`, email `sarah@acme.com`, Department `Engineering`, Role `Software Architect`, Salary `150000`.
   - Click **Account** next to Sarah's name in the table and assign a password (`SarahPass123!`).
4. **Publish Announcement & Issue Payroll:**
   - Go to **Announcements** -> click **New Announcement** -> create a pinned post.
   - Go to **Monthly Payslips** -> click **Auto-Generate All** -> click **View** to inspect the printable salary voucher.
5. **Employee Self-Service Flow:**
   - Click **Sign Out** from the bottom of the sidebar.
   - Select the **Employee** tab on the login screen.
   - Sign in with `sarah@acme.com` / `SarahPass123!`.
   - Verify Sarah sees only her own portal.
   - Click **Check In** in the attendance terminal. Verify status updates to Present.
   - Click **Apply for Leave** and submit a request for next week.
6. **Admin Approval:**
   - Sign out and sign back in as Administrator.
   - Go to **Leave Management**, see Sarah's pending request, and click **Approve**.

---

## 🚀 Deployment Instructions

### Deploying to GitHub Pages
1. Push the repository to GitHub.
2. In your GitHub repository, navigate to **Settings** > **Pages**.
3. Under **Build and deployment** > **Source**, select `Deploy from a branch`.
4. Choose `main` (or `master`) and folder `/ (root)`, then click **Save**.
5. Your application will be live at `https://<username>.github.io/<repository-name>/`.

### Deploying to Netlify
1. Log into [Netlify](https://www.netlify.com/).
2. Drag and drop the `HCM-LITE/` workspace folder directly into the Netlify drop zone, or connect your Git repository.
3. Leave the build command and publish directory blank (or root `./`).
4. Click **Deploy**.

---

## ⚠️ Important Disclosures & Limitations

> [!IMPORTANT]
> **Client-Side Storage Disclaimer:**  
> This application uses browser `localStorage` as its data persistence layer.
> - **Browser-Specific:** Data saved in one browser (e.g. Google Chrome) will not exist in another browser (e.g. Firefox or Safari) or in Incognito / Private browsing windows.
> - **Origin-Specific:** Data is tied to the protocol, hostname, and port.
> - **User Clearable:** If the user clears site data or browser cache, all stored records will be erased.
> - **No Multi-Device Sync:** Changes made on one computer or mobile phone do not synchronize to separate devices across the internet without an external database.
> - **Security Notice:** `localStorage` is not an encrypted or server-authenticated database. It is intended for hackathon demonstrations, local testing, and educational showcases, not production-grade enterprise payroll compliance.

---

## 📄 License
Created for the **Saylani Hackathon**. Open-source under the MIT License.
