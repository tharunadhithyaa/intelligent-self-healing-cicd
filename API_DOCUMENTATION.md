# API Endpoints Documentation

All routes are prefixed by `/api`. Most requests require authorization headers: `Authorization: Bearer <Access_JWT_Token>`.

---

## 🔑 Authentication Router

### 1. `POST /auth/register`
* **Description**: Create a new user account.
* **Payload**:
  ```json
  { "firstName": "John", "lastName": "Doe", "email": "john@example.com", "password": "SecretPassword123!", "phone": "1234567890", "role": "citizen" }
  ```
* **Response**: `201 Created` with User object and tokens pair (accessToken, refreshToken).

### 2. `POST /auth/login`
* **Description**: Authenticate credentials.
* **Payload**:
  ```json
  { "email": "john@example.com", "password": "SecretPassword123!" }
  ```
* **Response**: `200 OK` with User details and tokens.

### 3. `POST /auth/refresh`
* **Description**: Rotate access tokens.
* **Payload**:
  ```json
  { "refreshToken": "stored_refresh_token_string" }
  ```
* **Response**: `200 OK` with new tokens pair.

---

## 👤 Citizen Router

### 1. `GET /citizen/preferences`
* **Description**: Retrieve citizen alert settings.
* **Auth**: Required (Role: `citizen`)

### 2. `PUT /citizen/preferences`
* **Description**: Update alert thresholds and email notification flags.
* **Payload**:
  ```json
  { "emailNotifications": true, "smsNotifications": false, "radiusAlerts": 5 }
  ```

---

## 📋 Complaints Router

### 1. `POST /complaints`
* **Description**: Submit a new complaint incident.
* **Auth**: Required (Role: `citizen`)
* **Payload**:
  ```json
  { "title": "Water leak", "description": "Broken pipe", "category": "Water Supply", "location": { "latitude": 12.97, "longitude": 77.59, "address": "123 Main St" }, "images": [] }
  ```

### 2. `GET /complaints`
* **Description**: Query incident list. Supports sorting, pagination, and status filters.
* **Auth**: Required (Admins/Officers see all, Citizens see their own submissions).

### 3. `PUT /complaints/:id/status`
* **Description**: Advance ticket workflow lifecycle.
* **Auth**: Required (Roles: `officer` or `field_worker`)
* **Payload**:
  ```json
  { "status": "in_progress", "title": "Work Begun", "description": "Crew dispatched to locations" }
  ```

---

## 🤖 AI Chatbot Router

### 1. `GET /ai-chat/conversations`
* **Description**: Retrieve active user chat history logs.
* **Auth**: Required.

### 2. `POST /ai-chat/message`
* **Description**: Send a message to CivicPulse AI Copilot.
* **Auth**: Required.
* **Payload**:
  ```json
  { "message": "What is the status of my complaints?", "conversationId": "optional_hex_conversation_id" }
  ```
* **Response**:
  ```json
  {
    "success": true,
    "message": "Reply generated successfully",
    "data": {
      "conversation": { "_id": "conv_id", "messages": [...] },
      "reply": "Here are your recent submitted incidents..."
    }
  }
  ```

---

## 🛡️ Administrative Router

### 1. `GET /admin/overview-stats`
* **Description**: Dashboard diagnostics workload numbers.
* **Auth**: Required (Permission: `analytics:view`)

### 2. `GET /admin/departments`
* **Description**: Fetch all municipal agencies. Returns cached roster if hit.
* **Auth**: Required (Permission: `depts:manage`)

### 3. `POST /admin/departments`
* **Description**: Create a department. Invalidates cache.
* **Payload**:
  ```json
  { "name": "Sanitation Division", "description": "Trash collection services", "contactInfo": "sanitation@city.gov" }
  ```

### 4. `POST /admin/users/:id/lock`
* **Description**: Lock suspicious user accounts. Writes to audit ledger.
* **Payload**:
  ```json
  { "isLocked": true }
  ```
* **Auth**: Required (Permission: `users:manage`)
