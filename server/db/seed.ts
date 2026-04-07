import * as dotenv from "dotenv";
dotenv.config();

import { PrismaClient } from "../../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding database...");

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
      { title: "Jollibee", amount: 250, date: new Date("2026-04-01"), categoryId: food.id, transactionType: "CASH" },
      { title: "McDonald's", amount: 180, date: new Date("2026-04-02"), categoryId: food.id, transactionType: "DEBIT_CARD", bank: "BDO" },
      { title: "Shakeys", amount: 450, date: new Date("2026-04-03"), categoryId: food.id, transactionType: "CREDIT_CARD", bank: "BPI" },
      { title: "Mang Inasal", amount: 150, date: new Date("2026-04-04"), categoryId: food.id, transactionType: "CASH" },
      { title: "Grab Food", amount: 320, date: new Date("2026-04-05"), categoryId: food.id, transactionType: "DEBIT_CARD", bank: "BDO" },
    ],
  });

  // Create expenses for JC Personal - Transport
  await prisma.expense.createMany({
    data: [
      { title: "Grab", amount: 150, date: new Date("2026-04-01"), categoryId: transport.id, transactionType: "DEBIT_CARD", bank: "BDO" },
      { title: "Gas", amount: 1200, date: new Date("2026-04-02"), categoryId: transport.id, transactionType: "DEBIT_CARD", bank: "BDO" },
      { title: "Toll Fee", amount: 120, date: new Date("2026-04-03"), categoryId: transport.id, transactionType: "CASH" },
    ],
  });

  // Create expenses for JC Personal - Bills
  await prisma.expense.createMany({
    data: [
      { title: "Meralco", amount: 3200, date: new Date("2026-04-01"), categoryId: bills.id, transactionType: "BANK_PAYMENT", bank: "BDO" },
      { title: "Globe Postpaid", amount: 999, date: new Date("2026-04-01"), categoryId: bills.id, transactionType: "BANK_PAYMENT", bank: "BDO" },
      { title: "PLDT Fibr", amount: 1299, date: new Date("2026-04-01"), categoryId: bills.id, transactionType: "BANK_PAYMENT", bank: "BPI" },
    ],
  });

  // Create expenses for Red Family
  await prisma.expense.createMany({
    data: [
      { title: "SM Supermarket", amount: 4500, date: new Date("2026-04-01"), categoryId: groceries.id, transactionType: "DEBIT_CARD", bank: "BDO" },
      { title: "Puregold", amount: 2300, date: new Date("2026-04-05"), categoryId: groceries.id, transactionType: "CASH" },
      { title: "Water Bill", amount: 450, date: new Date("2026-04-01"), categoryId: utilities.id, transactionType: "BANK_TRANSFER", bank: "BPI" },
      { title: "Meralco", amount: 5800, date: new Date("2026-04-01"), categoryId: utilities.id, transactionType: "BANK_PAYMENT", bank: "BDO" },
    ],
  });

  console.log("✅ Seeding complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
