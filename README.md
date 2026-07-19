# CivicPulse AI – Community Issue Reporting & Resolution Management System

CivicPulse AI is an enterprise-grade municipal platform designed to digitize community reporting, automate ticket routing using lightweight AI semantic keywords classifiers, streamline worker workflows, and provide administrators with auditing controls, performance analytics, and dynamic role permissions.

---

## 🌟 Key Features

### 👤 Citizen Portal
* **Wizard Complaint Stepper**: Standard 4-step wizard (Issue details, AI prediction overview, photos upload up to 3 files max 2MB, final confirmation).
* **AI Copilot Widget**: Global floating chatbot helping citizens lookup ticket status, request guidance, or retrieve department contact directories.
* **Incident Hub**: Tracks status updates, timelines, and resolution updates.

### 👮 Officer Portal
* **Inbox Dispatcher**: Grid separating submitted, assigned, and resolved incidents.
* **Dynamic Assignment**: Assigns complaints to specific departments and selects active Field Workers.
* **Suggested Actions**: AI copilot summarizer proposing workflow steps.

### 👷 Field Worker Portal
* **Task Dashboard**: Displays worker allocations.
* **Roster Progress Update**: Actions to mark tasks as in-progress or submit resolution details (with notes).

### 🛡️ Administrator Portal
* **Control Center Dashboard**: Real-time overview count cards, monthly volume SVG trends, and incident hotspot heatmaps.
* **Identity Controls**: Deactivate accounts, toggle security locks, or perform temporary password resets.
* **Agencies & Rosters**: Add departments and reassign municipal officers with active workload safety checks.
* **Immutable Logs Ledger**: Audit grid log trace tracking secure system configurations.
* **Reports Summary**: Performance workload graphs and range-based CSV exports.

---

## ⚙️ Technology Stack

* **Frontend**: Angular 17 (Standalone architecture, reactive Signals, SCSS stylesheets, Material icons).
* **Backend**: Node.js, Express, TypeScript (`tsc`).
* **Database**: MongoDB (Mongoose schemas, indexing constraints).
* **Security & Caching**: Helmet headers, Cors, rate limiting, request sanitizer middlewares, in-memory API caching.
* **Logging**: Winston logger (structured files and colorized console logging).
* **Containers**: Docker multi-stage build scripts, Docker Compose files.

---

## 🛠️ Local Installation & Development

### Prerequisites
* **Node.js** (version 20.x or higher)
* **MongoDB** (running locally on port `27017` or URI link)

### 1. Setup Backend APIs
Navigate to the `backend` folder:
```bash
cd backend
npm install
```
Create a `.env` file inside `backend/`:
```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/civicpulse
NODE_ENV=development
JWT_ACCESS_SECRET=your-access-secret-key-123!
JWT_REFRESH_SECRET=your-refresh-secret-key-123!
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
```
Launch the development server:
```bash
npm run dev
```

### 2. Setup Frontend Client
Navigate to the `frontend` folder:
```bash
cd ../frontend
npm install
```
Launch the angular client:
```bash
npm start
```
Open [http://localhost:4200](http://localhost:4200) in your browser.

---

## 🧪 Running Integration Tests
To run the automated test suite (user auth, JWT validations, local AI checks, caches, database CRUD):
```bash
cd backend
npm test
```

---

## 🐳 Docker Deployment

The CivicPulse AI project uses an enterprise-grade multi-container architecture. Each service has its own dedicated Dockerfile:
- `frontend/Dockerfile.frontend`: Multi-stage Angular build.
- `backend/Dockerfile.backend`: Optimized Node.js Express server.
- `database/Dockerfile.mongodb`: MongoDB 6.0 with initialization scripts.
- `nginx/Dockerfile.nginx`: Reverse proxy routing traffic and handling compression.

### Local Development Environment
To start the application in development mode with live-reloading:
```bash
docker compose up --build
```
- **Frontend Access**: [http://localhost:4200](http://localhost:4200) or [http://localhost](http://localhost)
- **Backend APIs Access**: [http://localhost:3000](http://localhost:3000)
- **Health endpoint**: [http://localhost/health](http://localhost/health)

### Environment Variables
Environment variables are managed locally. Ensure you have the following files configured correctly:
- `backend/.env`
- `frontend/.env`
