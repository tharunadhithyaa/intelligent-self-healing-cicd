# API Endpoints Documentation — CivicPulse AI

All API routes are hosted under the base prefix `/api`. Most requests require authorization headers: `Authorization: Bearer <Access_JWT_Token>`. Rate limiting is enforced across endpoints (`100 req / 15 min` globally; `20 req / 15 min` for `/auth/login` and `/auth/register`).

---

## 🏥 System Health Endpoint

### `GET /api/health`
* **Description**: Live readiness and database connectivity health probe.
* **Auth**: Public (No token required).
* **Response**: `200 OK` (when database is connected) or `503 Service Unavailable` (when database is down).
  ```json
  {
    "success": true,
    "message": "CivicPulse API is running",
    "timestamp": "2026-08-05T12:00:00.000Z",
    "environment": "production",
    "database": { "status": "up", "readyState": 1 }
  }
  ```

---

## 🔑 Authentication Router (`/api/auth`)

### 1. `POST /api/auth/register`
* **Description**: Register a new user account. Rate limited (20 req / 15 min).
* **Payload**:
  ```json
  { "firstName": "John", "lastName": "Doe", "email": "john@example.com", "password": "SecretPassword123!", "phone": "1234567890", "role": "citizen" }
  ```
* **Response**: `201 Created` with User object and tokens pair (`accessToken`, `refreshToken`).

### 2. `POST /api/auth/login`
* **Description**: Authenticate credentials. Rate limited (20 req / 15 min).
* **Payload**:
  ```json
  { "email": "john@example.com", "password": "SecretPassword123!" }
  ```
* **Response**: `200 OK` with User details and tokens.

### 3. `POST /api/auth/refresh-token`
* **Description**: Rotate JWT access tokens using a valid refresh token.
* **Payload**:
  ```json
  { "refreshToken": "stored_refresh_token_string" }
  ```
* **Response**: `200 OK` with new tokens pair.

### 4. `POST /api/auth/logout`
* **Description**: Invalidate current user refresh token session.
* **Payload**:
  ```json
  { "refreshToken": "stored_refresh_token_string" }
  ```

### 5. `POST /api/auth/forgot-password`
* **Description**: Request password reset instructions via email.
* **Payload**:
  ```json
  { "email": "john@example.com" }
  ```

### 6. `POST /api/auth/reset-password`
* **Description**: Reset password using authorization reset token.
* **Payload**:
  ```json
  { "token": "reset_token_string", "newPassword": "NewSecretPassword123!" }
  ```

### 7. `GET /api/auth/me`
* **Description**: Retrieve current authenticated user profile and permissions.
* **Auth**: Required (`Bearer Token`).

---

## 👤 Citizen Router (`/api/citizen`)

All routes require authentication (`Bearer Token`).

### 1. `PUT /api/citizen/profile`
* **Description**: Update profile details (first name, last name, phone number).
* **Payload**:
  ```json
  { "firstName": "John", "lastName": "Smith", "phone": "9876543210" }
  ```

### 2. `PUT /api/citizen/security`
* **Description**: Change user account password.
* **Payload**:
  ```json
  { "currentPassword": "OldPassword123!", "newPassword": "NewPassword123!" }
  ```

### 3. `GET /api/citizen/settings`
* **Description**: Retrieve citizen notification settings and preferences.

### 4. `PUT /api/citizen/settings`
* **Description**: Update notification thresholds and preferences.
* **Payload**:
  ```json
  { "emailNotifications": true, "smsNotifications": false, "radiusAlerts": 5 }
  ```

### 5. `GET /api/citizen/download-data`
* **Description**: Export personal user data and submitted complaint history as JSON.

---

## 📋 Complaints Router (`/api/complaints`)

All routes require authentication (`Bearer Token`).

### 1. `POST /api/complaints`
* **Description**: Submit a new municipal complaint ticket.
* **Payload**:
  ```json
  {
    "title": "Water Leak on Main Street",
    "description": "Broken main line causing flooding on street",
    "category": "Water Supply",
    "location": { "latitude": 12.9716, "longitude": 77.5946, "address": "123 Main St" },
    "images": ["data:image/png;base64,..."]
  }
  ```

### 2. `GET /api/complaints`
* **Description**: Query complaints. Admins and Officers view all; Citizens view their own submissions. Supports pagination and filtering.

### 3. `POST /api/complaints/analyze`
* **Description**: Run AI analysis on draft complaint to suggest department assignment, priority, and category.
* **Payload**:
  ```json
  { "title": "Large Pothole", "description": "Dangerous road hole near school" }
  ```

### 4. `GET /api/complaints/:id`
* **Description**: Retrieve detailed complaint record including location, assigned department, and status timeline.

---

## 🤖 AI Chatbot Router (`/api/ai-chat`)

All routes require authentication (`Bearer Token`).

### 1. `GET /api/ai-chat/conversations`
* **Description**: Retrieve active user chat history logs.

### 2. `DELETE /api/ai-chat/conversations`
* **Description**: Clear all chat conversation history for the current user.

### 3. `GET /api/ai-chat/conversations/:id`
* **Description**: Retrieve full message log for a specific conversation session.

### 4. `POST /api/ai-chat/message`
* **Description**: Send a message to CivicPulse AI Copilot.
* **Payload**:
  ```json
  { "message": "What is the status of my recent complaints?", "conversationId": "optional_hex_id" }
  ```

---

## 👮 Officer Router (`/api/officer`)

All routes require authentication and `COMPLAINTS_MANAGE` permission.

### 1. `GET /api/officer/stats`
* **Description**: Officer workload statistics (pending, assigned, resolved).

### 2. `GET /api/officer/dept-stats`
* **Description**: Department performance metrics and resolution rates.

### 3. `GET /api/officer/complaints`
* **Description**: Retrieve complaints assigned to officer's department.

### 4. `GET /api/officer/complaints/:id`
* **Description**: Detailed complaint management view for officers.

### 5. `PUT /api/officer/complaints/:id/status`
* **Description**: Transition complaint status (`submitted` → `acknowledged` → `in_progress` → `resolved`).

### 6. `POST /api/officer/complaints/:id/assign`
* **Description**: Assign complaint to a municipal field worker.
* **Payload**:
  ```json
  { "workerId": "worker_user_id" }
  ```

### 7. `POST /api/officer/complaints/:id/notes`
* **Description**: Add internal investigation notes to a complaint file.

### 8. `POST /api/officer/complaints/:id/resolution`
* **Description**: Submit final resolution details for ticket closure.

### 9. `GET /api/officer/workers`
* **Description**: Retrieve list of available field workers in the department.

---

## 👷 Field Worker Router (`/api/field-worker`)

All routes require authentication and `field_worker` or `admin` role.

### 1. `GET /api/field-worker/jobs`
* **Description**: Get assigned field tasks and work orders.

### 2. `GET /api/field-worker/jobs/:id`
* **Description**: Detailed job inspection view with location coordinates and instructions.

### 3. `PUT /api/field-worker/jobs/:id/status`
* **Description**: Update field work progress (`acknowledged`, `in_progress`, `completed`).

### 4. `POST /api/field-worker/jobs/:id/photos`
* **Description**: Upload photo proof of completed field work.

---

## 🔔 Notifications Router (`/api/notifications`)

All routes require authentication (`Bearer Token`).

### 1. `GET /api/notifications`
* **Description**: Retrieve user notifications.

### 2. `PUT /api/notifications/read-all`
* **Description**: Mark all user notifications as read.

### 3. `PUT /api/notifications/:id/read`
* **Description**: Mark a single notification as read.

### 4. `DELETE /api/notifications/:id`
* **Description**: Delete a notification item.

---

## 🛡️ Administrative Router (`/api/admin`)

All routes require authentication and specific administrative permissions.

### 1. `GET /api/admin/dashboard/overview`
* **Auth**: Required (`ANALYTICS_VIEW`).
* **Description**: Dashboard diagnostics, workload numbers, and active system counts.

### 2. `GET /api/admin/dashboard/analytics`
* **Auth**: Required (`ANALYTICS_VIEW`).
* **Description**: Detailed analytics breakdown across categories and time periods.

### 3. `GET /api/admin/users`
* **Auth**: Required (`USERS_VIEW`).
* **Description**: Query system users list with filtering by role and status.

### 4. `PUT /api/admin/users/:id/status`
* **Auth**: Required (`USERS_MANAGE`).
* **Description**: Activate or deactivate user accounts.

### 5. `PUT /api/admin/users/:id/lock`
* **Auth**: Required (`USERS_MANAGE`).
* **Description**: Lock or unlock user account. Writes audit ledger record.

### 6. `PUT /api/admin/users/:id/reset-password`
* **Auth**: Required (`USERS_MANAGE`).
* **Description**: Force password reset for a user.

### 7. `GET /api/admin/departments`
* **Auth**: Required (`DEPTS_MANAGE`).
* **Description**: Fetch all municipal departments. Utilizes read-through caching.

### 8. `POST /api/admin/departments`
* **Auth**: Required (`DEPTS_MANAGE`).
* **Description**: Create a new municipal department. Invalidates cache.

### 9. `PUT /api/admin/departments/:id`
* **Auth**: Required (`DEPTS_MANAGE`).
* **Description**: Update department name, description, or contact details.

### 10. `DELETE /api/admin/departments/:id`
* **Auth**: Required (`DEPTS_MANAGE`).
* **Description**: Delete department record.

### 11. `POST /api/admin/departments/:id/assign`
* **Auth**: Required (`DEPTS_MANAGE`).
* **Description**: Assign an officer to a department.

### 12. `POST /api/admin/departments/:id/remove`
* **Auth**: Required (`DEPTS_MANAGE`).
* **Description**: Remove an officer from a department.

### 13. `GET /api/admin/reports/generate`
* **Auth**: Required (`REPORTS_GENERATE`).
* **Description**: Generate analytical operational summary report.

### 14. `GET /api/admin/reports/export`
* **Auth**: Required (`REPORTS_GENERATE`).
* **Description**: Export system audit and complaints statistics as CSV.

### 15. `GET /api/admin/audit-logs`
* **Auth**: Required (`AUDIT_VIEW`).
* **Description**: Query system audit log ledger for administrative tracking.

### 16. `POST /api/admin/notifications/broadcast`
* **Auth**: Required (`USERS_MANAGE`).
* **Description**: Send broadcast notification to all system users or specific roles.

