import "server-only";

import { prisma } from "@/app/lib/prisma";
import { requireUserId } from "@/app/lib/session";
import { createExpenseGroupAccess } from "./expense-group.access";

const access = createExpenseGroupAccess(prisma, requireUserId);

export async function getExpenseGroups() {
  return access.list();
}

export async function getExpenseGroupById(id: number) {
  return access.getById(id);
}

export async function getExpensesByExpenseGroupId(id: number) {
  return access.getExpensesById(id);
}
