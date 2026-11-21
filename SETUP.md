# CertiFlow: Setup & Installation Guide

This guide walks you through setting up, configuring, and running the **CertiFlow** platform locally on Windows, macOS, or Linux.

---

## 1. Prerequisites

Before getting started, make sure you have the following installed:
- **Node.js**: `v18.0.0` or higher (`v20+` recommended)
- **npm**: `v9.0.0` or higher
- **PostgreSQL**: Running locally on port `5432`
- **Redis** *(Optional)*: Running locally on port `6379`. (If Redis is not installed or offline, CertiFlow automatically and safely degrades to PostgreSQL and in-memory caches without errors).

---

## 2. Environment Configuration

### Backend Environment (`backend/.env`)
Create or verify the `backend/.env` file with the following configuration:

```env
# Application Port
PORT=5000
NODE_ENV=development

# PostgreSQL Connection String
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/cirtiflow?schema=public"

# Redis Connection (Optional - Graceful fallback if unavailable)
REDIS_URL="redis://localhost:6379"

# Security & Tokens
JWT_SECRET="super-secret-certiflow-jwt-key-2026-production"
JWT_EXPIRES_IN="7d"

# CORS Allowed Origin
CORS_ORIGIN="http://localhost:5173"
```

> **Note**: Update the username, password, or port in `DATABASE_URL` if your local PostgreSQL credentials differ.

---

## 3. One-Step Backend Setup & Startup

To migrate the database schema, seed default demo personas, and launch the backend server in a single command, run:

```bash
cd backend
npm run setup:run
```

### What this command executes under the hood:
1. `npx prisma db push --skip-generate`: Syncs all 9 database tables and relations to PostgreSQL `cirtiflow`.
2. `npm run prisma:seed`: Creates the 7 demo accounts and training centres with pre-hashed credentials (`Password@123`).
3. `npm run dev`: Starts the live backend server on port `5000` with hot-reloading enabled.

---

## 4. Frontend Setup & Startup

In a separate terminal, install dependencies and start the Vite development server:

```bash
cd frontend
npm install
npm run dev
```

The frontend will start instantly at:
👉 **`http://localhost:5173`**

---

## 5. Verifying the Setup

1. **Backend Health Check**:
   Open [http://localhost:5000/health](http://localhost:5000/health) in your browser.  
   Expected JSON response:
   ```json
   {
     "status": "ok",
     "service": "CertiFlow API",
     "database": "connected"
   }
   ```

2. **Frontend Portal**:
   Open [http://localhost:5173](http://localhost:5173).  
   You will see the official CertiFlow Sign-In page with the 1-Click Demo Accounts panel.

---

## 6. Pre-Configured Demo Accounts

All demo accounts share the password: **`Password@123`**

| Persona | Role | Email | Purpose / Workspace |
| :--- | :--- | :--- | :--- |
| **Anika Sharma** | `TRAINING_CENTRE` | `anika@certiflow.com` | Apex Skills Training Centre (Pune). Upload candidate spreadsheets, fix and resubmit returned batches. |
| **Dev Patel** | `DISTRICT_OFFICER` | `dev@certiflow.com` | District Officer 1 (Pune). Reviews batches, casts Vote 1 of 2. |
| **Meera Deshmukh**| `DISTRICT_OFFICER` | `meera@certiflow.com` | District Officer 2 (Pune). Reviews batches, casts Vote 2 of 2 (satisfies quorum). |
| **Neha Kulkarni** | `QUALITY_OFFICER` | `neha@certiflow.com` | Quality Scrutiny Officer (Statewide). Audits batches with $\ge 50$ candidates. |
| **Farah Khan** | `STATE_OFFICE` | `farah@certiflow.com` | State Director (Statewide). Final approval, certificate issuance, SLA delay monitor, certificate cancellation. |
| **Nagpur Officer**| `DISTRICT_OFFICER` | `nagpur.officer@certiflow.com` | District Officer (Nagpur). Verifies cross-district jurisdiction isolation (Pune batches hidden). |
| **Public Citizen** | `PUBLIC` | *(No login required)* | Public verifier for candidate verification codes (`PSM-XXXX-XXXX`) and PDF downloads. |

---

## 7. Sample Files for Testing

Sample candidate spreadsheets are located in the [`sample_csvs/`](../sample_csvs) folder:
- **`correct_1_small_batch.csv`**: 5 clean candidate rows (fast standard batch test).
- **`correct_2_medium_batch.csv`**: 10 clean candidate rows.
- **`correct_3_large_batch_quality_trigger.csv`**: 52 candidates (automatically routes to Quality Scrutiny).
- **`wrong_1_malformed_fields.csv`**: Contains short phone number, bad email, and empty name (triggers client-side and backend validation blocks).
- **`wrong_2_duplicate_phones.csv`**: Contains duplicated mobile numbers within the batch.
