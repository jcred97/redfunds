import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const authMigration = "20261024100000_user_auth_ownership";
const tables = [
  "Spending",
  "Category",
  "Expense",
  "Budget",
  "Bank",
  "ExpenseGroupBank",
];
const protectedTables = [
  ...tables,
  "user",
  "session",
  "account",
  "verification",
  "rateLimit",
];

async function migrationSql(name: string) {
  return readFile(
    path.join(process.cwd(), "server/db/migrations", name, "migration.sql"),
    "utf8",
  );
}

test("authentication migration preserves legacy data, constrains ownership, and denies direct public access", async (t) => {
  const db = await PGlite.create();

  try {
    const directory = path.join(process.cwd(), "server/db/migrations");
    const migrations = (await readdir(directory, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory() && entry.name < authMigration)
      .map((entry) => entry.name)
      .sort();

    for (const name of migrations) {
      await db.exec(await migrationSql(name));
    }

    await db.exec(`
      INSERT INTO "Spending" (id, name, "createdAt", "updatedAt") VALUES (7, 'Existing personal group', '2026-01-01', '2026-10-22');
      INSERT INTO "Category" (id, name, icon, color, "spendingId") VALUES (11, 'Food', 'icon', '#123456', 7);
      INSERT INTO "Bank" (id, name, key, "updatedAt") VALUES (31, 'BPI', 'bpi', '2026-10-22');
      INSERT INTO "ExpenseGroupBank" (id, "expenseGroupId", "bankId", "updatedAt") VALUES (41, 7, 31, '2026-10-22');
      INSERT INTO "Budget" (id, "expenseGroupId", "budgetMonth", "amountCentavos", description, "updatedAt") VALUES (51, 7, '2026-10-01', 120000, 'Monthly budget', '2026-10-22');
      INSERT INTO "Expense" (id, title, "amountCentavos", date, notes, bank, "categoryId", "expenseGroupId", "bankAssignmentId", "transactionType", "updatedAt") VALUES (21, 'Lunch', 12345, '2026-10-21 16:30:00', 'Keep note', ' Legacy bank ', 11, 7, 41, 'DEBIT_CARD', '2026-10-22');
    `);

    const before = new Map<string, unknown[]>();

    for (const table of tables) {
      before.set(
        table,
        (await db.query(`SELECT * FROM "${table}" ORDER BY id`)).rows,
      );
    }

    await db.exec(await migrationSql(authMigration));

    await t.test("all existing business fields and IDs survive and groups have no guessed owner", async () => {
      for (const table of tables) {
        const rows = (
          await db.query<Record<string, unknown>>(
            `SELECT * FROM "${table}" ORDER BY id`,
          )
        ).rows;

        if (table === "Spending") {
          assert.deepEqual(
            rows.map(({ userId, ...oldFields }) => {
              assert.equal(userId, null);
              return oldFields;
            }),
            before.get(table),
          );
        } else {
          assert.deepEqual(rows, before.get(table));
        }
      }

      for (const table of protectedTables.filter((name) => !tables.includes(name))) {
        assert.deepEqual((await db.query(`SELECT * FROM "${table}"`)).rows, []);
      }
    });

    await t.test("owners must exist and deleting an owner cannot erase business data", async () => {
      await assert.rejects(
        db.exec(`UPDATE "Spending" SET "userId" = 'missing' WHERE id = 7`),
        /Spending_userId_fkey/,
      );

      await db.exec(
        `INSERT INTO "user" (id, name, email) VALUES ('owner', 'Owner', 'owner@example.test'), ('spare', 'Spare', 'spare@example.test'); UPDATE "Spending" SET "userId" = 'owner' WHERE id = 7`,
      );
      await assert.rejects(
        db.exec(`DELETE FROM "user" WHERE id = 'owner'`),
        /Spending_userId_fkey/,
      );

      await db.exec(`
        INSERT INTO "session" (id, "expiresAt", token, "userId") VALUES ('owner-session', '2027-01-01', 'owner-secret', 'owner'), ('spare-session', '2027-01-01', 'spare-secret', 'spare');
        INSERT INTO "account" (id, "accountId", "providerId", "userId", password) VALUES ('owner-account', 'owner', 'credential', 'owner', 'password-hash'), ('spare-account', 'spare', 'credential', 'spare', 'password-hash');
        DELETE FROM "user" WHERE id = 'spare';
      `);

      assert.equal((await db.query(`SELECT * FROM "session"`)).rows.length, 1);
      assert.equal((await db.query(`SELECT * FROM "account"`)).rows.length, 1);
      await assert.rejects(
        db.exec(`INSERT INTO "session" (id, "expiresAt", token, "userId") VALUES ('bad', '2027-01-01', 'bad', 'missing')`),
        /session_userId_fkey/,
      );
    });

    await t.test("Data API roles cannot read or write even when granted table privileges", async () => {
      await db.exec(`
        INSERT INTO "verification" (id, identifier, value, "expiresAt") VALUES ('v', 'email', 'verification-secret', '2027-01-01');
        INSERT INTO "rateLimit" (id, key, count, "lastRequest") VALUES ('r', 'rate-key', 1, 123);
        CREATE ROLE anon NOLOGIN;
        CREATE ROLE authenticated NOLOGIN;
        GRANT USAGE ON SCHEMA public TO anon, authenticated;
        GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated;
        GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
      `);
      const flags = (
        await db.query<{ relname: string }>(
          `SELECT relname FROM pg_class WHERE relrowsecurity = true AND relnamespace = 'public'::regnamespace`,
        )
      ).rows;

      assert.deepEqual(
        flags.map((row) => row.relname).sort(),
        [...protectedTables].sort(),
      );

      for (const role of ["anon", "authenticated"]) {
        await db.exec(`SET ROLE ${role}`);

        try {
          for (const table of protectedTables) {
            assert.deepEqual(
              (await db.query(`SELECT * FROM "${table}"`)).rows,
              [],
              `${role} could read ${table}`,
            );
          }

          await assert.rejects(
            db.exec(`INSERT INTO "Spending" (name, "updatedAt", "userId") VALUES ('Forged group', NOW(), 'owner')`),
            /row-level security/,
          );
          await assert.rejects(
            db.exec(`INSERT INTO "user" (id, name, email) VALUES ('forged', 'Forged', 'forged@example.test')`),
            /row-level security/,
          );
          await db.exec(
            `UPDATE "Spending" SET name = 'Changed' WHERE id = 7; DELETE FROM "Spending" WHERE id = 7; UPDATE "account" SET password = 'changed'; DELETE FROM "session";`,
          );
        } finally {
          await db.exec("RESET ROLE");
        }
      }

      assert.deepEqual(
        (await db.query(`SELECT name, "userId" FROM "Spending" WHERE id = 7`)).rows,
        [{ name: "Existing personal group", userId: "owner" }],
      );
      assert.equal((await db.query(`SELECT * FROM "Expense"`)).rows.length, 1);
      assert.deepEqual(
        (await db.query(`SELECT password FROM "account"`)).rows,
        [{ password: "password-hash" }],
      );
      assert.equal((await db.query(`SELECT * FROM "session"`)).rows.length, 1);
    });
  } finally {
    await db.close();
  }
});

test("authentication migration stops and rolls back when an existing permissive policy needs review", async () => {
  const db = await PGlite.create();

  try {
    const directory = path.join(process.cwd(), "server/db/migrations");
    const migrations = (await readdir(directory, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory() && entry.name < authMigration)
      .map((entry) => entry.name)
      .sort();

    for (const name of migrations) {
      await db.exec(await migrationSql(name));
    }

    await db.exec(`
      INSERT INTO "Spending" (id, name, "updatedAt") VALUES (7, 'Preserve me', NOW());
      ALTER TABLE "Spending" ENABLE ROW LEVEL SECURITY;
      CREATE POLICY existing_public_read ON "Spending" FOR SELECT USING (true);
    `);
    await assert.rejects(
      db.exec(await migrationSql(authMigration)),
      /existing Data API policies require review/,
    );
    await db.exec("ROLLBACK");

    assert.deepEqual(
      (await db.query(`SELECT name FROM "Spending" WHERE id = 7`)).rows,
      [{ name: "Preserve me" }],
    );
    assert.deepEqual(
      (await db.query(`SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Spending' AND column_name = 'userId'`)).rows,
      [],
    );

    for (const table of ["user", "session", "account", "verification", "rateLimit"]) {
      assert.deepEqual(
        (await db.query(
          `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1`,
          [table],
        )).rows,
        [],
      );
    }

    assert.deepEqual(
      (await db.query(`SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'Spending'`)).rows,
      [{ policyname: "existing_public_read" }],
    );
  } finally {
    await db.close();
  }
});
