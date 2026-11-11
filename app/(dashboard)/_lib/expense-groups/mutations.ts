"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db/client";
import { requireUserId } from "@/app/lib/auth/session";
import { createExpenseGroupAccess, ExpenseGroupAccessError } from "./access";

const access = createExpenseGroupAccess(prisma, requireUserId);

export type ActionState = { error: string } | { success: true } | null;

export async function createExpenseGroup(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  return saveGroupChange(async () => {
    await access.create(formData.get("name"));
    return { success: true };
  });
}

export async function renameExpenseGroup(id: number, formData: FormData) {
  return saveGroupChange(async () => {
    await access.rename(id, formData.get("name"));
    return { success: true };
  });
}

export async function duplicateExpenseGroup(id: number) {
  return saveGroupChange(async () => {
    const copy = await access.duplicate(id);
    return { success: true, id: copy.id };
  });
}

export async function deleteExpenseGroup(id: number) {
  return saveGroupChange(async () => {
    await access.delete(id);
    return { success: true };
  });
}

async function saveGroupChange<T extends { success: true }>(change: () => Promise<T>) {
  try {
    const result = await change();
    revalidatePath("/");
    revalidatePath("/spending/[id]", "page");
    return result;
  } catch (error) {
    if (error instanceof TypeError || error instanceof ExpenseGroupAccessError) {
      return { error: error.message };
    }

    throw error;
  }
}
