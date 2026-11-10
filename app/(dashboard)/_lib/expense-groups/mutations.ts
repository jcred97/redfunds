"use server";

import { prisma } from "@/server/db/client";
import { requireUserId } from "@/app/lib/auth/session";
import { revalidatePath } from "next/cache";
import { createExpenseGroupAccess } from "./access";

const access = createExpenseGroupAccess(prisma, requireUserId);

export type ActionState = { error: string } | { success: true } | null;

export async function createExpenseGroup(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    await access.create(formData.get("name"));
  } catch (error) {
    if (error instanceof TypeError) {
      return { error: error.message };
    }

    throw error;
  }

  revalidatePath("/");
  revalidatePath("/spending/[id]", "page");

  return { success: true };
}

export async function deleteExpenseGroup(id: number) {
  await access.delete(id);

  revalidatePath("/");
  revalidatePath("/spending/[id]", "page");
}
