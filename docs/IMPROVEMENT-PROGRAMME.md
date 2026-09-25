# NSUPURE improvement programme

User authorized the whole recommendation programme, with no data loss and production edit/delete as immediate requirements. Implementation is staged because historical money/stock reconciliation and external provider configuration cannot be inferred from source code.

| Workstream | Current status | Completion criteria / remaining work |
|---|---|---|
| Production edit/delete/restore | Implemented in this branch | Staging/live verification after backup; reconcile legacy downstream dependencies before quantity corrections |
| Recovery and additive upgrades | SQLite upgrade rehearsed; live application export restored and compared privately | Render free usage exhausted; rehearse provider staging, verify external files and business totals before deployment |
| Owner/settings protection | Implemented | Verify original production identity and settings survive upgrade |
| Security foundation | Partially implemented | Unique secrets, constrained CORS, login throttling, password-session revocation and upload authentication added; MFA, all-route permission review, stronger account-management authorization, shared rate-limit store and private download UX remain |
| Quality review | Batch status workflow implemented | Approve required-test policy; connect released status to stock allocations, sales and dispatch; configure expiry from the approved product specification rather than fixed two-month assumption |
| Reliable offline work | Production creation implemented; other writes fail closed | IndexedDB/PWA cache, explicit conflict/resolution screen, owner-reviewed legacy queue export/import, retry UX after full page reload and idempotency for other domains |
| Connected inventory / recall | Not implemented | Audit physical opening stock; add material consumption mappings and batch allocation ledger; atomic FEFO allocation; returns, negative-stock prevention, customer traceability and recall workflow |
| Payments / reversals | Not implemented | Reconcile existing cash/MoMo/bank records; payment components, provider receipts, exact-money migration with before/after reconciliation, atomic balance updates, refunds and append-only reversal ledger |
| Driver workspace | Not implemented | Linked order/sale/stock state machine, vehicle capacity, loaded/delivered/returned/damaged reconciliation, proof of delivery and cash handover |
| MoMo integration | Requires chosen provider and merchant access | Verified webhook signatures, deduplication, receipt matching and reconciliation; never trust an unverified client payment status |
| Distributor portal | Not implemented | Customer identity, scoped data access, ordering, statements and delivery tracking |
| Cost and margin reporting | Not implemented | Verified allocations, material/power/labour/waste costs, route/customer margins; distinguish estimates from booked amounts |
| Maintenance / purchasing | Existing records need workflow extensions | Service schedules, reorder points, supplier lead times, purchasing approvals and notifications |
| Owner action dashboard | Existing dashboard; production void exclusion added | Operational exceptions tied to reliable underlying ledgers and assigned follow-up |
| CI / operations | Build, SQLite tests and upgrade checks added | PostgreSQL CI, dependency/security scanning, production telemetry, restore drills, controlled releases and rollback rehearsals |
| Forecasting / anomaly detection | Deferred until data quality is established | Backtest against verified historical data, confidence/error reporting, human approval for operational changes |

Do not merge or deploy this foundation as if all programme items are complete. Continue with the stock/payment reconciliation design once the live database is recovered and backed up. No production merge, deployment, purchase or database migration was performed while creating this branch.
