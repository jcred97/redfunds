import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const migrations = [
  "20260403185517_init",
  "20260403190150_add_notes_icon_color",
  "20260404153233_add_spending_bank_transaction_type",
  "20261022130000_exact_money_centavos",
];
const coreMigration = "20261022150000_core_expense_group_model";

function readMigration(name: string) {
  return readFile(path.join(process.cwd(), "server/db/migrations", name, "migration.sql"), "utf8");
}

async function legacyDatabase() {
  // Entirely in memory: these tests never use local or production connection URLs.
  const db = new PGlite();
  for (const name of migrations) await db.exec(await readMigration(name));
  await db.exec(`
    INSERT INTO "Spending" (id, name, "createdAt", "updatedAt") VALUES
      (7, 'Personal', '2026-01-01', '2026-10-22'), (8, 'Family', '2026-02-01', '2026-10-21');
    INSERT INTO "Category" (id, name, icon, color, "spendingId", "createdAt") VALUES
      (11, 'Food', '🍔', '#ef4444', 7, '2026-02-02'), (12, 'Bills', NULL, NULL, 8, '2026-03-03');
    INSERT INTO "Expense" (id, title, "amountCentavos", date, "categoryId", "createdAt", "updatedAt", notes, bank, "transactionType") VALUES
      (21, 'Lunch', 12345, '2026-10-21 16:30:00', 11, '2026-10-21', '2026-10-22', 'Keep this note', '  BPI legacy text  ', 'DEBIT_CARD'),
      (22, 'Cash bill', 20, '2026-10-22', 12, '2026-10-22', '2026-10-22', NULL, NULL, 'CASH');
  `);
  return db;
}

async function migratedDatabase() {
  const db = await legacyDatabase();
  await db.exec(await readMigration(coreMigration));
  return db;
}

async function addBanksAndAssignments(db: PGlite) {
  await db.exec(`
    INSERT INTO "Bank" (id, name, key, "updatedAt") VALUES (31, 'BPI', 'bpi', NOW()), (32, 'BDO', 'bdo', NOW());
    INSERT INTO "ExpenseGroupBank" (id, "expenseGroupId", "bankId", "updatedAt") VALUES
      (41, 7, 31, NOW()), (42, 8, 31, NOW()), (43, 7, 32, NOW());
  `);
}

test("core migration preserves legacy records and physical names without guessing bank assignments", async () => {
  const db = await legacyDatabase();
  try {
    const beforeGroups = await db.query(`SELECT * FROM "Spending" ORDER BY id`);
    const beforeCategories = await db.query(`SELECT * FROM "Category" ORDER BY id`);
    const beforeExpenses = await db.query(`SELECT * FROM "Expense" ORDER BY id`);
    await db.exec(await readMigration(coreMigration));
    assert.deepEqual((await db.query(`SELECT * FROM "Spending" ORDER BY id`)).rows, beforeGroups.rows);
    assert.deepEqual((await db.query(`SELECT * FROM "Category" ORDER BY id`)).rows, beforeCategories.rows);
    const afterExpenses = await db.query<Record<string, unknown>>(`SELECT * FROM "Expense" ORDER BY id`);
    assert.deepEqual(afterExpenses.rows.map(({ expenseGroupId, bankAssignmentId, ...oldFields }) => {
      assert.equal(bankAssignmentId, null);
      assert.equal(expenseGroupId, oldFields.categoryId === 11 ? 7 : 8);
      return oldFields;
    }), beforeExpenses.rows);
    for (const table of ["Bank", "ExpenseGroupBank", "Budget"]) {
      assert.deepEqual((await db.query(`SELECT * FROM "${table}"`)).rows, []);
    }
    assert.deepEqual((await db.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ExpenseGroup'`)).rows, []);
    await assert.rejects(db.exec(`UPDATE "Expense" SET "amountCentavos" = 0 WHERE id = 21`), /Expense_amountCentavos_positive/);
  } finally {
    await db.close();
  }
});

test("monthly budgets enforce positive centavos, first-day months, unique group/month, and valid parents", async () => {
  const db = await migratedDatabase();
  try {
    await db.exec(`INSERT INTO "Budget" ("expenseGroupId", "budgetMonth", "amountCentavos", "updatedAt") VALUES (7, '2026-10-01', 100000, NOW()), (8, '2026-10-01', 200000, NOW()), (7, '2026-11-01', 1, NOW())`);
    await assert.rejects(db.exec(`INSERT INTO "Budget" ("expenseGroupId", "budgetMonth", "amountCentavos", "updatedAt") VALUES (7, '2026-10-01', 10, NOW())`), /Budget_expenseGroupId_budgetMonth_key/);
    for (const amount of [0, -1]) {
      await assert.rejects(db.exec(`INSERT INTO "Budget" ("expenseGroupId", "budgetMonth", "amountCentavos", "updatedAt") VALUES (7, '2026-12-01', ${amount}, NOW())`), /Budget_amountCentavos_positive/);
    }
    await assert.rejects(db.exec(`UPDATE "Budget" SET "budgetMonth" = '2026-10-02' WHERE "expenseGroupId" = 8`), /Budget_month_first_day/);
    await assert.rejects(db.exec(`INSERT INTO "Budget" ("expenseGroupId", "budgetMonth", "amountCentavos", "updatedAt") VALUES (999, '2026-12-01', 10, NOW())`), /Budget_expenseGroupId_fkey/);
    await db.exec(`DELETE FROM "Budget" WHERE "expenseGroupId" = 7`);
    assert.equal((await db.query(`SELECT * FROM "Expense"`)).rows.length, 2);
  } finally {
    await db.close();
  }
});

test("bank catalog and assignments enforce identity, defaults, uniqueness, and deletion restrictions", async () => {
  const db = await migratedDatabase();
  try {
    await addBanksAndAssignments(db);
    await db.exec(`INSERT INTO "Bank" (name, key, "updatedAt") VALUES ('  Example   Bank  ', 'example bank', NOW())`);
    await db.query(`INSERT INTO "Bank" (name, key, "updatedAt") VALUES ($1, $2, NOW())`, ["\t\n Another\t Bank \n\t", "another bank"]);
    await assert.rejects(db.exec(`INSERT INTO "Bank" (name, key, "updatedAt") VALUES ('bpi', 'bpi', NOW())`), /Bank_key_key/);
    await assert.rejects(db.exec(`INSERT INTO "Bank" (name, key, "updatedAt") VALUES ('Other Bank', 'OTHER BANK', NOW())`), /Bank_normalized_key/);
    await assert.rejects(db.exec(`INSERT INTO "Bank" (name, key, "updatedAt") VALUES ('   ', '', NOW())`), /Bank_normalized_key/);
    for (const blankName of ["\t", "\n", "\t\n \t"]) {
      await assert.rejects(db.query(`INSERT INTO "Bank" (name, key, "updatedAt") VALUES ($1, '', NOW())`, [blankName]), /Bank_normalized_key/);
    }
    const defaults = await db.query(`SELECT active, "supportedDebitCard", "supportedCreditCard", "supportedBankTransfer", "supportedBankPayment" FROM "ExpenseGroupBank" WHERE id = 41`);
    assert.deepEqual(defaults.rows, [{ active: true, supportedDebitCard: true, supportedCreditCard: true, supportedBankTransfer: true, supportedBankPayment: true }]);
    await assert.rejects(db.exec(`INSERT INTO "ExpenseGroupBank" ("expenseGroupId", "bankId", "updatedAt") VALUES (7, 31, NOW())`), /ExpenseGroupBank_expenseGroupId_bankId_key/);
    await assert.rejects(db.exec(`INSERT INTO "ExpenseGroupBank" ("expenseGroupId", "bankId", "updatedAt") VALUES (999, 31, NOW())`), /ExpenseGroupBank_expenseGroupId_fkey/);
    await assert.rejects(db.exec(`INSERT INTO "ExpenseGroupBank" ("expenseGroupId", "bankId", "updatedAt") VALUES (7, 999, NOW())`), /ExpenseGroupBank_bankId_fkey/);
    await assert.rejects(db.exec(`DELETE FROM "Bank" WHERE id = 31`), /ExpenseGroupBank_bankId_fkey/);
    await db.exec(`INSERT INTO "Spending" (id, name, "updatedAt") VALUES (9, 'Bank-only group', NOW()); INSERT INTO "ExpenseGroupBank" ("expenseGroupId", "bankId", "updatedAt") VALUES (9, 31, NOW())`);
    await assert.rejects(db.exec(`DELETE FROM "Spending" WHERE id = 9`), /ExpenseGroupBank_expenseGroupId_fkey/);
  } finally {
    await db.close();
  }
});

test("composite relationships prevent cross-group payments and preserve historical assignments", async () => {
  const db = await migratedDatabase();
  try {
    await addBanksAndAssignments(db);
    await assert.rejects(db.exec(`UPDATE "Expense" SET "bankAssignmentId" = 42 WHERE id = 21`), /Expense_bankAssignmentId_expenseGroupId_fkey/);
    await assert.rejects(db.exec(`UPDATE "Expense" SET "expenseGroupId" = 8 WHERE id = 21`), /Expense_categoryId_expenseGroupId_fkey/);
    await assert.rejects(db.exec(`INSERT INTO "Expense" (title, "amountCentavos", date, "categoryId", "expenseGroupId", "bankAssignmentId", "updatedAt") VALUES ('Invalid payment', 100, NOW(), 11, 7, 42, NOW())`), /Expense_bankAssignmentId_expenseGroupId_fkey/);
    await db.exec(`UPDATE "Expense" SET "bankAssignmentId" = 41 WHERE id = 21`);
    await assert.rejects(db.exec(`DELETE FROM "ExpenseGroupBank" WHERE id = 41`), /Expense_bankAssignmentId_expenseGroupId_fkey/);
    await assert.rejects(db.exec(`DELETE FROM "Category" WHERE id = 11`), /Expense_categoryId_expenseGroupId_fkey/);
    await assert.rejects(db.exec(`UPDATE "Category" SET "spendingId" = 8 WHERE id = 11`), /Expense_bankAssignmentId_expenseGroupId_fkey/);
    await assert.rejects(db.exec(`UPDATE "ExpenseGroupBank" SET "expenseGroupId" = 8, "bankId" = 32 WHERE id = 41`), /Expense_categoryId_expenseGroupId_fkey/);
    await db.exec(`UPDATE "Bank" SET active = false WHERE id = 31; UPDATE "ExpenseGroupBank" SET active = false, "supportedDebitCard" = false WHERE id = 41`);
    const historical = await db.query(`SELECT e.id, e.bank, e."transactionType", b.name FROM "Expense" e JOIN "ExpenseGroupBank" a ON a.id = e."bankAssignmentId" JOIN "Bank" b ON b.id = a."bankId" WHERE e.id = 21`);
    assert.deepEqual(historical.rows, [{ id: 21, bank: "  BPI legacy text  ", transactionType: "DEBIT_CARD", name: "BPI" }]);
  } finally {
    await db.close();
  }
});
