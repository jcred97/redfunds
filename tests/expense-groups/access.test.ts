import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client";
import { createExpenseGroupAccess } from "../../app/(dashboard)/_lib/expense-groups/access";

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

    await t.test("the group switcher only lists the signed-in user's group IDs and names", async () => {
      assert.deepEqual(await alice.listForSwitcher(), [{ id: a.id, name: a.name }]);
      assert.deepEqual(await bob.listForSwitcher(), [{ id: b.id, name: b.name }]);
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
          await assert.rejects(access.rename(other.id, "Foreign rename"), /^Error: Expense group not found$/);
          await assert.rejects(access.duplicate(other.id), /^Error: Expense group not found$/);
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
        () => anonymous.listForSwitcher(),
        () => anonymous.getById(a.id),
        () => anonymous.getExpensesById(a.id),
        () => anonymous.create("Injected"),
        () => anonymous.rename(a.id, "Injected"),
        () => anonymous.duplicate(a.id),
        () => anonymous.delete(a.id),
        () => anonymous.create(null),
        () => anonymous.getById(Number.NaN),
        () => anonymous.getById(2_147_483_648),
        () => anonymous.getExpensesById(2_147_483_648),
        () => anonymous.delete(2_147_483_648),
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

    await t.test("the largest PostgreSQL integer remains a valid, private group ID", async () => {
      const maxId = 2_147_483_647;

      assert.equal(await alice.getById(maxId), null);
      assert.deepEqual(await alice.getExpensesById(maxId), []);
      await assert.rejects(alice.delete(maxId), /^Error: Expense group not found$/);

      await client.expenseGroup.create({
        data: { id: maxId, name: "Maximum valid ID", userId: "alice" },
      });

      assert.equal((await alice.getById(maxId))?.id, maxId);
      assert.equal(await bob.getById(maxId), null);
      await assert.rejects(bob.delete(maxId), /^Error: Expense group not found$/);
      await alice.delete(maxId);
      assert.equal(await client.expenseGroup.count(), 3);
    });

    await t.test("invalid IDs and invalid group names are rejected without accessing other data", async () => {
      for (const id of [
        0,
        -1,
        1.5,
        Number.NaN,
        Infinity,
        2_147_483_648,
        Number.MAX_SAFE_INTEGER,
        Number.MAX_SAFE_INTEGER + 1,
      ]) {
        assert.equal(await alice.getById(id), null);
        assert.deepEqual(await alice.getExpensesById(id), []);
        await assert.rejects(alice.rename(id, "Invalid"), /Expense group not found/);
        await assert.rejects(alice.duplicate(id), /Expense group not found/);
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
        await assert.rejects(alice.rename(a.id, name), TypeError);
      }

      assert.equal(await client.expenseGroup.count(), 3);
    });

    await t.test("renaming updates only the owned group and refreshes the switcher label", async () => {
      await alice.rename(a.id, "  Personal budget  ");
      assert.deepEqual(await alice.listForSwitcher(), [{ id: a.id, name: "Personal budget" }]);
      assert.equal((await bob.getById(b.id))?.name, b.name);
      assert.equal((await alice.getExpensesById(a.id)).length, 1);
    });

    await t.test("groups with dependent records keep their categories and expenses", async () => {
      await assert.rejects(
        alice.delete(a.id),
        /Remove this expense group's categories, budgets, and bank assignments before deleting it/,
      );
      assert.equal((await alice.getById(a.id))?.categories.length, 1);
      assert.equal((await alice.getExpensesById(a.id)).length, 1);
    });

    await t.test("duplicate assigns fresh IDs and preserves exact values, relationships, and settings", async () => {
      const source = await alice.create("Travel");
      const category = await client.category.create({
        data: { expenseGroupId: source.id, name: "Travel", color: "#123abc", icon: "✈️" },
      });
      const sameName = await client.category.create({
        data: { expenseGroupId: source.id, name: "Travel" },
      });
      const bank = await client.bank.create({
        data: { name: "Clone fixture bank", key: "clone fixture bank", active: false },
      });
      const assignment = await client.bankAssignment.create({
        data: {
          expenseGroupId: source.id,
          bankId: bank.id,
          active: false,
          supportedDebitCard: false,
          supportedCreditCard: true,
          supportedBankTransfer: false,
          supportedBankPayment: false,
        },
      });
      const budgetMonth = new Date("2026-11-01T00:00:00Z");
      await client.budget.create({
        data: { expenseGroupId: source.id, budgetMonth, amountCentavos: 500_000, description: "November trip" },
      });

      const date = new Date("2026-11-06T00:00:00Z");
      const ticket = await client.expense.create({
        data: {
          expenseGroupId: source.id,
          categoryId: category.id,
          bankAssignmentId: assignment.id,
          title: "Ticket",
          amountCentavos: 115_042,
          date,
          notes: "Window seat",
          paymentMethod: "CREDIT_CARD",
        },
      });
      await client.expense.create({
        data: {
          expenseGroupId: source.id,
          categoryId: sameName.id,
          title: "Lunch",
          amountCentavos: 25_175,
          date,
          legacyBankName: "Historical bank label",
        },
      });
      await client.expenseSubmission.create({
        data: {
          id: "b4730d36-89ae-4a8f-97d3-60b01dc31101",
          expenseGroupId: source.id,
          expenseId: ticket.id,
          payloadHash: "fixture-hash",
        },
      });

      const { id } = await alice.duplicate(source.id);
      assert.notEqual(id, source.id);
      const copy = await client.expenseGroup.findUniqueOrThrow({
        where: { id },
        include: {
          budgets: true,
          bankAssignments: true,
          categories: { include: { expenses: true } },
          expenseSubmissions: true,
        },
      });
      assert.equal(copy.userId, "alice");
      assert.equal(copy.name, "Travel (copy)");
      assert.equal(await bob.getById(id), null);
      assert.equal(copy.expenseSubmissions.length, 0);
      assert.equal(copy.budgets.length, 1);
      assert.equal(copy.budgets[0].amountCentavos, 500_000);
      assert.equal(copy.budgets[0].description, "November trip");
      assert.deepEqual(copy.budgets[0].budgetMonth, budgetMonth);
      assert.equal(copy.bankAssignments.length, 1);
      const copiedBank = copy.bankAssignments[0];
      assert.notEqual(copiedBank.id, assignment.id);
      assert.equal(copiedBank.bankId, bank.id);
      assert.equal(copiedBank.active, false);
      assert.equal(copiedBank.supportedDebitCard, false);
      assert.equal(copiedBank.supportedCreditCard, true);
      assert.equal(copiedBank.supportedBankTransfer, false);
      assert.equal(copiedBank.supportedBankPayment, false);
      assert.equal(copy.categories.length, 2);
      const copiedCategory = copy.categories.find((row) => row.color === category.color);
      assert.ok(copiedCategory);
      assert.notEqual(copiedCategory.id, category.id);
      assert.equal(copiedCategory.icon, category.icon);
      assert.equal(copiedCategory.name, category.name);
      assert.equal(copiedCategory.expenses.length, 1);
      const copiedTicket = copiedCategory.expenses[0];
      assert.notEqual(copiedTicket.id, ticket.id);
      assert.equal(copiedTicket.expenseGroupId, id);
      assert.equal(copiedTicket.bankAssignmentId, copiedBank.id);
      assert.equal(copiedTicket.title, "Ticket");
      assert.equal(copiedTicket.amountCentavos, 115_042);
      assert.deepEqual(copiedTicket.date, date);
      assert.equal(copiedTicket.notes, "Window seat");
      assert.equal(copiedTicket.paymentMethod, "CREDIT_CARD");
      const otherCategory = copy.categories.find((row) => row.color === null);
      assert.ok(otherCategory);
      assert.equal(otherCategory.name, "Travel");
      assert.equal(otherCategory.expenses.length, 1);
      const copiedLunch = otherCategory.expenses[0];
      assert.equal(copiedLunch.title, "Lunch");
      assert.equal(copiedLunch.amountCentavos, 25_175);
      assert.equal(copiedLunch.bankAssignmentId, null);
      assert.equal(copiedLunch.legacyBankName, "Historical bank label");
      assert.equal((await alice.getById(source.id))?.name, "Travel");
      assert.equal((await alice.getExpensesById(source.id)).length, 2);
    });

    await t.test("duplicating an empty group keeps the copy name within the limit", async () => {
      const prefix = "x".repeat(92);
      const source = await alice.create(prefix + "🚕123456");
      const { id } = await alice.duplicate(source.id);
      assert.equal((await alice.getById(id))?.name, prefix + " (copy)");
      assert.deepEqual(await alice.getExpensesById(id), []);
      await alice.delete(id);
      await alice.delete(source.id);
    });
  } finally {
    await prisma?.$disconnect();
    await server.stop();
    await db.close();
  }
});
