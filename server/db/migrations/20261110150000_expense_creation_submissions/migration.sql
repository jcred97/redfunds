BEGIN;

CREATE TABLE "ExpenseSubmission" (
    "id" UUID NOT NULL,
    "expenseGroupId" INTEGER NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "expenseId" INTEGER,

    CONSTRAINT "ExpenseSubmission_pkey" PRIMARY KEY ("expenseGroupId", "id"),
    CONSTRAINT "ExpenseSubmission_expenseGroupId_fkey" FOREIGN KEY ("expenseGroupId") REFERENCES "Spending"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ExpenseSubmission_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ExpenseSubmission_expenseId_key" ON "ExpenseSubmission"("expenseId");

ALTER TABLE "ExpenseSubmission" ENABLE ROW LEVEL SECURITY;

COMMIT;
