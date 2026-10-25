# Core data model

The core business model follows the Salesforce Budget & Expense Manager's Expense Group, Category, Expense, Budget, Bank, and Expense Group Bank concepts. Salesforce metadata and sharing rules are not copied into PostgreSQL. Better Auth email/password accounts and private per-user ownership are now implemented in source. Their migration and production release are pending; Supabase remains only the PostgreSQL host.

```text
User
  -> ExpenseGroup (existing database table: Spending)
       -> Category (existing database group column: spendingId)
            -> Expense
       -> Budget (optional, one per calendar month)
       -> BankAssignment -> Bank (shared catalog)
            -> Expense (optional bank assignment)
```

## Models and rules

| Model | Responsibility | Integrity rules |
| --- | --- | --- |
| `ExpenseGroup` | Container for a set of expenses, categories, budgets, and bank choices | Maps to `Spending`; nullable user owner preserves unclaimed legacy groups; referenced groups cannot be deleted |
| `Category` | Classifies expenses within one group | Existing IDs, names, icons, colors, and parent IDs are preserved |
| `Expense` | Positive PHP amount, date, title, optional notes and payment details | Integer centavos; category and optional bank assignment must belong to its group |
| `Budget` | Optional monthly target for a group | Positive integer centavos; month stored as a PostgreSQL DATE on the first day; unique group/month |
| `Bank` | Shared institution catalog | Unique normalized key; active flag; assigned banks cannot be deleted |
| `BankAssignment` | Enables a bank for a group and configures supported payment methods | Unique group/bank; four capabilities default to enabled; referenced assignments cannot be deleted |

Application names are mapped to the existing database identifiers. These naming improvements require no additional migration or record changes:

| Application name | Physical database name |
| --- | --- |
| `ExpenseGroup` | `Spending` table |
| `BankAssignment` | `ExpenseGroupBank` table |
| `PaymentMethod` | `TransactionType` enum |
| `Expense.paymentMethod` | `Expense.transactionType` column |
| `Expense.legacyBankName` | `Expense.bank` column |

`PaymentMethod` contains the existing Cash, Debit Card, Credit Card, Bank Transfer, and Bank Payment choices. Expense groups expose monthly targets through `budgets`. The application model is named `Budget` to describe the business concept; its current implementation remains monthly, matching the Salesforce app. Each `budgetMonth` must be the first day of its calendar month, with one budget per expense group/month and a positive integer-centavo amount. No daily, yearly, or custom-period fields are introduced. Raw SQL and historical migration tests intentionally retain physical database names.

Bank keys are the lower-case bank name after trimming surrounding spaces and collapsing internal whitespace. The caller supplies the key; a database CHECK rejects a key that does not match that normalization. Deactivation preserves existing assignments and historical expense labels. New-selection validation for active banks, active assignments, and allowed payment methods belongs to the future expense/bank forms and their server actions; this schema change does not implement those workflows.

`Expense.expenseGroupId` is backfilled from its category. Composite foreign keys to `Category(id, expenseGroupId)` and `BankAssignment(id, expenseGroupId)` enforce group consistency even outside the UI. The category's Prisma field maps to the physical `spendingId` column. These keys also prevent reparenting an assigned expense, category, or assignment into an incompatible group.

Existing bank text remains unchanged in the physical `Expense.bank` column, accessed as `legacyBankName` in Prisma, and `bankAssignmentId` initially stays null. No global bank or group assignment is inferred from historical text. Queries display the assignment's bank name when linked and otherwise display `legacyBankName`. Existing payment-method values remain untouched, including any historical combinations that future forms would not allow.

Category display names and totals are derived by queries/UI rather than duplicated as stored Salesforce formula/roll-up fields. Monthly budget keys and bank assignment keys use PostgreSQL composite uniqueness rather than concatenated strings.

## Data-preserving rollout

Migration `20261022150000_core_expense_group_model` runs in one transaction. It adds the new tables, adds/backfills each expense's group ID, and strengthens foreign keys. It neither renames nor recreates the original tables, resets sequences, nor changes existing amounts, titles, dates, bank text, categories, or group names. Existing `/spending/[id]` URLs remain supported.

Back up the existing application rows and migration history before applying it. Afterward, compare all original columns per ID, verify the group backfill and null bank assignments, and reconcile counts/totals. Apply migrations before running the new application build, which reads the new optional bank relation. The previous deployed read/create-group workflows remain compatible with the retained physical tables. Older external expense writers would need to supply the new required group ID and are outside this app's current implemented workflows.

The development seed still requires explicit opt-in. It resets all six core tables, preserves the legacy bank-text fixtures, and does not invent budgets or bank assignments.

## Deferred

Email verification/delivery, password recovery, Google sign-in, and administrative assignment of preserved groups are deferred. Daily, yearly, and custom budget periods, exchange rates and original-currency snapshots, recurring templates/jobs, and automation settings are deferred. The expense's existing date representation is unchanged; budget month DATE semantics do not settle the separate expense-date/Manila policy.

## Authentication and ownership

`User`, `Session`, `Account`, `Verification`, and `RateLimit` map to Better Auth's lowercase database tables. Credentials and server sessions remain in our PostgreSQL database. Passwords are hashed by Better Auth; a user ID, not an email address or provider identity, owns expense groups. New provider support can reuse that stable ID later; implicit account linking is disabled.

Migration `20261024100000_user_auth_ownership` adds nullable `Spending.userId` and an indexed foreign key to `user.id`. Existing rows stay null and are excluded from every signed-in user's group list and direct group reads. New groups use the server-verified session user ID. Neither registration nor the first login can claim historical records. Ownership checks include each requested record ID, so knowing another user's ID grants no access.

RLS is enabled on business and authentication tables without adding Data API policies. The migration refuses preexisting policies on these tables, requiring explicit audited resolution before retrying. With no policies, this denies the Supabase `anon`/`authenticated` API roles. Prisma runs through a trusted server role that must own the tables or hold `BYPASSRLS`; it does not propagate Better Auth sessions as Supabase identities. Application-level ownership filters provide user isolation for that trusted role.

The auth migration has been prepared and tested locally; applying it to the shared database and deploying the matching release are separate pending steps. Back up data, coordinate traffic during release, configure production auth secrets/origin, and verify preserved legacy groups remain inaccessible. See README for rollout instructions.
