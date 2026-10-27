import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client";
import { createExpenseAccess } from "../../app/(dashboard)/expense-groups/_lib/expense.access";
import { sumCentavos } from "../../app/lib/money";

test("expense creation validates money, dates, category membership, and current ownership", async (t) => {
  // Temporary PostgreSQL fixtures only. Never reads DATABASE_URL or live data.
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
    const aliceOtherGroup = await client.expenseGroup.create({
      data: { name: "Alice other group", userId: "alice" },
    });
    const bobGroup = await client.expenseGroup.create({
      data: { name: "Bob private group", userId: "bob" },
    });
    const unclaimedGroup = await client.expenseGroup.create({
      data: { name: "Preserved demo group" },
    });
    const categories = [];

    for (const group of [aliceGroup, aliceOtherGroup, bobGroup, unclaimedGroup]) {
      categories.push(
        await client.category.create({
          data: { name: "Food", expenseGroupId: group.id },
        }),
      );
    }

    const [aliceCategory, aliceOtherCategory, bobCategory, unclaimedCategory] = categories;
    const alice = createExpenseAccess(client, async () => "alice");
    const bob = createExpenseAccess(client, async () => "bob");
    const anonymous = createExpenseAccess(client, async () => {
      throw new Error("Sign in required");
    });
    const validInput = { title: "  Lunch  ", amount: "150.75", date: "2026-10-27" };

    await t.test("owners can save exact centavos and calendar dates in their own category", async () => {
      const expense = await alice.create(aliceGroup.id, aliceCategory.id, validInput);

      assert.equal(expense.title, "Lunch");
      assert.equal(expense.amountCentavos, 15075);
      assert.equal(expense.date.toISOString(), "2026-10-27T00:00:00.000Z");
      assert.equal(expense.expenseGroupId, aliceGroup.id);
      assert.equal(expense.categoryId, aliceCategory.id);
      assert.equal(expense.bankAssignmentId, null);
      assert.equal(expense.paymentMethod, null);
      assert.equal(await client.expense.count(), 1);
    });

    await t.test("foreign, mismatched, unclaimed, and missing categories cannot receive expenses", async () => {
      const before = await client.expense.count();

      for (const [groupId, categoryId] of [
        [bobGroup.id, bobCategory.id],
        [unclaimedGroup.id, unclaimedCategory.id],
        [aliceGroup.id, bobCategory.id],
        [aliceGroup.id, aliceOtherCategory.id],
        [aliceOtherGroup.id, aliceCategory.id],
        [aliceGroup.id, 2_147_483_647],
        [2_147_483_647, aliceCategory.id],
      ]) {
        await assert.rejects(
          alice.create(groupId, categoryId, validInput),
          /^TypeError: Category not found in this expense group$/,
        );
      }
      await assert.rejects(
        bob.create(aliceGroup.id, aliceCategory.id, validInput),
        /^TypeError: Category not found in this expense group$/,
      );

      assert.equal(await client.expense.count(), before);
    });

    await t.test("authentication precedes every input validation", async () => {
      await assert.rejects(
        anonymous.create(aliceGroup.id, aliceCategory.id, validInput),
        /^Error: Sign in required$/,
      );
      await assert.rejects(
        anonymous.create(Number.NaN, 2_147_483_648, {
          title: null,
          amount: null,
          date: null,
        }),
        /^Error: Sign in required$/,
      );
      assert.equal(await client.expense.count(), 1);
    });

    await t.test("invalid titles, money, dates, and oversized IDs do not save anything", async () => {
      const before = await client.expense.count();

      for (const title of [null, "", "  ", "x".repeat(101), { userId: "bob" }]) {
        await assert.rejects(
          alice.create(aliceGroup.id, aliceCategory.id, { ...validInput, title }),
          TypeError,
        );
      }

      for (const amount of [
        null,
        1.5,
        "",
        "0",
        "-1",
        "1.001",
        "1e3",
        "1,000",
        "NaN",
        "21474836.48",
      ]) {
        await assert.rejects(
          alice.create(aliceGroup.id, aliceCategory.id, { ...validInput, amount }),
          TypeError,
        );
      }

      for (const date of [
        null,
        "",
        "2026-02-29",
        "2026-04-31",
        "2026-1-1",
        "2026-10-27T00:00:00Z",
      ]) {
        await assert.rejects(
          alice.create(aliceGroup.id, aliceCategory.id, { ...validInput, date }),
          TypeError,
        );
      }

      for (const id of [
        0,
        -1,
        1.5,
        NaN,
        Infinity,
        2_147_483_648,
        Number.MAX_SAFE_INTEGER,
      ]) {
        await assert.rejects(alice.create(id, aliceCategory.id, validInput), TypeError);
        await assert.rejects(alice.create(aliceGroup.id, id, validInput), TypeError);
      }

      assert.equal(await client.expense.count(), before);
    });

    await t.test("decimal fractions, leap days, maximum titles and amounts stay exact", async () => {
      const first = await alice.create(aliceGroup.id, aliceCategory.id, {
        title: "Ten centavos",
        amount: "0.10",
        date: "2024-02-29",
      });
      const second = await alice.create(aliceGroup.id, aliceCategory.id, {
        title: "Twenty centavos",
        amount: "0.20",
        date: "2024-02-29",
      });
      const maximum = await alice.create(aliceGroup.id, aliceCategory.id, {
        title: "x".repeat(100),
        amount: "21474836.47",
        date: "2026-12-31",
      });

      assert.equal(sumCentavos([first.amountCentavos, second.amountCentavos]), 30);
      assert.equal(first.date.toISOString(), "2024-02-29T00:00:00.000Z");
      assert.equal(maximum.title.length, 100);
      assert.equal(maximum.amountCentavos, 2_147_483_647);
    });

    await t.test("each write resolves the current identity rather than retaining an earlier owner", async () => {
      let currentUser = "alice";
      const access = createExpenseAccess(client, async () => currentUser);
      await access.create(aliceGroup.id, aliceCategory.id, validInput);

      currentUser = "bob";
      await assert.rejects(
        access.create(aliceGroup.id, aliceCategory.id, validInput),
        /Category not found in this expense group/,
      );
      const bobExpense = await access.create(bobGroup.id, bobCategory.id, validInput);
      assert.equal(bobExpense.expenseGroupId, bobGroup.id);
    });
  } finally {
    await prisma?.$disconnect();
    await server.stop();
    await db.close();
  }
});
