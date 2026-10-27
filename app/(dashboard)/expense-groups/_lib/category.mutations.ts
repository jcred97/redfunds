"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/app/lib/prisma";
import { requireUserId } from "@/app/lib/session";
import { createCategoryAccess } from "./category.access";

const access = createCategoryAccess(prisma, requireUserId);

export type CategoryActionState = { error: string } | { success: true } | null;

export async function createCategory(
  previousState: CategoryActionState,
  formData: FormData
): Promise<CategoryActionState> {
  const rawGroupId = formData.get("expenseGroupId");
  const expenseGroupId = typeof rawGroupId === "string" ? Number(rawGroupId) : NaN;

  try {
    await access.create(expenseGroupId, formData.get("name"));
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
