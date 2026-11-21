# CertiFlow: Architecture & System Design Document

**Project**: CertiFlow — Skilling Certificate Issuance & Verification Platform  
**Mission**: Pragati Skills Mission (Government of Maharashtra)  
**System Architecture**: Distributed Multi-Tier Layered Architecture with Transactional Outbox Pattern  

---

## 1. High-Level Architecture Diagram

```
+─────────────────────────────────────────────────────────────────────────────────────────────────────────+
|                                           FRONTEND CLIENT                                               |
|                    (React 18 + TypeScript + Vite + Tailwind CSS + Redux Toolkit)                        |
|                                                                                                         |
|   +──────────────────+   +──────────────────+   +──────────────────+   +────────────────────────────+   |
|   | Training Centre  |   | District Review  |   | Quality Scrutiny |   | State Command & SLA        |   |
|   | Portal           |   | Desk (Quorum ≥2) |   | Dashboard (≥50)  |   | Center & Cert Registry     |   |
|   +──────────────────+   +──────────────────+   +──────────────────+   +────────────────────────────+   |
|   | In-Browser XLSX  |                                                 | Unauthenticated Public     |   |
|   | Pre-Validation   |                                                 | Verification & PDF Stream  |   |
|   +──────────────────+                                                 +────────────────────────────+   |
+────────────────────────────────────────────────────┬────────────────────────────────────────────────────+
                                                     │ HTTP / REST APIs (Bearer Token & HTTP-Only Cookies)
                                                     ▼
+─────────────────────────────────────────────────────────────────────────────────────────────────────────+
|                                           BACKEND API GATEWAY                                           |
|                               (Node.js + Express + TypeScript + Celebrate/Joi)                          |
|                                                                                                         |
|   +───────────────────────────────────+  +───────────────────────────────────+  +───────────────────+   |
|   | Auth Guard & RBAC Middleware      |  | Multer Memory Stream (CSV/XLS/X)  |  | Joi Body & Query  |   |
|   | (JWT + Cookie Fallback)           |  | Buffer Parser                     |  | Strict Validators |   |
|   +───────────────────────────────────+  +───────────────────────────────────+  +───────────────────+   |
|                                                     │                                                   |
|   +─────────────────────────────────────────────────┴───────────────────────────────────────────────+   |
|   |                                          CONTROLLER LAYER                                       |   |
|   |  auth.controller │ batch.controller │ district.controller │ state.controller │ verify.controller  |   |
|   +─────────────────────────────────────────────────┬───────────────────────────────────────────────+   |
+─────────────────────────────────────────────────────┼───────────────────────────────────────────────────+
                                                      │
                                                      ▼
+─────────────────────────────────────────────────────────────────────────────────────────────────────────+
|                                            SERVICE LAYER                                                |
|                                                                                                         |
|   +───────────────────+   +───────────────────+   +───────────────────+   +─────────────────────────+   |
|   | Batch Service     |   | District Service  |   | Quality Service   |   | State Service           |   |
|   | • Row Validator   |   | • Quorum Engine   |   | • ≥50 Auditor     |   | • Atomic Approval       |   |
|   | • Round 2 Logic   |   | • Redlock Guard   |   |                   |   | • Instant Revocation    |   |
|   +───────────────────+   +───────────────────+   +───────────────────+   +─────────────────────────+   |
|                                                     │                                                   |
|   +─────────────────────────────────────────────────┴───────────────────────────────────────────────+   |
|   | Vector Graphics PDF Renderer (pdfkit Landscape A4 + Dynamic Revocation Watermark)               |   |
|   +─────────────────────────────────────────────────┬───────────────────────────────────────────────+   |
+─────────────────────────────────────────────────────┼───────────────────────────────────────────────────+
                                                      │
                       ┌──────────────────────────────┴──────────────────────────────┐
                       ▼                                                             ▼
+─────────────────────────────────────────────+               +───────────────────────────────────────────+
|            PRIMARY ACID DATABASE            |               |           DISTRIBUTED IN-MEMORY           |
|            (PostgreSQL + Prisma)            |               |               CACHE & LOCKS               |
|                                             |               |             (Redis + ioredis)             |
|   • users (RBAC & Jurisdictions)            |               |                                           |
|   • training_centres                        |               |   • cache:verify:<CODE>                   |
|   • batches & candidates                    |               |     (Instant Public Lookup & Zero-PII)    |
|   • batch_approvals (Multi-Round Ledger)    |               |                                           |
|   • certificates (Unique PSM Code)          |               |   • lock:district:batch:<ID>              |
|   • delivery_logs (Provider Msg ID)         |               |     (Quorum Vote Concurrency Guard)       |
|   • audit_logs (Immutable Action Log)       |               |                                           |
|   • outbox (Transactional Outbox Events)    |               |   • Automatic Fallback if Redis Offline   |
+──────────────────────┬──────────────────────+               +───────────────────────────────────────────+
                       │
                       │ Background Poller / Event Loop
                       ▼
+─────────────────────────────────────────────────────────────────────────────────────────────────────────+
|                                    TRANSACTIONAL OUTBOX WORKER                                          |
|                               (services/outbox.service.ts — Idempotent)                                 |
|                                                                                                         |
|   +───────────────────────────────────────────────+   +─────────────────────────────────────────────+   |
|   | EVENT: BATCH_VALIDATION                       |   | EVENT: CERTIFICATE_ISSUED                   |   |
|   | • Asynchronously validates candidate rows     |   | • Dispatches Meta WhatsApp Cloud API        |   |
|   | • Pass -> DISTRICT_PENDING                    |   | • Records delivery_logs with providerMsgId  |   |
|   | • Fail -> VALIDATION_FAILED (Zero Partial DB) |   | • Idempotency key prevents duplicate sends  |   |
|   +───────────────────────────────────────────────+   +─────────────────────────────────────────────+   |
+─────────────────────────────────────────────────────────────────────────────────────────────────────────+
```

---

## 2. Core Architectural Pillars

### 2.1 Transactional Outbox Pattern
To prevent dual-write anomalies, HTTP connection timeouts, and duplicate notifications during bulk batch operations:
1. **Atomic Mutation**: When a batch is uploaded or a certificate is approved, state changes and Outbox event records are saved within the **same ACID PostgreSQL transaction**.
2. **Guaranteed Delivery**: A worker continuously polls `PENDING` outbox records.
3. **Strict Idempotency**: Every event has a unique `idempotencyKey` (e.g. `WHATSAPP_DELIVERY:<certificate_id>`). If the worker encounters a retry, duplicate deliveries are mathematically prevented.

### 2.2 Multi-Officer District Quorum Engine (Anti-Collusion)
- Every training centre is bound to a specific district (e.g. `Pune`).
- A batch requires approval from **at least 2 distinct officers** (`quorumRequired = 2`) assigned to that exact district.
- Redis distributed locks (`acquireLock('lock:district:batch:<id>')`) ensure concurrent votes from different officers do not race or cause double voting.
- If a batch is returned for correction (**Moment 6**), the batch increments to **Approval Round 2**, candidate rows are replaced, and a fresh round of 2 approvals is mandatory.

### 2.3 Quality Scrutiny Trigger ($\ge 50$ Threshold)
- Batches with $< 50$ candidates that achieve 2/2 district approvals advance directly to `STATE_PENDING`.
- Batches with $\ge 50$ candidates automatically route to `QUALITY_PENDING` for biometric verification and audit sign-off by the Quality Scrutiny Team before reaching the State Office.

### 2.4 Zero-PII Public Verification
- Public lookup endpoint (`GET /api/v1/verify/:code`) requires no authentication.
- Checks Redis cache (TTL 300s); on miss, queries PostgreSQL unique index on `verificationCode`.
- Returns candidate name, course name, training centre, batch number, and validity status.
- **Candidate phone numbers, email addresses, and personal identifiers are completely omitted from the API response.**

### 2.5 Vector PDF Engine & Instant Revocation
- Uses `pdfkit` for pure vector graphics generation (landscape A4 with guilloche borders, official mission seal, and verification boxes).
- When a certificate is revoked by the State Director:
  1. Certificate status transitions to `CANCELLED` with official reason.
  2. Redis verification cache is evicted immediately via `verifyService.invalidateCache`.
  3. Public verification immediately reflects `valid: false` with the revocation reason.
  4. Subsequent PDF views and downloads dynamically render a diagonal red **"OFFICIALLY CANCELLED"** watermark.

---

## 3. Database Schema Overview (Entity Relationship)

```
[TrainingCentre] 1 ──── ∞ [Batch] 1 ──── ∞ [Candidate]
       │                    │                  │
       │                    ├──── ∞ [BatchApproval]
       │                    │                  │
       │                    └──── ∞ [Certificate] 1 ──── 1 [Candidate]
       │                                       │
       │                                       └──── ∞ [DeliveryLog]
       │
   [User] (1:1 with TrainingCentre or Government Officer Roles)
       │
   [Outbox] (Decoupled Async Events)
       │
   [AuditLog] (Global Action Ledger)
```

---

## 4. Security & Role-Based Access Control (RBAC)

| Role | Allowed Workspaces & APIs |
| :--- | :--- |
| `TRAINING_CENTRE` | Upload candidate batches, list centre batches, resubmit returned batches. |
| `DISTRICT_OFFICER` | Access district pending queue (isolated by jurisdiction), vote approve, return, or reject. |
| `QUALITY_OFFICER` | Access large batch quality queue ($\ge 50$ candidates), pass or return quality reviews. |
| `STATE_OFFICE` | Final approval, certificate issuance, SLA monitoring, certificate revocation. |
| `PUBLIC` | Verify certificate by verification code, stream inline PDF, download PDF. Zero PII. |
