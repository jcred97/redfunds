# RedFunds

RedFunds is a budgeting and expense-management web app designed for daily use on a phone, with desktop access for reviewing expenses. Email/password accounts and private expense-group ownership run through Better Auth. The authentication migration and matching Vercel production release were completed on October 25, 2026.

## Current direction

Decisions recorded on October 22, 2026:

- **Working name: RedFunds.** Red is the founder's surname. Keep the current name while building and using the app; revisit branding before a public product launch or a significant domain purchase. Domain ownership and trademark clearance have not been established.
- **Private accounts for everyone.** Email/password sign-up/sign-in and per-user expense-group ownership are deployed. Better Auth runs inside the TypeScript application; Supabase is used only as the PostgreSQL host. Google sign-in can be added later.
- **Keep the existing stack:** Next.js App Router, React, TypeScript, Tailwind CSS, Prisma, and PostgreSQL. No backend replacement or native mobile rewrite is planned for the initial milestone.
- **Web first, designed for phones.** Complete the connected expense workflow before adding PWA installation or offline synchronization.
- Keep branding separate from business rules and database identifiers when adding features, so a future rename remains manageable.

See [the roadmap](docs/roadmap.md) for implementation priorities and acceptance criteria, and [the data model](docs/data-model.md) for the Salesforce-inspired core adaptation.

## Current implementation

The data hierarchy is `User -> ExpenseGroup -> Category -> Expense`. Expense groups also have optional monthly `Budget` targets and `BankAssignment` records. Server-side session checks and ownership filters protect expense groups and their child data. Existing groups remain unclaimed (`userId = null`) and hidden from all signed-in users until deliberately assigned through an administrative process. Prisma mappings retain the existing database names and data: `ExpenseGroup` maps to `Spending`, and `BankAssignment` maps to `ExpenseGroupBank`. `Budget` uses the existing `Budget` table. Expense payment choices use `PaymentMethod` (the existing `TransactionType` enum); `paymentMethod` and `legacyBankName` map to the existing `transactionType` and `bank` columns. Category's `expenseGroupId` still maps to `spendingId`.

Implemented source includes:

- Expense-group creation, home cards, and detail/history pages. Existing `/spending/[id]` URLs remain valid.
- Owner-only category creation and category lists inside each expense group, using the shared accessible name-entry dialog.
- Owner-only expense entry and editing with a title, peso amount, calendar date, and a category from the current group. Saved history and totals refresh after changes. Phone screens use compact expense cards; desktop screens retain the table.
- Email/password sign-up, sign-in, and sign-out through Better Auth, with authenticated server-side queries and actions using Prisma and PostgreSQL.
- Database-backed authentication rate limiting and private ownership of new expense groups.
- Philippine peso display formatting.

Sessions last seven days and can renew after one day. Server-rendered pages only validate the session; browser requests renew both the database expiry and the HTTP-only cookie together. A shared browser component checks the session on mount, when the window regains focus or reconnects, and every five minutes while a session exists. Expired or revoked sessions cannot be renewed.

The app is an early prototype. Expense deletion, category editing/deletion, email verification, password recovery, Google sign-in, recurring entries, exchange rates, and offline synchronization are not implemented. The standalone categories page is a placeholder. Budget and bank-management screens are not implemented; their core schema is in place. Expense and budget amounts use exact integer centavos; see the migration notes below before deploying this version to an existing database.

Full-screen loading feedback is reserved for sign-in, sign-up, and sign-out. Group navigation uses inline link feedback, and normal route loading uses a lightweight in-page message. Saves and edits keep their pending/error feedback inside the form dialog.

New expense dates represent calendar days. The form defaults to today's date in `Asia/Manila`; selected days are stored at UTC midnight in the existing timestamp column and displayed using UTC so the day does not shift between browser time zones. Existing stored timestamps are not rewritten.

## Local development

Use a development PostgreSQL database and keep connection credentials out of Git.

1. Install dependencies with `npm ci`.
2. Copy `.env.example` to an untracked `.env` file (the current workspace already has ignored local settings) and configure:
   - `DATABASE_URL`: runtime Prisma/PostgreSQL connection, also used by the seed script.
   - `DIRECT_URL`: connection used by the Prisma CLI through `prisma.config.ts`.
   - `BETTER_AUTH_SECRET`: generate at least 32 random bytes; the configuration requires a secret of at least 32 characters. Never reuse the example placeholder or commit the value.
   - `BETTER_AUTH_URL`: canonical origin, normally `http://localhost:3000` locally; HTTPS is required outside localhost. Do not include a path, query, or fragment.
3. For a fresh development database, apply committed migrations with `npx prisma migrate deploy`.
4. Generate the Prisma client with `npx prisma generate`.
5. Start the app with `npm run dev`, then open [localhost:3000](http://localhost:3000).

Check the target database before applying migrations. For existing databases, inspect migration history and back up data first; the committed spending migration adds a required category relationship without a backfill.

**Only seed a disposable development database.** The script resets all expenses, categories, budgets, bank assignments, banks, and expense groups before inserting demonstration records. It refuses execution unless both `NODE_ENV=development` and `REDFUNDS_ALLOW_DATABASE_RESET=true` are explicitly set, and always refuses a Vercel production environment. The guard runs before constructing a database client. Seeding is not required for startup, and these flags do not verify which database the URL targets. Do not save the reset opt-in in `.env`.

To intentionally replace demo data, first point `DATABASE_URL` at a disposable development database, apply migrations, then set those two environment variables for that invocation of `npm run seed` only. Remove the opt-in afterward. Never use this to repair a database connection.

Available scripts:

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run lint` | Run ESLint |
| `npm run build` | Generate Prisma client and build Next.js |
| `npm start` | Serve an existing production build |
| `npm run seed` | Guarded development reset; refuses by default |
| `npm test` | Run tests in `tests/`: money, authentication, ownership, seed-guard, and isolated PostgreSQL migrations; no live database required |

### Exact money and migration

`Expense.amountCentavos` is a positive PostgreSQL integer. For example, PHP 150.75 is stored as `15075`. A single expense may be at most PHP 21,474,836.47. `app/lib/money.ts` parses decimal strings without floating-point arithmetic, formats peso values, and sums integer centavos with overflow checks. Totals can exceed the single-expense limit while remaining safe JavaScript integers.

New input must be positive, with at most two decimal places; extra decimal places, signs, scientific notation, currency symbols, and grouping commas are rejected rather than silently rounded. Leading/trailing whitespace and leading zeros are accepted. The expense form uses this parser on the server before saving.

For existing databases, `20261022130000_exact_money_centavos` converts legacy float pesos through PostgreSQL `numeric` and rounds once to the nearest centavo (half-centavo ties round up). Invalid/nonfinite amounts, nonpositive values, values rounding to zero, and amounts exceeding the integer limit stop the transaction without dropping the original column. Record IDs, relationships, and dates are unchanged. A database constraint rejects nonpositive centavos.

Back up the database before applying the migration and reconcile expense counts and per-record converted amounts afterward. **Coordinate this migration with the new application release:** it replaces `amount` with `amountCentavos`, so the older deployed application is not compatible with the new schema. Pause traffic during the release, apply committed migrations with `npx prisma migrate deploy`, generate the client, and deploy the matching code. Do not apply this migration independently to a database still serving the older Vercel release. The isolated tests exercise conversion, transaction rollback, and constraints without using `.env` or connecting to Supabase.

### Authentication and production rollout

Better Auth owns credentials and sessions inside the Next.js application. Supabase supplies PostgreSQL only; Supabase Auth, API keys, and browser database access are not used. New accounts start with an empty expense-group list. Every new group gets the verified session user ID on the server; submitted owner IDs are never trusted.

The first release supports email/password sign-up, sign-in, and sign-out. Email addresses are not yet verified, and password recovery is not available until an email-delivery provider is configured. Google sign-in is deferred, with implicit provider linking disabled. Do not treat an email string alone as proof of identity or use it to claim preserved groups.

Migration `20261024100000_user_auth_ownership` adds Better Auth tables, database-backed rate-limit storage, and a nullable owner foreign key on `Spending`. It preserves existing IDs, amounts, child records, and group names; existing groups stay unclaimed. It enables row-level security on application/auth tables without adding Data API access policies. It refuses preexisting policies on the protected tables; resolve them explicitly after auditing before retrying the migration. With no policies, Supabase `anon`/`authenticated` Data API roles have deny-all access. The trusted server database role must own these tables or have `BYPASSRLS`; ordinary RLS-restricted roles cannot run the Prisma backend. The server role bypasses RLS, so application ownership checks remain essential.

Authentication throttling uses database storage across server instances and trusts `x-real-ip`, which Vercel supplies. If hosting behind another proxy, configure it to overwrite this header with the real client IP; do not accept client-controlled forwarding headers. When no trusted client IP is available (as observed locally), authentication requests share one fallback bucket per endpoint. Local browser tests can therefore throttle one another; Vercel supplies the trusted header in production.

The production rollout completed on October 25, 2026 through [PR #1](https://github.com/jcred97/redfunds/pull/1), merged as `39be226038cb867de9a98fbfb357e013eace4236`. Vercel reported the matching production deployment as ready. Production authentication variables were configured, a backup was restored and verified in an isolated database, and migration `20261024100000_user_auth_ownership` was applied successfully. All 25 original business rows were preserved; the five legacy expense groups remain unclaimed and hidden.

Production HTTP checks verified sign-up/sign-in for two independent accounts, anonymous redirects, private home lists, access to each account's own group, rejection of cross-user group IDs, hidden legacy records, hostile-origin rejection, and sign-out/session revocation. Temporary test accounts and groups were removed after verification.

The production domain is public and protected by application sign-in. Vercel Standard Protection restricts generated deployment URLs, including older releases without ownership checks; all six older ready deployments were verified behind the Vercel login gate. Keep those older deployment URLs protected while they retain database access.

For future installations or releases that change authentication storage, coordinate the migration with the matching application version:

1. Back up existing rows and inspect migration status and any RLS policies. Verify the runtime role owns the protected tables or has `BYPASSRLS`.
2. Set `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL` in the intended Vercel environment. Production uses `https://redfunds.vercel.app`; Preview needs its own explicit origin/settings. Changing environment variables requires a new deployment.
3. Restrict traffic during transitions where an older release lacks the required access controls or schema support; it must not serve newly private records.
4. Apply committed migrations with `npx prisma migrate deploy`, generate the client, and deploy the matching code. This release is not activated by merely pushing the schema file.
5. Verify anonymous redirects, two independent users, rejected cross-user IDs, sign-out/revocation, and preserved unclaimed legacy records. Any later assignment of legacy groups must target a specifically verified account ID, never the first account to sign up.

### Database connection troubleshooting

If a Supabase connection returns `(ENOTFOUND) tenant/user ... not found`, the shared pooler could not match the configured host and username to a project. This response can arrive after successful DNS resolution; it does not by itself mean a local DNS failure or an incorrect password. See [Supabase's troubleshooting guide](https://supabase.com/kb/troubleshooting/tenant-or-user-not-found).

Check the project's status in Supabase Dashboard, then copy the current connection strings from **Connect** into the untracked `.env` file. Use the Transaction pooler string for `DATABASE_URL` and a Session pooler string for `DIRECT_URL` when a direct connection is unavailable. Copy each host and username exactly, replacing only the password placeholder with the appropriately URL-encoded database password. Restart the app after changing `.env`.

Authenticated pages render per request because their session check uses request headers. A successful build alone does not establish runtime database connectivity. Authentication configuration is required during the build. Validate connectivity before attempting migrations; the seed command is destructive and is not a connection repair step.

## Repository map

| Location | Responsibility |
| --- | --- |
| `app/` | Route entry points, root layout, and global styles |
| `app/(dashboard)/_home/expense-groups/` | Home expense-group section and its private `_components/` |
| `app/(dashboard)/expense-groups/_lib/` | Expense-group database queries and server actions |
| `app/(dashboard)/spending/[id]/` | Expense-group detail/history route; existing URLs retained |
| `app/(dashboard)/categories/` | Categories route placeholder |
| `app/(auth)/` | Sign-up and sign-in routes and shared form |
| `app/api/auth/[...all]/` | Better Auth HTTP handler |
| `app/lib/auth-config.ts` | Better Auth configuration and Prisma adapter |
| `app/lib/auth.ts`, `app/lib/session.ts` | Server-only auth instance and session checks |
| `app/lib/auth-client.ts` | Same-origin browser auth client |
| `app/lib/prisma.ts` | Shared runtime database client |
| `app/lib/money.ts` | Exact centavo parsing, formatting, and totals |
| `server/db/schema.prisma` | Data model |
| `server/db/migrations/` | Database migration history |
| `server/db/seed.ts` | Destructive demonstration-data seed |
| `tests/lib/` | Money and authentication tests |
| `tests/expense-groups/` | Expense-group ownership and access tests |
| `tests/db/` | Seed-guard and database migration tests |
| `docs/roadmap.md` | Planned milestones and completion criteria |
| `docs/data-model.md` | Core model, integrity rules, and preservation strategy |

Application code follows the same conventions as `johncarlored.com`: root `app/`, grouped feature routes, private `_home` sections, and route-local `_components` and `_lib` folders. `app/page.tsx` composes the home section. Shared helpers belong in `app/lib/`; shared UI belongs in `app/components/ComponentName/ComponentName.tsx` when used across features. Keep feature-specific components beside their feature, using a named subfolder when a component needs supporting files.

Prisma schema, migrations, and seed tooling remain in `server/db/`; generated client output remains in the ignored root `generated/` folder. Runtime database access lives in `app/lib/prisma.ts`. The `@/*` alias continues to resolve from the repository root. Folder groups and private folders do not add URL segments.

Keep automated test files under the root `tests/` directory, grouped by the area they cover, so application folders contain implementation code. Tests import the implementation from `app/` or `server/`. When adding a test file, include its path in the `npm test` script.

Follow [AGENTS.md](AGENTS.md), including its requirement to read relevant bundled Next.js documentation before writing application code.
