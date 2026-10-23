-- ExpenseGroup maps to the existing Spending table; Category.expenseGroupId
-- maps to spendingId. Existing names, IDs, dates, money and bank text stay intact.
BEGIN;

LOCK TABLE "Spending", "Category", "Expense" IN ACCESS EXCLUSIVE MODE;

ALTER TABLE "Expense" ADD COLUMN "bankAssignmentId" INTEGER,
  ADD COLUMN "expenseGroupId" INTEGER;

UPDATE "Expense" AS expense
SET "expenseGroupId" = category."spendingId"
FROM "Category" AS category
WHERE expense."categoryId" = category."id";

ALTER TABLE "Expense" ALTER COLUMN "expenseGroupId" SET NOT NULL;

CREATE TABLE "Budget" (
  "id" SERIAL NOT NULL,
  "expenseGroupId" INTEGER NOT NULL,
  "budgetMonth" DATE NOT NULL,
  "amountCentavos" INTEGER NOT NULL,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Budget_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Budget_amountCentavos_positive" CHECK ("amountCentavos" > 0),
  CONSTRAINT "Budget_month_first_day" CHECK (EXTRACT(DAY FROM "budgetMonth") = 1)
);

CREATE TABLE "Bank" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Bank_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Bank_normalized_key" CHECK (
    "key" <> '' AND "key" = lower(btrim(regexp_replace("name", '\s+', ' ', 'g')))
  )
);

CREATE TABLE "ExpenseGroupBank" (
  "id" SERIAL NOT NULL,
  "expenseGroupId" INTEGER NOT NULL,
  "bankId" INTEGER NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "supportedDebitCard" BOOLEAN NOT NULL DEFAULT true,
  "supportedCreditCard" BOOLEAN NOT NULL DEFAULT true,
  "supportedBankTransfer" BOOLEAN NOT NULL DEFAULT true,
  "supportedBankPayment" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ExpenseGroupBank_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Budget_expenseGroupId_budgetMonth_key" ON "Budget"("expenseGroupId", "budgetMonth");
CREATE UNIQUE INDEX "Bank_key_key" ON "Bank"("key");
CREATE INDEX "ExpenseGroupBank_bankId_idx" ON "ExpenseGroupBank"("bankId");
CREATE UNIQUE INDEX "ExpenseGroupBank_expenseGroupId_bankId_key" ON "ExpenseGroupBank"("expenseGroupId", "bankId");
CREATE UNIQUE INDEX "ExpenseGroupBank_id_expenseGroupId_key" ON "ExpenseGroupBank"("id", "expenseGroupId");
CREATE UNIQUE INDEX "Category_id_spendingId_key" ON "Category"("id", "spendingId");
CREATE INDEX "Expense_expenseGroupId_date_idx" ON "Expense"("expenseGroupId", "date");
CREATE INDEX "Expense_categoryId_expenseGroupId_idx" ON "Expense"("categoryId", "expenseGroupId");
CREATE INDEX "Expense_bankAssignmentId_expenseGroupId_idx" ON "Expense"("bankAssignmentId", "expenseGroupId");

ALTER TABLE "Expense" DROP CONSTRAINT "Expense_categoryId_fkey";
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_categoryId_expenseGroupId_fkey"
  FOREIGN KEY ("categoryId", "expenseGroupId") REFERENCES "Category"("id", "spendingId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_bankAssignmentId_expenseGroupId_fkey"
  FOREIGN KEY ("bankAssignmentId", "expenseGroupId") REFERENCES "ExpenseGroupBank"("id", "expenseGroupId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Budget" ADD CONSTRAINT "Budget_expenseGroupId_fkey"
  FOREIGN KEY ("expenseGroupId") REFERENCES "Spending"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExpenseGroupBank" ADD CONSTRAINT "ExpenseGroupBank_expenseGroupId_fkey"
  FOREIGN KEY ("expenseGroupId") REFERENCES "Spending"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExpenseGroupBank" ADD CONSTRAINT "ExpenseGroupBank_bankId_fkey"
  FOREIGN KEY ("bankId") REFERENCES "Bank"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
