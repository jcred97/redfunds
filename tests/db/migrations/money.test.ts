import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const migrations = [
  "20260403185517_init",
  "20260403190150_add_notes_icon_color",
  "20260404153233_add_spending_bank_transaction_type",
];
const moneyMigration = "20261022130000_exact_money_centavos";

function readMigration(name: string) {
  return readFile(path.join(process.cwd(), "server/db/migrations", name, "migration.sql"), "utf8");
}

async function createLegacyDatabase() {
  // No connection URL: PGlite runs PostgreSQL entirely in memory.
  const db = new PGlite();
  for (const name of migrations) {
    await db.exec(await readMigration(name));
  }
  await db.exec(`
    INSERT INTO "Spending" (id, name, "updatedAt") VALUES (7, 'Existing spending', NOW());
    INSERT INTO "Category" (id, name, "spendingId") VALUES (11, 'Existing category', 7);
  `);
  return db;
}

async function addExpense(db: PGlite, id: number, amount: string) {
  await db.query(`
    INSERT INTO "Expense" (id, title, amount, date, "categoryId", "updatedAt", notes, bank, "transactionType")
    VALUES ($1, 'Existing expense', $2::double precision, '2026-10-22', 11, NOW(), 'Keep notes', 'BPI', 'CASH')
  `, [id, amount]);
}

test("actual migration preserves legacy rows and relationships with exact centavos", async () => {
  const db = await createLegacyDatabase();
  try {
    const amounts = ["0.1", "0.2", "1.005", "21474836.47", "0.005"];
    for (const [index, amount] of amounts.entries()) {
      await addExpense(db, index + 1, amount);
    }
    const before = await db.query(`SELECT id, title, date, "categoryId", "createdAt", "updatedAt", notes, bank, "transactionType" FROM "Expense" ORDER BY id`);

    await db.exec(await readMigration(moneyMigration));

    const after = await db.query(`SELECT id, title, date, "categoryId", "createdAt", "updatedAt", notes, bank, "transactionType" FROM "Expense" ORDER BY id`);
    assert.deepEqual(after.rows, before.rows);
    const converted = await db.query<{ amountCentavos: number }>(`SELECT "amountCentavos" FROM "Expense" ORDER BY id`);
    assert.deepEqual(converted.rows.map((row) => row.amountCentavos), [10, 20, 101, 2147483647, 1]);
    const sum = await db.query<{ total: number }>(`SELECT SUM("amountCentavos")::integer AS total FROM "Expense" WHERE id IN (1, 2)`);
    assert.equal(sum.rows[0].total, 30);
    const columns = await db.query<{ column_name: string }>(`SELECT column_name FROM information_schema.columns WHERE table_name = 'Expense'`);
    assert.equal(columns.rows.some((column) => column.column_name === "amount"), false);
    assert.equal(columns.rows.some((column) => column.column_name === "amountCentavos"), true);
    await assert.rejects(db.exec(`UPDATE "Expense" SET "amountCentavos" = 0 WHERE id = 1`), /Expense_amountCentavos_positive/);
    await assert.rejects(db.exec(`UPDATE "Expense" SET "amountCentavos" = -1 WHERE id = 1`), /Expense_amountCentavos_positive/);
    await assert.rejects(db.exec(`DELETE FROM "Category" WHERE id = 11`), /Expense_categoryId_fkey/);
    await assert.rejects(db.exec(`DELETE FROM "Spending" WHERE id = 7`), /Category_spendingId_fkey/);
  } finally {
    await db.close();
  }
});

test("invalid legacy amounts abort migration and rollback leaves all legacy data intact", async (context) => {
  const db = await createLegacyDatabase();
  try {
    const sql = await readMigration(moneyMigration);
    for (const amount of ["21474836.48", "-1", "NaN", "Infinity", "-Infinity", "0", "0.004"]) {
      await context.test(`rejects ${amount}`, async () => {
        await db.exec(`TRUNCATE "Expense"`);
        await addExpense(db, 1, "12.34");
        await addExpense(db, 2, amount);
        const before = await db.query(`SELECT id, amount::text, title, "categoryId" FROM "Expense" ORDER BY id`);
        await assert.rejects(db.exec(sql), /cannot be converted safely/);
        // The SQL intentionally opens a transaction. An error requires rollback.
        await db.exec("ROLLBACK");
        const after = await db.query(`SELECT id, amount::text, title, "categoryId" FROM "Expense" ORDER BY id`);
        assert.deepEqual(after.rows, before.rows);
        const columns = await db.query<{ column_name: string }>(`SELECT column_name FROM information_schema.columns WHERE table_name = 'Expense'`);
        assert.equal(columns.rows.some((column) => column.column_name === "amountCentavos"), false);
        assert.equal(columns.rows.some((column) => column.column_name === "amount"), true);
      });
    }
  } finally {
    await db.close();
  }
});
