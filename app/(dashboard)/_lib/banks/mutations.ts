"use server";

import { revalidatePath } from "next/cache";
import { requireUserId } from "@/app/lib/auth/session";
import { prisma } from "@/server/db/client";
import { createBankAccess } from "./access";

const access = createBankAccess(prisma, requireUserId);

export async function saveBankAssignment(formData: FormData): Promise<{ success: true } | { error: string }> {
  try {
    const expenseGroupId = await access.save(formData);
    revalidatePath(`/spending/${expenseGroupId}`);
    return { success: true };
  } catch (error) {
    if (error instanceof TypeError) {
      return { error: error.message };
    }
    throw error;
  }
}
