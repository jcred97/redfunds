# RedFunds roadmap

Planning baseline: October 22, 2026. All unchecked items below are planned work, not implemented capabilities.

Release update: October 25, 2026. [PR #1](https://github.com/jcred97/redfunds/pull/1) merged as `39be226038cb867de9a98fbfb357e013eace4236`; the authentication migration was applied and the matching Vercel production deployment reached ready status. A backup restore was verified, all 25 original business rows were preserved, and the five legacy expense groups remain unclaimed.

## Next milestone: private-account daily expense tracking

Each signed-in user can record an expense on a phone, correct mistakes, review monthly spending, and recover saved history. Retain the current Next.js, Prisma, and PostgreSQL foundation.

### 1. Make real data dependable

- [x] Adapt the core ExpenseGroup, Category, Expense, Budget, Bank, and BankAssignment schema while preserving legacy records. Use PaymentMethod and legacyBankName in application code with mappings to existing database identifiers. See [data model](data-model.md). Budget/bank management screens remain planned; exchange rates are deferred.

- [x] Implement integer-centavo storage, exact parsing/formatting/totals, and a transactional migration with conversion and rollback tests. Apply the migration together with the matching application release; the shared database rollout is a separate deployment step.
- [x] Guard destructive seeding: require explicit development mode and a reset opt-in; refuse Vercel production before database access. Only target disposable development databases.
- [x] Define expense dates as calendar days: default to today in `Asia/Manila`, store the selected day at UTC midnight in the existing timestamp column, and display its UTC calendar day. Existing timestamps are preserved.
- [x] Retain restricted deletion for expense groups/categories with child records and banks/assignments referenced by history. Document and test these rules in the core model.

### 2. Complete the core workflow

- [x] Implement Better Auth email/password accounts, sessions, and expense-group ownership in source, including sign-up/sign-in/sign-out, anonymous-access protection, and per-user queries/actions. Supabase remains only the database host.
- [x] Apply the auth migration and deploy the matching release; configure production secret/origin, verify database-role/RLS configuration, and check user isolation against the release. Completed October 25, 2026; preserved legacy groups remain unclaimed and hidden.
- [ ] Configure email delivery, email verification, and password recovery. Google sign-in remains deferred.

- [x] Implement owner-only category creation and category lists within an Expense Group, with server validation and accessible pending/error feedback.
- [ ] Implement category editing and deliberate deletion/archive behavior within an Expense Group.
- [x] Wire New Expense to a working owner-only creation form.
- [x] Add owner-only expense editing with the same validation and draft protection as creation.
- [ ] Add expense deletion with confirmation.
- [x] Validate title, amount, date, and category on the server. Ensure a submitted category belongs to the intended Expense Group and its signed-in owner.
- [x] Provide pending, success, and error feedback for creation; preserve entered values after failed saves.

### 3. Make daily phone use comfortable

- [ ] Prioritize amount entry, category selection, and a sensible date default.
- [x] Provide responsive summaries and a compact expense list with Edit actions on narrow screens; retain a table on desktop.
- [ ] Support long names, empty states, keyboard use, and accessible dialogs and labels.
- [ ] Add month/category filters and summaries that update after changes.
- [ ] Calculate totals in the database and paginate history rather than loading every expense to calculate a summary. Add indexes based on actual filters and access patterns.

### 4. Verify recovery and private access

- [ ] Provide a usable export and document an ongoing backup/restore procedure. The October 25 authentication release included a verified isolated backup restore; user export and the ongoing recovery workflow remain planned.
- [x] Add authentication and ownership checks covering implemented reads and mutations in source.
- [x] Activate those protections through a coordinated migration/deployment and verify signed-out, cross-user, and session-revocation behavior in the deployed environment. Production HTTP checks passed on October 25, 2026; temporary test accounts and groups were removed.

### Acceptance criteria

- At representative 360-430px phone widths, the entry flow and history are usable without horizontal page scrolling; the software keyboard does not hide essential controls.
- Create a Expense Group and Category, add an Expense, edit it, and delete it. Confirm changes survive refresh and summaries remain correct.
- Exact-money checks include PHP 0.10 + PHP 0.20 = PHP 0.30, plus a month-boundary date check under the chosen Manila date policy.
- Invalid amounts/dates and a category from another Expense Group are rejected by the server; a failed save retains input and supports a safe retry.
- Month/category filters agree with saved records and displayed totals.
- Exported history reconciles with source records, and a backup can be restored successfully.
- Run lint/build and meaningful automated checks for money handling, validation, and data access as those behaviors are implemented. Exercise the complete workflow on the owner's actual phone.

## Later: reliable personal automation

After the daily workflow is useful:

- Recurring expenses generated by a server-side job, with explicit schedules, retries, missed-run handling, and duplicate prevention.
- PWA installation, followed by durable offline capture and visible synchronization status if daily use demonstrates the need. Installation alone does not implement offline saves.
- Improved search, reporting, and imports driven by actual use.

## Before a multi-user product launch

- Revisit the RedFunds name, domains, and trademark searches. The provisional naming decision is not clearance.
- Maintain user-ownership checks and isolation tests as new reads and mutations are added. If shared finances enter scope, introduce explicit workspace membership and roles.
- Review backup operations, migration safety, monitoring, abuse controls, and export/account-deletion behavior.
- Add billing, external integrations, and larger background-job infrastructure only when required by the product scope.

## Deliberately deferred

Native mobile apps, bank synchronization, receipt AI, subscriptions, and a comprehensive offline sync engine are not prerequisites for the first single-user milestone.
