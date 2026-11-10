import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client";
import { createCategoryAccess } from "../../app/(dashboard)/expense-groups/_lib/category.access";

test("category writes use the current owner and reject unauthorized or invalid writes", async (t) => {
  // Isolated PostgreSQL only; these tests never read DATABASE_URL.
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
    const aliceGroup = await client.expenseGroup.create({
      data: { name: "Alice private group", userId: "alice" },
    });
    const bobGroup = await client.expenseGroup.create({
      data: { name: "Bob private group", userId: "bob" },
    });
    const unclaimedGroup = await client.expenseGroup.create({
      data: { name: "Preserved demo group" },
    });

    const alice = createCategoryAccess(client, async () => "alice");
    const bob = createCategoryAccess(client, async () => "bob");
    const anonymous = createCategoryAccess(client, async () => {
      throw new Error("Sign in required");
    });

    await t.test("owners can create trimmed category names inside their own groups", async () => {
      const food = await alice.create(aliceGroup.id, "  Food  ");
      const transport = await bob.create(bobGroup.id, "Transport");

      assert.equal(food.name, "Food");
      assert.equal(food.expenseGroupId, aliceGroup.id);
      assert.equal(transport.expenseGroupId, bobGroup.id);
      assert.equal(food.icon, null);
      assert.equal(food.color, null);
      assert.equal(await client.category.count(), 2);
    });

    await t.test("foreign, unclaimed, and missing groups all reject without adding categories", async () => {
      const before = await client.category.count();

      for (const deniedId of [bobGroup.id, unclaimedGroup.id, 2_147_483_647]) {
        await assert.rejects(
          alice.create(deniedId, "Injected category"),
          /^TypeError: Expense group not found$/,
        );
      }
      await assert.rejects(
        bob.create(aliceGroup.id, "Injected category"),
        /^TypeError: Expense group not found$/,
      );

      assert.equal(await client.category.count(), before);
      assert.equal(
        await client.category.count({
          where: { expenseGroupId: unclaimedGroup.id },
        }),
        0,
      );
    });

    await t.test("authentication runs before group and name validation", async () => {
      for (const [id, name] of [
        [aliceGroup.id, "Food"],
        [bobGroup.id, "Injected"],
        [Number.NaN, null],
        [2_147_483_648, ""],
      ] as const) {
        await assert.rejects(
          anonymous.create(id, name),
          /^Error: Sign in required$/,
        );
      }

      assert.equal(await client.category.count(), 2);
    });

    await t.test("blank, non-text, and overlong names cannot create categories", async () => {
      for (const name of [
        null,
        "",
        "  ",
        "x".repeat(101),
        { userId: "bob" },
      ]) {
        await assert.rejects(alice.create(aliceGroup.id, name), TypeError);
      }

      const maximumName = "x".repeat(100);
      const category = await alice.create(aliceGroup.id, maximumName);
      assert.equal(category.name, maximumName);
      assert.equal(await client.category.count(), 3);
    });

    await t.test("invalid and oversized group IDs cannot reach a database write", async () => {
      for (const id of [
        0,
        -1,
        1.5,
        Number.NaN,
        Infinity,
        2_147_483_648,
        Number.MAX_SAFE_INTEGER,
      ]) {
        await assert.rejects(
          alice.create(id, "Food"),
          /^TypeError: Expense group not found$/,
        );
      }

      assert.equal(await client.category.count(), 3);
    });

    await t.test("each create resolves its current identity instead of retaining a previous owner", async () => {
      let currentUser = "alice";
      const access = createCategoryAccess(client, async () => currentUser);
      await access.create(aliceGroup.id, "Bills");

      currentUser = "bob";
      await assert.rejects(
        access.create(aliceGroup.id, "Hidden"),
        /Expense group not found/,
      );
      const groceries = await access.create(bobGroup.id, "Groceries");

      assert.equal(groceries.expenseGroupId, bobGroup.id);
      assert.equal(await client.category.count(), 5);
    });

    await t.test("rename and delete are scoped to the category, group and current owner", async () => {
      const own = await alice.create(aliceGroup.id, "Own");
      const foreign = await bob.create(bobGroup.id, "Foreign");
      const unclaimed = await client.category.create({
        data: { expenseGroupId: unclaimedGroup.id, name: "Unclaimed" },
      });
      const otherGroup = await client.expenseGroup.create({
        data: { name: "Alice other group", userId: "alice" },
      });
      const before = await client.category.findMany({ orderBy: { id: "asc" } });
      const notFound = /^TypeError: Category not found in this expense group$/;

      for (const [groupId, categoryId] of [
        [bobGroup.id, foreign.id],
        [unclaimedGroup.id, unclaimed.id],
        [otherGroup.id, own.id],
        [aliceGroup.id, 2_147_483_647],
        [aliceGroup.id, 2_147_483_648],
        [NaN, own.id],
      ]) {
        await assert.rejects(alice.update(groupId, categoryId, "Changed"), notFound);
        await assert.rejects(alice.delete(groupId, categoryId), notFound);
      }
      await assert.rejects(anonymous.update(NaN, NaN, ""), /Sign in required/);
      await assert.rejects(anonymous.delete(NaN, NaN), /Sign in required/);
      for (const name of [null, " ", "x".repeat(101)]) {
        await assert.rejects(alice.update(aliceGroup.id, own.id, name), TypeError);
      }
      assert.deepEqual(await client.category.findMany({ orderBy: { id: "asc" } }), before);
    });

    await t.test("renaming retains linked expenses and only empty categories can be deleted", async () => {
      const category = await client.category.create({
        data: {
          expenseGroupId: aliceGroup.id,
          name: "Food",
          icon: "🍎",
          color: "#ff0000",
        },
      });
      const expense = await client.expense.create({
        data: {
          expenseGroupId: aliceGroup.id,
          categoryId: category.id,
          title: "Lunch",
          amountCentavos: 12345,
          date: new Date("2026-10-27T00:00:00.000Z"),
        },
      });

      await alice.update(aliceGroup.id, category.id, "  Meals  ");
      assert.deepEqual(await client.category.findUnique({ where: { id: category.id } }), {
        ...category,
        name: "Meals",
      });
      await assert.rejects(
        alice.delete(aliceGroup.id, category.id),
        /^TypeError: Move or delete this category's expenses first\.$/,
      );
      assert.deepEqual(await client.expense.findUnique({ where: { id: expense.id } }), expense);

      const replacement = await alice.create(aliceGroup.id, "Dining");
      const movedExpense = await client.expense.update({
        where: { id: expense.id },
        data: { categoryId: replacement.id },
      });
      await alice.delete(aliceGroup.id, category.id);
      assert.equal(await client.category.findUnique({ where: { id: category.id } }), null);
      assert.deepEqual(await client.expense.findUnique({ where: { id: expense.id } }), movedExpense);
      await assert.rejects(alice.delete(aliceGroup.id, category.id), /Category not found/);
    });
  } finally {
    await prisma?.$disconnect();
    await server.stop();
    await db.close();
  }
});
