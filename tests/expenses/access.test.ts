import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client";
import { createExpenseAccess } from "../../app/(dashboard)/_lib/expenses/access";
import { sumCentavos } from "../../app/lib/expenses/money";

test("expense writes validate money, dates, category membership, and current ownership", async (t) => {
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
      const expense = await alice.create(aliceGroup.id, aliceCategory.id, validInput, randomUUID());

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
          alice.create(groupId, categoryId, validInput, randomUUID()),
          /^TypeError: Category not found in this expense group$/,
        );
      }
      await assert.rejects(
        bob.create(aliceGroup.id, aliceCategory.id, validInput, randomUUID()),
        /^TypeError: Category not found in this expense group$/,
      );

      assert.equal(await client.expense.count(), before);
    });

    await t.test("authentication precedes every input validation", async () => {
      await assert.rejects(
        anonymous.create(aliceGroup.id, aliceCategory.id, validInput, randomUUID()),
        /^Error: Sign in required$/,
      );
      await assert.rejects(
        anonymous.create(Number.NaN, 2_147_483_648, {
          title: null,
          amount: null,
          date: null,
        }, null),
        /^Error: Sign in required$/,
      );
      assert.equal(await client.expense.count(), 1);
    });

    await t.test("invalid titles, money, dates, and IDs do not save anything", async () => {
      const before = await client.expense.count();

      for (const title of [null, "", "  ", "x".repeat(101), { userId: "bob" }]) {
        await assert.rejects(
          alice.create(aliceGroup.id, aliceCategory.id, { ...validInput, title }, randomUUID()),
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
          alice.create(aliceGroup.id, aliceCategory.id, { ...validInput, amount }, randomUUID()),
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
          alice.create(aliceGroup.id, aliceCategory.id, { ...validInput, date }, randomUUID()),
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
        await assert.rejects(alice.create(id, aliceCategory.id, validInput, randomUUID()), TypeError);
        await assert.rejects(alice.create(aliceGroup.id, id, validInput, randomUUID()), TypeError);
      }

      for (const submissionId of [null, "invalid", randomUUID() + "\n"]) {
        await assert.rejects(
          alice.create(aliceGroup.id, aliceCategory.id, validInput, submissionId),
          /Unable to identify this draft/,
        );
      }

      assert.equal(await client.expense.count(), before);
    });

    await t.test("decimal fractions, leap days, maximum titles and amounts stay exact", async () => {
      const first = await alice.create(aliceGroup.id, aliceCategory.id, {
        title: "Ten centavos",
        amount: "0.10",
        date: "2024-02-29",
      }, randomUUID());
      const second = await alice.create(aliceGroup.id, aliceCategory.id, {
        title: "Twenty centavos",
        amount: "0.20",
        date: "2024-02-29",
      }, randomUUID());
      const maximum = await alice.create(aliceGroup.id, aliceCategory.id, {
        title: "x".repeat(100),
        amount: "21474836.47",
        date: "2026-12-31",
      }, randomUUID());

      assert.equal(sumCentavos([first.amountCentavos, second.amountCentavos]), 30);
      assert.equal(first.date.toISOString(), "2024-02-29T00:00:00.000Z");
      assert.equal(maximum.title.length, 100);
      assert.equal(maximum.amountCentavos, 2_147_483_647);
    });

    await t.test("each write resolves the current identity rather than retaining an earlier owner", async () => {
      let currentUser = "alice";
      const access = createExpenseAccess(client, async () => currentUser);
      await access.create(aliceGroup.id, aliceCategory.id, validInput, randomUUID());

      currentUser = "bob";
      await assert.rejects(
        access.create(aliceGroup.id, aliceCategory.id, validInput, randomUUID()),
        /Category not found in this expense group/,
      );
      const bobExpense = await access.create(bobGroup.id, bobCategory.id, validInput, randomUUID());
      assert.equal(bobExpense.expenseGroupId, bobGroup.id);
    });

    await t.test("retrying the same submission returns the original expense and adds to totals once", async () => {
      const submissionId = randomUUID();
      const input = { ...validInput, title: "Retry lunch" };
      const save = () => alice.create(aliceGroup.id, aliceCategory.id, input, submissionId);

      const [original, overlappingRetry] = await Promise.all([save(), save()]);
      const laterRetry = await save();
      assert.equal(overlappingRetry.id, original.id);
      assert.equal(laterRetry.id, original.id);

      const saved = await client.expense.findMany({
        where: { expenseGroupId: aliceGroup.id, title: input.title },
      });
      assert.equal(saved.length, 1);
      assert.equal(sumCentavos(saved.map((expense) => expense.amountCentavos)), 15075);
      await assert.rejects(
        bob.create(aliceGroup.id, aliceCategory.id, input, submissionId),
        /Category not found in this expense group/,
      );
    });

    await t.test("two intentional submissions with identical details create two expenses", async () => {
      const input = { ...validInput, title: "Two lunches" };
      const first = await alice.create(aliceGroup.id, aliceCategory.id, input, randomUUID());
      const second = await alice.create(aliceGroup.id, aliceCategory.id, input, randomUUID());

      const saved = await client.expense.findMany({
        where: { expenseGroupId: aliceGroup.id, title: input.title },
        orderBy: { id: "asc" },
      });
      assert.notEqual(first.id, second.id);
      assert.deepEqual(saved.map((expense) => expense.id), [first.id, second.id]);
      assert.equal(sumCentavos(saved.map((expense) => expense.amountCentavos)), 30150);
    });

    await t.test("a failed write leaves the submission available for a corrected retry", async () => {
      const submissionId = randomUUID();
      await assert.rejects(
        alice.create(aliceGroup.id, aliceOtherCategory.id, validInput, submissionId),
        /Category not found in this expense group/,
      );
      const expense = await alice.create(aliceGroup.id, aliceCategory.id, validInput, submissionId);
      assert.equal(expense.categoryId, aliceCategory.id);
    });

    await t.test("an already saved draft cannot write different details or recreate a deleted expense", async () => {
      const submissionId = randomUUID();
      const input = { ...validInput, title: "Deleted lunch" };
      const expense = await alice.create(aliceGroup.id, aliceCategory.id, input, submissionId);
      await assert.rejects(
        alice.create(aliceGroup.id, aliceCategory.id, { ...input, amount: "75.00" }, submissionId),
        /already saved with different details/,
      );
      await alice.delete(aliceGroup.id, expense.id);
      await assert.rejects(
        alice.create(aliceGroup.id, aliceCategory.id, input, submissionId),
        /already saved and has since been deleted/,
      );
      assert.equal(await client.expense.count({ where: { title: input.title } }), 0);
    });

    await t.test("editing checks the original expense and its replacement category without losing history", async (editing) => {
      const replacementCategory = await client.category.create({
        data: { name: "Transport", expenseGroupId: aliceGroup.id },
      });
      const bank = await client.bank.create({
        data: { name: "BPI", key: "bpi" },
      });
      const bankAssignment = await client.bankAssignment.create({
        data: { bankId: bank.id, expenseGroupId: aliceGroup.id },
      });
      const original = await client.expense.create({
        data: {
          title: "Original title",
          amountCentavos: 15075,
          date: new Date("2026-10-27T00:00:00.000Z"),
          expenseGroupId: aliceGroup.id,
          categoryId: aliceCategory.id,
          notes: "Keep this historical note",
          paymentMethod: "DEBIT_CARD",
          legacyBankName: "Historical bank text",
          bankAssignmentId: bankAssignment.id,
        },
      });
      const otherExpenses = [];

      for (const [groupId, categoryId] of [
        [aliceOtherGroup.id, aliceOtherCategory.id],
        [bobGroup.id, bobCategory.id],
        [unclaimedGroup.id, unclaimedCategory.id],
      ]) {
        otherExpenses.push(
          await client.expense.create({
            data: {
              title: "Other expense",
              amountCentavos: 100,
              date: new Date("2026-10-27T00:00:00.000Z"),
              expenseGroupId: groupId,
              categoryId,
            },
          }),
        );
      }

      const [aliceOtherExpense, bobExpense, unclaimedExpense] = otherExpenses;
      const notFound = /^TypeError: Expense or category not found in this expense group$/;
      const readAllExpenses = () => client.expense.findMany({ orderBy: { id: "asc" } });
      let currentUpdatedAt = original.updatedAt.toISOString();

      await editing.test("owners can correct editable fields while preserving optional data and identity", async () => {
        const beforeCount = await client.expense.count();
        const changed = await alice.update(
          aliceGroup.id,
          original.id,
          replacementCategory.id,
          { title: "  Corrected title  ", amount: "0.30", date: "2024-02-29" },
          currentUpdatedAt,
        );

        assert.equal(changed.id, original.id);
        assert.equal(changed.title, "Corrected title");
        assert.equal(changed.amountCentavos, 30);
        assert.equal(changed.date.toISOString(), "2024-02-29T00:00:00.000Z");
        assert.equal(changed.categoryId, replacementCategory.id);
        assert.equal(changed.expenseGroupId, original.expenseGroupId);
        assert.equal(changed.notes, original.notes);
        assert.equal(changed.paymentMethod, original.paymentMethod);
        assert.equal(changed.legacyBankName, original.legacyBankName);
        assert.equal(changed.bankAssignmentId, original.bankAssignmentId);
        assert.deepEqual(changed.createdAt, original.createdAt);
        assert.ok(changed.updatedAt.getTime() > original.updatedAt.getTime());
        assert.equal(await client.expense.count(), beforeCount);
        currentUpdatedAt = changed.updatedAt.toISOString();
      });

      await editing.test("stale drafts cannot overwrite a newer save and a refreshed draft can edit it", async () => {
        const expense = await client.expense.create({
          data: {
            title: "Lunch",
            amountCentavos: 15075,
            date: new Date("2026-10-27T00:00:00.000Z"),
            expenseGroupId: aliceGroup.id,
            categoryId: aliceCategory.id,
            updatedAt: new Date(Date.now() + 60_000),
          },
        });
        const originalVersion = expense.updatedAt.toISOString();
        const newer = await alice.update(
          aliceGroup.id,
          expense.id,
          aliceCategory.id,
          { ...validInput, amount: "200.00" },
          originalVersion,
        );
        assert.equal(newer.updatedAt.getTime(), expense.updatedAt.getTime() + 1);

        await assert.rejects(
          alice.update(
            aliceGroup.id,
            expense.id,
            aliceCategory.id,
            { ...validInput, title: "Lunch at work" },
            originalVersion,
          ),
          /This expense changed since you opened it/,
        );
        assert.deepEqual(await client.expense.findUnique({ where: { id: expense.id } }), newer);

        const refreshed = await alice.update(
          aliceGroup.id,
          expense.id,
          aliceCategory.id,
          { ...validInput, title: "Lunch at work", amount: "200.00" },
          newer.updatedAt.toISOString(),
        );
        assert.equal(refreshed.title, "Lunch at work");
        assert.equal(refreshed.amountCentavos, 20000);
      });

      await editing.test("foreign, unclaimed, missing, and wrong-group expenses cannot be edited or moved", async () => {
        const before = await readAllExpenses();

        for (const [groupId, expenseId, categoryId] of [
          [bobGroup.id, bobExpense.id, bobCategory.id],
          [unclaimedGroup.id, unclaimedExpense.id, unclaimedCategory.id],
          [aliceGroup.id, bobExpense.id, aliceCategory.id],
          [aliceGroup.id, unclaimedExpense.id, aliceCategory.id],
          [aliceGroup.id, aliceOtherExpense.id, aliceCategory.id],
          [aliceOtherGroup.id, original.id, aliceOtherCategory.id],
          [aliceGroup.id, 2_147_483_647, aliceCategory.id],
          [2_147_483_647, original.id, aliceCategory.id],
        ]) {
          const expectedUpdatedAt = before.find((expense) => expense.id === expenseId)
            ?.updatedAt.toISOString() ?? currentUpdatedAt;
          await assert.rejects(
            alice.update(groupId, expenseId, categoryId, validInput, expectedUpdatedAt),
            notFound,
          );
        }
        await assert.rejects(
          bob.update(aliceGroup.id, original.id, aliceCategory.id, validInput, currentUpdatedAt),
          notFound,
        );

        assert.deepEqual(await readAllExpenses(), before);
      });

      await editing.test("a rejected replacement category rolls back every proposed field change", async () => {
        const before = await readAllExpenses();

        for (const categoryId of [
          aliceOtherCategory.id,
          bobCategory.id,
          unclaimedCategory.id,
          2_147_483_647,
        ]) {
          await assert.rejects(
            alice.update(aliceGroup.id, original.id, categoryId, validInput, currentUpdatedAt),
            notFound,
          );
        }

        assert.deepEqual(await readAllExpenses(), before);
      });

      await editing.test("anonymous edits still authenticate before validating submitted fields", async () => {
        const before = await readAllExpenses();
        await assert.rejects(
          anonymous.update(aliceGroup.id, original.id, aliceCategory.id, validInput, currentUpdatedAt),
          /^Error: Sign in required$/,
        );
        await assert.rejects(
          anonymous.update(NaN, 2_147_483_648, -1, {
            title: null,
            amount: null,
            date: null,
          }, null),
          /^Error: Sign in required$/,
        );
        assert.deepEqual(await readAllExpenses(), before);
      });

      await editing.test("invalid edits leave the entire saved record unchanged", async () => {
        const before = await readAllExpenses();

        for (const title of [null, "", "  ", "x".repeat(101)]) {
          await assert.rejects(
            alice.update(aliceGroup.id, original.id, aliceCategory.id, {
              ...validInput,
              title,
            }, currentUpdatedAt),
            TypeError,
          );
        }
        for (const amount of [null, "0", "-1", "1.001", "1e3", "21474836.48"]) {
          await assert.rejects(
            alice.update(aliceGroup.id, original.id, aliceCategory.id, {
              ...validInput,
              amount,
            }, currentUpdatedAt),
            TypeError,
          );
        }
        for (const date of [null, "2026-02-29", "2026-04-31", "2026-1-1"]) {
          await assert.rejects(
            alice.update(aliceGroup.id, original.id, aliceCategory.id, {
              ...validInput,
              date,
            }, currentUpdatedAt),
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
          await assert.rejects(
            alice.update(id, original.id, aliceCategory.id, validInput, currentUpdatedAt),
            notFound,
          );
          await assert.rejects(
            alice.update(aliceGroup.id, id, aliceCategory.id, validInput, currentUpdatedAt),
            notFound,
          );
          await assert.rejects(
            alice.update(aliceGroup.id, original.id, id, validInput, currentUpdatedAt),
            notFound,
          );
        }

        for (const version of [null, "", "2026-10-27", "not a timestamp"]) {
          await assert.rejects(
            alice.update(aliceGroup.id, original.id, aliceCategory.id, validInput, version),
            /Unable to identify this edit/,
          );
        }

        assert.deepEqual(await readAllExpenses(), before);
      });

      await editing.test("each edit resolves its current owner rather than retaining an earlier session", async () => {
        let currentUser = "alice";
        const access = createExpenseAccess(client, async () => currentUser);
        const saved = await access.update(
          aliceGroup.id, original.id, aliceCategory.id, validInput, currentUpdatedAt,
        );

        currentUser = "bob";
        const before = await readAllExpenses();
        await assert.rejects(
          access.update(
            aliceGroup.id, original.id, aliceCategory.id, validInput, saved.updatedAt.toISOString(),
          ),
          notFound,
        );
        assert.deepEqual(await readAllExpenses(), before);
        const changed = await access.update(
          bobGroup.id,
          bobExpense.id,
          bobCategory.id,
          validInput,
          bobExpense.updatedAt.toISOString(),
        );
        assert.equal(changed.id, bobExpense.id);
      });
    });
    await t.test("deletion authenticates and atomically checks the expense group owner", async (deleting) => {
      const target = await alice.create(aliceGroup.id, aliceCategory.id, validInput, randomUUID());
      const foreign = await bob.create(bobGroup.id, bobCategory.id, validInput, randomUUID());
      const legacy = await client.expense.create({
        data: {
          title: "Preserved legacy expense",
          amountCentavos: 100,
          date: new Date("2026-10-27T00:00:00.000Z"),
          expenseGroupId: unclaimedGroup.id,
          categoryId: unclaimedCategory.id,
        },
      });
      const notFound = /^TypeError: Expense not found in this expense group$/;
      const readExpenses = () => client.expense.findMany({ orderBy: { id: "asc" } });

      await deleting.test("foreign, unclaimed, missing, wrong-group and invalid IDs leave all data intact", async () => {
        const before = await readExpenses();
        for (const [groupId, expenseId] of [
          [bobGroup.id, foreign.id],
          [unclaimedGroup.id, legacy.id],
          [aliceGroup.id, foreign.id],
          [aliceGroup.id, legacy.id],
          [aliceOtherGroup.id, target.id],
          [aliceGroup.id, 2_147_483_647],
          [2_147_483_647, target.id],
        ]) {
          await assert.rejects(alice.delete(groupId, expenseId), notFound);
        }
        await assert.rejects(bob.delete(aliceGroup.id, target.id), notFound);
        for (const id of [0, -1, 1.5, NaN, Infinity, 2_147_483_648, Number.MAX_SAFE_INTEGER]) {
          await assert.rejects(alice.delete(id, target.id), notFound);
          await assert.rejects(alice.delete(aliceGroup.id, id), notFound);
        }
        await assert.rejects(anonymous.delete(aliceGroup.id, target.id), /^Error: Sign in required$/);
        await assert.rejects(anonymous.delete(NaN, 2_147_483_648), /^Error: Sign in required$/);
        assert.deepEqual(await readExpenses(), before);
      });

      await deleting.test("only the chosen expense is deleted; categories, groups and remaining totals are preserved", async () => {
        const before = await readExpenses();
        const groups = await client.expenseGroup.findMany({ orderBy: { id: "asc" } });
        const categories = await client.category.findMany({ orderBy: { id: "asc" } });
        await alice.delete(aliceGroup.id, target.id);
        const remaining = before.filter((expense) => expense.id !== target.id);
        assert.deepEqual(await readExpenses(), remaining);
        assert.deepEqual(await client.expenseGroup.findMany({ orderBy: { id: "asc" } }), groups);
        assert.deepEqual(await client.category.findMany({ orderBy: { id: "asc" } }), categories);
        const groupExpenses = await client.expense.findMany({ where: { expenseGroupId: aliceGroup.id } });
        assert.equal(
          sumCentavos(groupExpenses.map((expense) => expense.amountCentavos)),
          sumCentavos(before.filter((expense) => expense.expenseGroupId === aliceGroup.id).map((expense) => expense.amountCentavos)) - target.amountCentavos,
        );
        await assert.rejects(alice.delete(aliceGroup.id, target.id), notFound);
        assert.deepEqual(await readExpenses(), remaining);
      });

      await deleting.test("each deletion resolves its current session owner", async () => {
        let currentUser = "alice";
        const access = createExpenseAccess(client, async () => currentUser);
        const owned = await alice.create(aliceGroup.id, aliceCategory.id, validInput, randomUUID());
        await access.delete(aliceGroup.id, owned.id);
        currentUser = "bob";
        const another = await alice.create(aliceGroup.id, aliceCategory.id, validInput, randomUUID());
        await assert.rejects(access.delete(aliceGroup.id, another.id), notFound);
        assert.ok(await client.expense.findUnique({ where: { id: another.id } }));
        await access.delete(bobGroup.id, foreign.id);
        assert.equal(await client.expense.findUnique({ where: { id: foreign.id } }), null);
      });
    });
  } finally {
    await prisma?.$disconnect();
    await server.stop();
    await db.close();
  }
});
