# RedFunds

RedFunds is a personal budgeting and expense-management web app. The initial goal is reliable daily use by its owner, especially on a phone, with desktop access for reviewing spending.

## Current direction

Decisions recorded on October 22, 2026:

- **Working name: RedFunds.** Red is the founder's surname. Keep the current name while building and using the app; revisit branding before a public product launch or a significant domain purchase. Domain ownership and trademark clearance have not been established.
- **Personal use first.** One user is the initial audience. A broader product is a future possibility, not the scope of the first milestone.
- **Keep the existing stack:** Next.js App Router, React, TypeScript, Tailwind CSS, Prisma, and PostgreSQL. No backend replacement or native mobile rewrite is planned for the initial milestone.
- **Web first, designed for phones.** Complete the connected expense workflow before adding PWA installation or offline synchronization.
- Keep branding separate from business rules and database identifiers when adding features, so a future rename remains manageable.

See [the roadmap](docs/roadmap.md) for implementation priorities and acceptance criteria.

## Current implementation

The data hierarchy is `Spending -> Category -> Expense`. A Spending acts as a container for categories and expenses; it is not yet an authenticated user workspace.

Implemented source includes:

- Spending creation, home cards, and spending detail/history pages.
- Server-side queries and actions using Prisma and PostgreSQL.
- Philippine peso display formatting.

The app is an early prototype. Expense creation is not wired to the New Expense button, the categories page is a placeholder, and authentication, recurring entries, and offline synchronization are not implemented. Money currently uses floating-point storage; replacing it is an early roadmap task.

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

**Do not run `npm run seed` against valuable data.** The current script unconditionally truncates Expense, Category, and Spending, then inserts demonstration records. Seeding is not required for normal startup.

Available scripts:

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run lint` | Run ESLint |
| `npm run build` | Generate Prisma client and build Next.js |
| `npm start` | Serve an existing production build |
| `npm run seed` | Destructively replace database contents with demonstration data |

No automated test script is configured yet. Documentation of a command does not mean it has been verified in the current environment.

### Database connection troubleshooting

If a Supabase connection returns `(ENOTFOUND) tenant/user ... not found`, the shared pooler could not match the configured host and username to a project. This response can arrive after successful DNS resolution; it does not by itself mean a local DNS failure or an incorrect password. See [Supabase's troubleshooting guide](https://supabase.com/kb/troubleshooting/tenant-or-user-not-found).

Check the project's status in Supabase Dashboard, then copy the current connection strings from **Connect** into the untracked `.env` file. Use the Transaction pooler string for `DATABASE_URL` and a Session pooler string for `DIRECT_URL` when a direct connection is unavailable. Copy each host and username exactly, replacing only the password placeholder with the appropriately URL-encoded database password. Restart the app after changing `.env`.

The homepage currently queries the database during production prerendering, so this connection error also prevents `npm run build` from finishing even when compilation and TypeScript succeed. Validate connectivity before attempting migrations; the seed command is destructive and is not a connection repair step.

## Repository map

| Location | Responsibility |
| --- | --- |
| `app/` | Route entry points, root layout, and global styles |
| `app/(dashboard)/_home/spendings/` | Home spending section and its private `_components/` |
| `app/(dashboard)/spending/_lib/` | Spending database queries and server actions |
| `app/(dashboard)/spending/[id]/` | Spending detail/history route |
| `app/(dashboard)/categories/` | Categories route placeholder |
| `app/lib/prisma.ts` | Shared runtime database client |
| `server/db/schema.prisma` | Data model |
| `server/db/migrations/` | Database migration history |
| `server/db/seed.ts` | Destructive demonstration-data seed |
| `docs/roadmap.md` | Planned milestones and completion criteria |

Application code follows the same conventions as `johncarlored.com`: root `app/`, grouped feature routes, private `_home` sections, and route-local `_components` and `_lib` folders. `app/page.tsx` composes the home section. Shared helpers belong in `app/lib/`; future shared UI belongs in `app/components/ComponentName/ComponentName.tsx` when used across features. Keep feature-specific components beside their feature, using a named subfolder when a component needs supporting files.

Prisma schema, migrations, and seed tooling remain in `server/db/`; generated client output remains in the ignored root `generated/` folder. Runtime database access lives in `app/lib/prisma.ts`. The `@/*` alias continues to resolve from the repository root. Folder groups and private folders do not add URL segments.

Follow [AGENTS.md](AGENTS.md), including its requirement to read relevant bundled Next.js documentation before writing application code.
