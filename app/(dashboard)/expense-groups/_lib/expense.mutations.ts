"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/app/lib/prisma";
import { requireUserId } from "@/app/lib/session";
import { createExpenseAccess } from "./expense.access";

const access = createExpenseAccess(prisma, requireUserId);

export type ExpenseActionState = { error: string } | { success: true } | null;

export async function createExpense(
  previousState: ExpenseActionState,
  formData: FormData
): Promise<ExpenseActionState> {
  const rawGroupId = formData.get("expenseGroupId");
  const rawCategoryId = formData.get("categoryId");
  const expenseGroupId = typeof rawGroupId === "string" ? Number(rawGroupId) : NaN;
  const categoryId = typeof rawCategoryId === "string" ? Number(rawCategoryId) : NaN;

  try {
    await access.create(expenseGroupId, categoryId, {
      title: formData.get("title"),
      amount: formData.get("amount"),
      date: formData.get("date"),
    });
  } catch (error) {
    if (error instanceof TypeError) {
      return { error: error.message };
    }

    throw error;
  }

  revalidatePath(`/spending/${expenseGroupId}`);
  revalidatePath("/");

  return { success: true };
}

export async function updateExpense(
  previousState: ExpenseActionState,
  formData: FormData
): Promise<ExpenseActionState> {
  const rawGroupId = formData.get("expenseGroupId");
  const rawExpenseId = formData.get("expenseId");
  const rawCategoryId = formData.get("categoryId");
  const expenseGroupId = typeof rawGroupId === "string" ? Number(rawGroupId) : NaN;
  const expenseId = typeof rawExpenseId === "string" ? Number(rawExpenseId) : NaN;
  const categoryId = typeof rawCategoryId === "string" ? Number(rawCategoryId) : NaN;

  try {
    await access.update(expenseGroupId, expenseId, categoryId, {
      title: formData.get("title"),
      amount: formData.get("amount"),
      date: formData.get("date"),
    });
  } catch (error) {
    if (error instanceof TypeError) {
      return { error: error.message };
    }

    throw error;
  }

  revalidatePath(`/spending/${expenseGroupId}`);
  revalidatePath("/");

  return { success: true };
}
