"use server";

import { prisma } from "@/server/db/prisma";
import { revalidatePath } from "next/cache";

export type ActionState = { error: string } | { success: true } | null;

export async function createSpending(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const name = formData.get("name") as string;

  if (!name?.trim()) return { error: "Name is required" };

  await prisma.spending.create({
    data: { name: name.trim() },
  });

  revalidatePath("/");
  return { success: true };
}

export async function deleteSpending(id: number) {
  await prisma.spending.delete({ where: { id } });
  revalidatePath("/");
}
