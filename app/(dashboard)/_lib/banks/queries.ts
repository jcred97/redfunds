import "server-only";

import { requireUserId } from "@/app/lib/auth/session";
import { prisma } from "@/server/db/client";
import { createBankAccess } from "./access";

const access = createBankAccess(prisma, requireUserId);

export async function getBankCatalogForExpenseGroup(expenseGroupId: number) {
  return access.list(expenseGroupId);
}

export async function getExpenseBankOptions(expenseGroupId: number) {
  return access.listForExpenses(expenseGroupId);
}
