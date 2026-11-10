import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { PrismaPg } from "@prisma/adapter-pg";
import { createExpenseGroupAccess } from "../../../app/(dashboard)/_lib/expense-groups/access";
import { PrismaClient } from "../../../generated/prisma/client";

const execFileAsync = promisify(execFile);

test("demo groups are visible only to the explicitly selected development account", async () => {
  const db = await PGlite.create();
  const server = new PGLiteSocketServer({ db, host: "127.0.0.1", port: 0 });
  let prisma: PrismaClient | undefined;

  try {
    const root = process.cwd();
    const directory = path.join(root, "server/db/migrations");
    const migrations = (await readdir(directory, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();

    for (const migration of migrations) {
      await db.exec(await readFile(path.join(directory, migration, "migration.sql"), "utf8"));
    }

    await db.exec(`
      INSERT INTO "user" (id, name, email) VALUES
        ('owner', 'Demo owner', 'owner@example.test'),
        ('other', 'Other user', 'other@example.test');
      INSERT INTO "Spending" (name, "userId", "updatedAt")
        VALUES ('Existing group', 'other', CURRENT_TIMESTAMP);
    `);

    await server.start();
    const connectionString = `postgresql://postgres:postgres@${server.getServerConn()}/postgres`;
    const seed = (email?: string) =>
      execFileAsync(
        process.execPath,
        ["--import", "tsx", path.join(root, "server/db/seed/run.ts")],
        {
          // Isolate the child from the repo's .env and pass only local connection settings.
          cwd: path.join(root, "tests/db/seed"),
          env: {
            SystemRoot: process.env.SystemRoot,
            DATABASE_URL: connectionString,
            DIRECT_URL: connectionString,
            DOTENV_CONFIG_QUIET: "true",
            NODE_ENV: "development",
            REDFUNDS_ALLOW_DATABASE_RESET: "true",
            REDFUNDS_SEED_USER_EMAIL: email,
          },
          timeout: 15_000,
        },
      );
    const readGroups = async () =>
      (await db.query('SELECT name, "userId" FROM "Spending"')).rows;
    const existingGroups = [{ name: "Existing group", userId: "other" }];

    for (const [email, error] of [
      [undefined, /Set REDFUNDS_SEED_USER_EMAIL/],
      ["missing@example.test", /No development account matches REDFUNDS_SEED_USER_EMAIL/],
    ] as const) {
      await assert.rejects(() => seed(email), error);
      assert.deepEqual(await readGroups(), existingGroups);
    }

    await db.exec(`
      ALTER TABLE "Spending" ADD CONSTRAINT test_seed_rollback CHECK (name <> 'Red Family');
    `);
    await assert.rejects(() => seed("owner@example.test"), /test_seed_rollback/);
    assert.deepEqual(await readGroups(), existingGroups);
    await db.exec('ALTER TABLE "Spending" DROP CONSTRAINT test_seed_rollback');

    await seed("  OwNeR@Example.Test  ");
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString, max: 1 }),
    });
    const owner = createExpenseGroupAccess(prisma, async () => "owner");
    const other = createExpenseGroupAccess(prisma, async () => "other");
    const demoGroups = await owner.list();

    assert.deepEqual(demoGroups.map((group) => group.name).sort(), ["JC Personal", "Red Family"]);
    assert.equal(await prisma.expenseGroup.count(), 2);
    assert.equal(await prisma.category.count(), 5);
    assert.equal(await prisma.expense.count(), 15);
    assert.deepEqual(await prisma.user.findMany({
      select: { id: true, email: true },
      orderBy: { id: "asc" },
    }), [
      { id: "other", email: "other@example.test" },
      { id: "owner", email: "owner@example.test" },
    ]);
    assert.deepEqual(await other.list(), []);

    for (const group of demoGroups) {
      assert.equal((await owner.getById(group.id))?.id, group.id);
      assert.ok((await owner.getExpensesById(group.id)).length > 0);
      assert.equal(await other.getById(group.id), null);
      assert.deepEqual(await other.getExpensesById(group.id), []);
    }
  } finally {
    await prisma?.$disconnect();
    await server.stop();
    await db.close();
  }
});
