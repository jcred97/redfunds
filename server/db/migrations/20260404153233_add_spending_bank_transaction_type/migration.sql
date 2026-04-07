/*
  Warnings:

  - Added the required column `spendingId` to the `Category` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('DEBIT_CARD', 'CREDIT_CARD', 'BANK_TRANSFER', 'BANK_PAYMENT', 'CASH');

-- DropIndex
DROP INDEX "Category_name_key";

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "spendingId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "bank" TEXT,
ADD COLUMN     "transactionType" "TransactionType";

-- CreateTable
CREATE TABLE "Spending" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Spending_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_spendingId_fkey" FOREIGN KEY ("spendingId") REFERENCES "Spending"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
