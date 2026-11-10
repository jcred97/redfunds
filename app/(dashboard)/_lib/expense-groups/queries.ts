import "server-only";

import { prisma } from "@/server/db/client";
import { requireUserId } from "@/app/lib/auth/session";
import { createExpenseGroupAccess } from "./access";

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
