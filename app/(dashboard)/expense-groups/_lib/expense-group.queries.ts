import { prisma } from "@/app/lib/prisma";

export async function getExpenseGroups() {
  return prisma.expenseGroup.findMany({
    include: {
      _count: { select: { categories: true } },
      categories: {
        include: {
          expenses: { select: { amountCentavos: true } },
          _count: { select: { expenses: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getExpenseGroupById(id: number) {
  return prisma.expenseGroup.findUnique({
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

export async function getExpensesByExpenseGroupId(id: number) {
  return prisma.expense.findMany({
    where: {
      category: { expenseGroupId: id },
    },
    include: {
      category: { select: { name: true, color: true, icon: true } },
      bankAssignment: { include: { bank: { select: { name: true } } } },
    },
    orderBy: { date: "desc" },
  });
}
