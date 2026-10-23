"use server";

import { prisma } from "@/app/lib/prisma";
import { revalidatePath } from "next/cache";

export type ActionState = { error: string } | { success: true } | null;

export async function createExpenseGroup(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const name = formData.get("name") as string;

  if (!name?.trim()) return { error: "Name is required" };

  await prisma.expenseGroup.create({
    data: { name: name.trim() },
  });

  revalidatePath("/");
  return { success: true };
}

export async function deleteExpenseGroup(id: number) {
  await prisma.expenseGroup.delete({ where: { id } });
  revalidatePath("/");
}
