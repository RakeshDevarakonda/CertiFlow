# CertiFlow: Skilling Certificate Issuance & Verification Platform

![CertiFlow License](https://img.shields.io/badge/License-ISC-blue.svg)
![Build](https://img.shields.io/badge/Build-Passing-brightgreen.svg)
![Test Coverage](https://img.shields.io/badge/E2E%20Tests-100%25%20Passed-success.svg)
![Node.js](https://img.shields.io/badge/Node.js-v20+-green.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-v5+-blue.svg)
![React](https://img.shields.io/badge/React-18-cyan.svg)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-v14+-blue.svg)

> Official platform developed for the **Pragati Skills Mission** (Government of Maharashtra) to eliminate fake vocational certificates, ghost candidates, and single-officer administrative fraud.

---

## 🌟 Executive Summary

**CertiFlow** is an enterprise-grade digital skilling platform featuring an immutable audit trail, multi-officer quorum reviews ($\ge 2$), transactional outbox background processing, client-side spreadsheet pre-validation, instant unauthenticated zero-PII verification, and dynamic in-memory vector PDF generation.

---

## 📋 The 6 Critical Problem Statement Moments

| Moment | Requirement | Implementation in CertiFlow |
| :--- | :--- | :--- |
| **Moment 1** | **Upload & Safety** | Row-level validation for CSV, XLSX, and XLS rosters. If any row is corrupted or contains duplicate phones, the batch is held in `VALIDATION_FAILED` with zero partial database writes. Pre-upload client validation catches errors directly in the browser. |
| **Moment 2** | **Multi-Officer District Quorum** | Minimum of **2 distinct district officers** in the same jurisdiction must approve. Dedicated tabs (`Needs My Review` vs `Approved By Me`) prevent double voting with Redis concurrency guards. |
| **Quality Trigger** | **Large Batch Scrutiny** | Batches with $\ge 50$ candidates automatically route to `QUALITY_PENDING` for biometric verification by the Quality Scrutiny team before advancing to State level. |
| **Moment 3** | **State Seal & Issuance** | State Office grants final sign-off, issuing certificates atomically with unique verification codes (`PSM-XXXX-XXXX`) and enqueuing WhatsApp notifications via the Transactional Outbox. |
| **Moment 4** | **Public Zero-PII Verification** | Unauthenticated public search (`/api/v1/verify/:code`) verifying candidate name, course, and status with **zero personal contact information exposed**. If cancelled, public view reflects revocation immediately with official reasons. |
| **Moment 5** | **SLA Inactivity Monitoring** | State Command Center detects and flags batches inactive beyond threshold hours ($>48\text{h}$) across any review desk. |
| **Moment 6** | **Batch Fix & Resubmission** | Returned batches allow training centres to upload a corrected spreadsheet, automatically incrementing to `Approval Round 2` and requiring a fresh round of 2 district approvals. |

---

## 🛠️ Technology Stack

- **Backend**: Node.js (ES Modules), TypeScript, Express.js, Prisma ORM, PostgreSQL, Redis (ioredis), PDFKit (Vector PDF rendering), Celebrate / Joi.
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS v3 (Clean Light Theme), Redux Toolkit, SheetJS (`xlsx`), Lucide React.
- **Architecture**: Distributed Layered Architecture + Transactional Outbox Pattern + Redis Distributed Locking (`redlock`).

---

## 🚀 Quick Start (One-Step Run)

### 1. Start Backend (Database migration, seed & server)
```bash
cd backend
npm run setup:run
```
*Backend runs on `http://localhost:5000` (Health check: `http://localhost:5000/health`)*

### 2. Start Frontend
```bash
cd frontend
npm install
npm run dev
```
*Frontend runs on `http://localhost:5173`*

---

## 👥 Demo Accounts (1-Click Login)

Default password for all accounts: **`Password@123`**

| Persona | Role | Email |
| :--- | :--- | :--- |
| **Anika Sharma** | Training Centre (Pune) | `anika@certiflow.com` |
| **Dev Patel** | District Officer 1 (Pune) | `dev@certiflow.com` |
| **Meera Deshmukh** | District Officer 2 (Pune) | `meera@certiflow.com` |
| **Neha Kulkarni** | Quality Scrutiny Officer | `neha@certiflow.com` |
| **Farah Khan** | State Director | `farah@certiflow.com` |
| **Nagpur Officer** | District Officer (Nagpur) | `nagpur.officer@certiflow.com` |
| **Public Citizen** | Public Verifier | *(No login required)* |

---

## 📂 Documentation Links

- 🏛️ **[ARCHITECTURE.md](./ARCHITECTURE.md)**: System architecture diagrams, entity relationships, outbox pipeline, and security design.
- ⚙️ **[SETUP.md](./SETUP.md)**: Step-by-step installation instructions, environment variable configurations, and test files guide.

---

## 📄 License
This project is licensed under the ISC License.
