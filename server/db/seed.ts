import * as dotenv from "dotenv";
dotenv.config();

import { PrismaClient } from "../../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { assertDevelopmentDatabaseResetAllowed } from "./seed-guard";

// Refuse before constructing a client or executing any database operation.
assertDevelopmentDatabaseResetAllowed(process.env);

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Resetting development database and creating demo data...");

  // Clean existing data and reset auto-increment sequences
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE "Expense", "Category", "Spending" RESTART IDENTITY CASCADE`);

  // Create spendings
  const jcPersonal = await prisma.spending.create({
    data: { name: "JC Personal" },
  });

  const redFamily = await prisma.spending.create({
    data: { name: "Red Family" },
  });

  // Create categories for JC Personal
  const food = await prisma.category.create({
    data: { name: "Food", icon: "🍔", color: "#ef4444", spendingId: jcPersonal.id },
  });

  const transport = await prisma.category.create({
    data: { name: "Transport", icon: "🚗", color: "#3b82f6", spendingId: jcPersonal.id },
  });

  const bills = await prisma.category.create({
    data: { name: "Bills", icon: "💡", color: "#f59e0b", spendingId: jcPersonal.id },
  });

  // Create categories for Red Family
  const groceries = await prisma.category.create({
    data: { name: "Groceries", icon: "🛒", color: "#22c55e", spendingId: redFamily.id },
  });

  const utilities = await prisma.category.create({
    data: { name: "Utilities", icon: "🔌", color: "#8b5cf6", spendingId: redFamily.id },
  });

  // Create expenses for JC Personal - Food
  await prisma.expense.createMany({
    data: [
      { title: "Jollibee", amountCentavos: 25000, date: new Date("2026-04-01"), categoryId: food.id, transactionType: "CASH" },
      { title: "McDonald's", amountCentavos: 18000, date: new Date("2026-04-02"), categoryId: food.id, transactionType: "DEBIT_CARD", bank: "BDO" },
      { title: "Shakeys", amountCentavos: 45000, date: new Date("2026-04-03"), categoryId: food.id, transactionType: "CREDIT_CARD", bank: "BPI" },
      { title: "Mang Inasal", amountCentavos: 15000, date: new Date("2026-04-04"), categoryId: food.id, transactionType: "CASH" },
      { title: "Grab Food", amountCentavos: 32000, date: new Date("2026-04-05"), categoryId: food.id, transactionType: "DEBIT_CARD", bank: "BDO" },
    ],
  });

  // Create expenses for JC Personal - Transport
  await prisma.expense.createMany({
    data: [
      { title: "Grab", amountCentavos: 15000, date: new Date("2026-04-01"), categoryId: transport.id, transactionType: "DEBIT_CARD", bank: "BDO" },
      { title: "Gas", amountCentavos: 120000, date: new Date("2026-04-02"), categoryId: transport.id, transactionType: "DEBIT_CARD", bank: "BDO" },
      { title: "Toll Fee", amountCentavos: 12000, date: new Date("2026-04-03"), categoryId: transport.id, transactionType: "CASH" },
    ],
  });

  // Create expenses for JC Personal - Bills
  await prisma.expense.createMany({
    data: [
      { title: "Meralco", amountCentavos: 320000, date: new Date("2026-04-01"), categoryId: bills.id, transactionType: "BANK_PAYMENT", bank: "BDO" },
      { title: "Globe Postpaid", amountCentavos: 99900, date: new Date("2026-04-01"), categoryId: bills.id, transactionType: "BANK_PAYMENT", bank: "BDO" },
      { title: "PLDT Fibr", amountCentavos: 129900, date: new Date("2026-04-01"), categoryId: bills.id, transactionType: "BANK_PAYMENT", bank: "BPI" },
    ],
  });

  // Create expenses for Red Family
  await prisma.expense.createMany({
    data: [
      { title: "SM Supermarket", amountCentavos: 450000, date: new Date("2026-04-01"), categoryId: groceries.id, transactionType: "DEBIT_CARD", bank: "BDO" },
      { title: "Puregold", amountCentavos: 230000, date: new Date("2026-04-05"), categoryId: groceries.id, transactionType: "CASH" },
      { title: "Water Bill", amountCentavos: 45000, date: new Date("2026-04-01"), categoryId: utilities.id, transactionType: "BANK_TRANSFER", bank: "BPI" },
      { title: "Meralco", amountCentavos: 580000, date: new Date("2026-04-01"), categoryId: utilities.id, transactionType: "BANK_PAYMENT", bank: "BDO" },
    ],
  });

  console.log("✅ Seeding complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
