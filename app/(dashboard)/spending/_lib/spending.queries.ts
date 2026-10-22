import { prisma } from "@/app/lib/prisma";

export async function getSpendings() {
  return prisma.spending.findMany({
    include: {
      _count: { select: { categories: true } },
      categories: {
        include: {
          expenses: { select: { amount: true } },
          _count: { select: { expenses: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getSpendingById(id: number) {
  return prisma.spending.findUnique({
    where: { id },
    include: {
      categories: {
        include: {
          expenses: true,
          _count: { select: { expenses: true } },
        },
      },
    },
  });
}

export async function getExpensesBySpendingId(id: number) {
  return prisma.expense.findMany({
    where: {
      category: { spendingId: id },
    },
    include: {
      category: { select: { name: true, color: true, icon: true } },
    },
    orderBy: { date: "desc" },
  });
}
