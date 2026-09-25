# NSUPURE BUSINESS MANAGEMENT SYSTEM

> Production correction upgrade: read [safe rollout instructions](docs/SAFE-ROLLOUT.md) before deployment. The [implementation programme](docs/IMPROVEMENT-PROGRAMME.md) distinguishes completed work from remaining improvements. Existing databases must be backed up and restore-tested before the additive upgrade.
**Operational Backbone for Sachet Water Manufacturing & Distribution**

**Enterprise:** NSUPURE MINERAL WATER ENTERPRISE  
**Factory Location:** Adumasa, Juaben Constituency, Ashanti Region, Ghana  
**Operation Start Date:** 21 December 2025  
**Core Product:** Nsupure 500ml Sachet Drinking Water (30 sachets = 1 bag)  
**Current Default Selling Price:** GH₵7.00 per bag (configurable by authorized management)  
**Primary Vehicle:** Aboboyaa Motorized Tricycle (~60 bags/trip capacity)  

---

## 1. System Overview

The **Nsupure Business Management System** is a unified, multi-module enterprise web application built to serve as the single source of truth for Nsupure Mineral Water Enterprise. It manages the complete manufacturing, packaging, inventory, sales, delivery, fleet, sanitation, staff, financial control, and compliance lifecycle.

### Core Modules
1. **Commercial & Sales POS:** Fast touch-friendly bag sales entry, price overrides with audit trail, cash/MoMo/bank/credit split payments, and instant printed receipts.
2. **Customer CRM & Statements:** Complete customer directory, credit terms (1–3 days), credit limits, and printable Ghanaian customer statement ledgers (Date, Reference, Description, Debit, Credit, Running Balance, Totals).
3. **Daily Production & Traceability:** Sub-minute shift production logging (8AM–12PM & 1PM–5PM), borehole raw and purified tank meter levels, good bags, rejects, reject rate %, production rate per hour, and sequential batch generation (`NSP-YYYY-MM-DD-001`).
4. **Fleet & Tricycle Logistics:** Aboboyaa motorized tricycle trip sheets, odometer logs, fuel cost per km, delivery cost per bag, and customer confirmation signatures.
5. **Inventory Control:** Sachet film rolls, outer bags, resin, carbon, quartz sand, treatment chemicals, and petrol tracking. Strict rule: every stock change requires an auditable `InventoryTransaction`.
6. **Cashbook & Financial Control:** Expected closing cash calculation, physical counted cash reconciliation with mandatory explanation of variances. Strict separation of Owner Capital Contributions and Owner Drawings from operational profit/loss.
7. **Quality Control & Sanitation:** Water laboratory test logs (pH, microbiological, net volume, TDS), 9-point daily factory sanitation checklist, and customer complaint investigations.
8. **Document Vault:** Regulatory and business document repository (FDA, GSA, EPA, Fire permit, Water test certificates) with version history and 30-day expiration warnings.
9. **Executive Reporting & Investor Dossier:** Comprehensive Monthly Management Reports, Bank/Investor Financing Reports, Financial Readiness Checklists, and real data-driven insights.

---

## 2. Technology Stack & Architecture

- **Backend:** Node.js (v24 LTS), TypeScript, Express.js.
- **ORM & Database:** Prisma ORM with normalized 55+ table relational schema. Configured with SQLite for instant local zero-daemon execution (`dev.db`) and 100% PostgreSQL compatibility for cloud production deployment.
- **Authentication & Security:** JWT session tokens, bcryptjs (salt rounds: 12), Helmet HTTP security headers, CORS origin protection, centralized error handling (no exposed stack traces), and immutable audit logs.
- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, Lucide React icons, and mobile-first touch optimization (touch targets $\ge 48\text{px}$).

---

## 3. Mathematical & Business Formulas

All calculations are centralized in `backend/src/utils/calculations.ts`:
- **Packaging:** $\text{Bags} = \frac{\text{Sachets}}{30}$
- **Production:** $\text{Good Bags} = \text{Bags Produced} - \text{Rejected Bags}$
- **Reject Rate:** $\text{Reject Rate (\%)} = \left(\frac{\text{Rejected Bags}}{\text{Bags Produced}}\right) \times 100$
- **Production per Hour:** $\text{Hourly Rate} = \frac{\text{Good Bags}}{\text{Machine Operating Hours}}$
- **Revenue:** $\text{Total} = \text{Quantity} \times \text{Unit Selling Price}$
- **Credit:** $\text{Credit Created} = \text{Total Invoice} - \text{Amount Received}$
- **Cash Reconciliation:** $\text{Expected Closing} = \text{Opening Cash} + \text{Money In} - \text{Money Out}$; $\text{Variance} = \text{Counted Cash} - \text{Expected Cash}$
- **Operating Cost per Bag:** $\text{Cost per Bag} = \frac{\sum \text{Operating Expenses}}{\text{Good Bags Sold}}$
- **Delivery Cost per Bag:** $\text{Cost per Bag} = \frac{\text{Fuel Cost} + \text{Trip Allowances}}{\text{Bags Delivered}}$

---

## 4. Quick Start (Local Development)

### Backend Setup
```bash
cd backend
npm install
npx prisma generate
npx prisma db push
npm run prisma:seed
npm run dev
```
The backend API boots on `http://localhost:5000`.

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
The frontend UI boots on `http://localhost:3000`.

### Default Credentials
- **Username:** `owner`
- **Password:** `Nsupure2025!`

---

## 5. Production Deployment (Docker + PostgreSQL)

```bash
docker-compose up -d --build
```
This deploys:
1. PostgreSQL 16 on port `5432` with volume persistence.
2. Nsupure Backend API on port `5000`.
3. Nsupure Frontend Web Server on port `3000`.

---

## 6. Testing

To run the automated calculation and formula verification tests:
```bash
cd backend
npm test
```
All unit tests verify the exact Ghana sachet water manufacturing and distribution specifications.
