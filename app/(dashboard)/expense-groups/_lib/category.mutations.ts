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
  const expenseGroupId = readId(formData, "expenseGroupId");
  return saveCategoryChange(expenseGroupId, () =>
    access.create(expenseGroupId, formData.get("name"))
  );
}

export async function updateCategory(
  previousState: CategoryActionState,
  formData: FormData
): Promise<CategoryActionState> {
  const expenseGroupId = readId(formData, "expenseGroupId");
  const categoryId = readId(formData, "categoryId");
  return saveCategoryChange(expenseGroupId, () =>
    access.update(expenseGroupId, categoryId, formData.get("name"))
  );
}

export async function deleteCategory(
  previousState: CategoryActionState,
  formData: FormData
): Promise<CategoryActionState> {
  const expenseGroupId = readId(formData, "expenseGroupId");
  const categoryId = readId(formData, "categoryId");
  return saveCategoryChange(expenseGroupId, () =>
    access.delete(expenseGroupId, categoryId)
  );
}

function readId(formData: FormData, field: string): number {
  const value = formData.get(field);
  return typeof value === "string" ? Number(value) : NaN;
}

async function saveCategoryChange(
  expenseGroupId: number,
  change: () => Promise<unknown>
): Promise<CategoryActionState> {
  try {
    await change();
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
