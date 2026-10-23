# RedFunds

RedFunds is a budgeting and expense-management web app designed for daily use on a phone, with desktop access for reviewing expenses. Public accounts with private per-user data are planned; authentication and ownership are not implemented yet.

## Current direction

Decisions recorded on October 22, 2026:

- **Working name: RedFunds.** Red is the founder's surname. Keep the current name while building and using the app; revisit branding before a public product launch or a significant domain purchase. Domain ownership and trademark clearance have not been established.
- **Private accounts for everyone.** Build sign-up/sign-in and enforce per-user expense-group ownership before opening registration. Better Auth will run inside the TypeScript application; Supabase is used only as the PostgreSQL host. Google sign-in can be added later.
- **Keep the existing stack:** Next.js App Router, React, TypeScript, Tailwind CSS, Prisma, and PostgreSQL. No backend replacement or native mobile rewrite is planned for the initial milestone.
- **Web first, designed for phones.** Complete the connected expense workflow before adding PWA installation or offline synchronization.
- Keep branding separate from business rules and database identifiers when adding features, so a future rename remains manageable.

See [the roadmap](docs/roadmap.md) for implementation priorities and acceptance criteria, and [the data model](docs/data-model.md) for the Salesforce-inspired core adaptation.

## Current implementation

The data hierarchy is `ExpenseGroup -> Category -> Expense`. Expense groups also have optional monthly `Budget` targets and `BankAssignment` records. They are not yet authenticated user workspaces. Prisma mappings retain the existing database names and data: `ExpenseGroup` maps to `Spending`, and `BankAssignment` maps to `ExpenseGroupBank`. `Budget` uses the existing `Budget` table. Expense payment choices use `PaymentMethod` (the existing `TransactionType` enum); `paymentMethod` and `legacyBankName` map to the existing `transactionType` and `bank` columns. Category's `expenseGroupId` still maps to `spendingId`.

Implemented source includes:

- Expense-group creation, home cards, and detail/history pages. Existing `/spending/[id]` URLs remain valid.
- Server-side queries and actions using Prisma and PostgreSQL.
- Philippine peso display formatting.

The app is an early prototype. Expense creation is not wired to the New Expense button, the categories page is a placeholder, and authentication, recurring entries, exchange rates, and offline synchronization are not implemented. Budget and bank-management screens are not implemented; their core schema is in place. Expense and budget amounts use exact integer centavos; see the migration notes below before deploying this version to an existing database.

## Local development

Use a development PostgreSQL database and keep connection credentials out of Git.

1. Install dependencies with `npm ci`.
2. Configure an untracked `.env` file with:
   - `DATABASE_URL`: runtime Prisma/PostgreSQL connection, also used by the seed script.
   - `DIRECT_URL`: connection used by the Prisma CLI through `prisma.config.ts`.
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
| `npm test` | Money, seed-guard, and isolated PostgreSQL migration checks; no live database required |

### Exact money and migration

`Expense.amountCentavos` is a positive PostgreSQL integer. For example, PHP 150.75 is stored as `15075`. A single expense may be at most PHP 21,474,836.47. `app/lib/money.ts` parses decimal strings without floating-point arithmetic, formats peso values, and sums integer centavos with overflow checks. Totals can exceed the single-expense limit while remaining safe JavaScript integers.

New input must be positive, with at most two decimal places; extra decimal places, signs, scientific notation, currency symbols, and grouping commas are rejected rather than silently rounded. Leading/trailing whitespace and leading zeros are accepted. The parser is ready for the future expense form; expense creation is still not implemented.

For existing databases, `20261022130000_exact_money_centavos` converts legacy float pesos through PostgreSQL `numeric` and rounds once to the nearest centavo (half-centavo ties round up). Invalid/nonfinite amounts, nonpositive values, values rounding to zero, and amounts exceeding the integer limit stop the transaction without dropping the original column. Record IDs, relationships, and dates are unchanged. A database constraint rejects nonpositive centavos.

Back up the database before applying the migration and reconcile expense counts and per-record converted amounts afterward. **Coordinate this migration with the new application release:** it replaces `amount` with `amountCentavos`, so the older deployed application is not compatible with the new schema. Pause traffic during the release, apply committed migrations with `npx prisma migrate deploy`, generate the client, and deploy the matching code. Do not apply this migration independently to a database still serving the older Vercel release. The isolated tests exercise conversion, transaction rollback, and constraints without using `.env` or connecting to Supabase.

### Database connection troubleshooting

If a Supabase connection returns `(ENOTFOUND) tenant/user ... not found`, the shared pooler could not match the configured host and username to a project. This response can arrive after successful DNS resolution; it does not by itself mean a local DNS failure or an incorrect password. See [Supabase's troubleshooting guide](https://supabase.com/kb/troubleshooting/tenant-or-user-not-found).

Check the project's status in Supabase Dashboard, then copy the current connection strings from **Connect** into the untracked `.env` file. Use the Transaction pooler string for `DATABASE_URL` and a Session pooler string for `DIRECT_URL` when a direct connection is unavailable. Copy each host and username exactly, replacing only the password placeholder with the appropriately URL-encoded database password. Restart the app after changing `.env`.

The homepage currently queries the database during production prerendering, so this connection error also prevents `npm run build` from finishing even when compilation and TypeScript succeed. Validate connectivity before attempting migrations; the seed command is destructive and is not a connection repair step.

## Repository map

| Location | Responsibility |
| --- | --- |
| `app/` | Route entry points, root layout, and global styles |
| `app/(dashboard)/_home/expense-groups/` | Home expense-group section and its private `_components/` |
| `app/(dashboard)/expense-groups/_lib/` | Expense-group database queries and server actions |
| `app/(dashboard)/spending/[id]/` | Expense-group detail/history route; existing URLs retained |
| `app/(dashboard)/categories/` | Categories route placeholder |
| `app/lib/prisma.ts` | Shared runtime database client |
| `app/lib/money.ts` | Exact centavo parsing, formatting, and totals |
| `server/db/schema.prisma` | Data model |
| `server/db/migrations/` | Database migration history |
| `server/db/seed.ts` | Destructive demonstration-data seed |
| `docs/roadmap.md` | Planned milestones and completion criteria |
| `docs/data-model.md` | Core model, integrity rules, and preservation strategy |

Application code follows the same conventions as `johncarlored.com`: root `app/`, grouped feature routes, private `_home` sections, and route-local `_components` and `_lib` folders. `app/page.tsx` composes the home section. Shared helpers belong in `app/lib/`; future shared UI belongs in `app/components/ComponentName/ComponentName.tsx` when used across features. Keep feature-specific components beside their feature, using a named subfolder when a component needs supporting files.

Prisma schema, migrations, and seed tooling remain in `server/db/`; generated client output remains in the ignored root `generated/` folder. Runtime database access lives in `app/lib/prisma.ts`. The `@/*` alias continues to resolve from the repository root. Folder groups and private folders do not add URL segments.

Follow [AGENTS.md](AGENTS.md), including its requirement to read relevant bundled Next.js documentation before writing application code.
