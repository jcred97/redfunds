import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client";
import { createExpenseGroupAccess } from "../../app/(dashboard)/expense-groups/_lib/expense-group.access";

test("expense-group access isolates users and unclaimed data using real Prisma queries", async (t) => {
  // An isolated, in-memory PostgreSQL instance. Never reads DATABASE_URL.
  const db = await PGlite.create();
  const server = new PGLiteSocketServer({ db, host: "127.0.0.1", port: 0 });
  let prisma: PrismaClient | undefined;

  try {
    const directory = path.join(process.cwd(), "server/db/migrations");
    const migrations = (await readdir(directory, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();

    for (const migration of migrations) {
      await db.exec(
        await readFile(path.join(directory, migration, "migration.sql"), "utf8"),
      );
    }

    await server.start();

    prisma = new PrismaClient({
      adapter: new PrismaPg({
        connectionString: `postgresql://postgres:postgres@${server.getServerConn()}/postgres`,
        max: 1,
      }),
    });

    const client = prisma;

    await client.user.createMany({
      data: [
        { id: "alice", name: "Alice", email: "alice@example.test" },
        { id: "bob", name: "Bob", email: "bob@example.test" },
      ],
    });

    const alice = createExpenseGroupAccess(client, async () => "alice");
    const bob = createExpenseGroupAccess(client, async () => "bob");
    const anonymous = createExpenseGroupAccess(client, async () => {
      throw new Error("Sign in required");
    });

    const a = await alice.create("Alice private group");
    const b = await bob.create("Bob private group");
    const legacy = await client.expenseGroup.create({
      data: { name: "Unclaimed demo" },
    });

    for (const group of [a, b, legacy]) {
      const category = await client.category.create({
        data: {
          name: `${group.name} category`,
          expenseGroupId: group.id,
        },
      });

      await client.expense.create({
        data: {
          title: `${group.name} expense`,
          amountCentavos: 12345,
          date: new Date("2026-10-24T00:00:00Z"),
          categoryId: category.id,
          expenseGroupId: group.id,
        },
      });
    }

    await t.test("list includes only the signed-in user's groups and nested totals", async () => {
      assert.deepEqual((await alice.list()).map((group) => group.id), [a.id]);
      assert.deepEqual((await bob.list()).map((group) => group.id), [b.id]);
      assert.equal(
        (await alice.list())[0].categories[0].expenses[0].amountCentavos,
        12345,
      );
      assert.equal((await bob.list())[0].categories[0]._count.expenses, 1);
    });

    await t.test("guessed IDs cannot reveal other users or unclaimed groups and expenses", async () => {
      for (const [access, own, denied] of [
        [alice, a, [b, legacy]],
        [bob, b, [a, legacy]],
      ] as const) {
        assert.equal((await access.getById(own.id))?.id, own.id);
        assert.equal((await access.getExpensesById(own.id)).length, 1);

        for (const other of denied) {
          assert.equal(await access.getById(other.id), null);
          assert.deepEqual(await access.getExpensesById(other.id), []);
          await assert.rejects(
            access.delete(other.id),
            /^Error: Expense group not found$/,
          );
        }
      }

      assert.equal(await client.expenseGroup.count(), 3);
      assert.equal(await client.expense.count(), 3);
    });

    await t.test("anonymous callers cannot read or mutate, including invalid input", async () => {
      const before = await client.expenseGroup.count();

      for (const invoke of [
        () => anonymous.list(),
        () => anonymous.getById(a.id),
        () => anonymous.getExpensesById(a.id),
        () => anonymous.create("Injected"),
        () => anonymous.delete(a.id),
        () => anonymous.create(null),
        () => anonymous.getById(Number.NaN),
      ]) {
        await assert.rejects(invoke(), /Sign in required/);
      }

      assert.equal(await client.expenseGroup.count(), before);
    });

    await t.test("each call resolves its current identity rather than retaining a previous user", async () => {
      let currentUser = "alice";
      const access = createExpenseGroupAccess(client, async () => currentUser);

      assert.deepEqual((await access.list()).map((group) => group.id), [a.id]);

      currentUser = "bob";

      assert.deepEqual((await access.list()).map((group) => group.id), [b.id]);
      assert.equal(await access.getById(a.id), null);
    });

    await t.test("new groups use the server identity and own empty groups can be deleted", async () => {
      const created = await alice.create("  New private group  ");

      assert.equal(created.userId, "alice");
      assert.equal(created.name, "New private group");
      await assert.rejects(bob.delete(created.id), /Expense group not found/);
      await alice.delete(created.id);
      assert.equal(
        await client.expenseGroup.findUnique({ where: { id: created.id } }),
        null,
      );
    });

    await t.test("invalid IDs and invalid group names are rejected without accessing other data", async () => {
      for (const id of [
        0,
        -1,
        1.5,
        Number.NaN,
        Infinity,
        Number.MAX_SAFE_INTEGER + 1,
      ]) {
        assert.equal(await alice.getById(id), null);
        assert.deepEqual(await alice.getExpensesById(id), []);
        await assert.rejects(alice.delete(id), /Expense group not found/);
      }

      for (const name of [
        null,
        "",
        "  ",
        "x".repeat(101),
        { name: "Fake", userId: "bob" },
      ]) {
        await assert.rejects(alice.create(name), TypeError);
      }

      assert.equal(await client.expenseGroup.count(), 3);
    });
  } finally {
    await prisma?.$disconnect();
    await server.stop();
    await db.close();
  }
});
