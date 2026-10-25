import type { PrismaClient } from "@/generated/prisma/client";

function validId(id: number) {
  return Number.isSafeInteger(id) && id > 0;
}

// Identity is resolved per operation, never captured at startup or supplied by a browser.
export function createExpenseGroupAccess(
  db: PrismaClient,
  requireUserId: () => Promise<string>
) {
  return {
    async list() {
      const userId = await requireUserId();

      return db.expenseGroup.findMany({
        where: { userId },
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
    },

    async getById(id: number) {
      const userId = await requireUserId();

      if (!validId(id)) {
        return null;
      }

      return db.expenseGroup.findUnique({
        where: { id, userId },
        include: {
          categories: {
            include: {
              expenses: true,
              _count: { select: { expenses: true } },
            },
          },
        },
      });
    },

    async getExpensesById(id: number) {
      const userId = await requireUserId();

      if (!validId(id)) {
        return [];
      }

      return db.expense.findMany({
        where: {
          expenseGroupId: id,
          category: { expenseGroup: { userId } },
        },
        include: {
          category: { select: { name: true, color: true, icon: true } },
          bankAssignment: {
            include: {
              bank: { select: { name: true } },
            },
          },
        },
        orderBy: { date: "desc" },
      });
    },

    async create(name: unknown) {
      const userId = await requireUserId();

      if (typeof name !== "string" || !name.trim()) {
        throw new TypeError("Name is required");
      }

      if (name.trim().length > 100) {
        throw new TypeError("Name must be 100 characters or fewer");
      }

      return db.expenseGroup.create({
        data: { name: name.trim(), userId },
      });
    },

    async delete(id: number) {
      const userId = await requireUserId();

      if (!validId(id)) {
        throw new Error("Expense group not found");
      }

      const result = await db.expenseGroup.deleteMany({
        where: { id, userId },
      });

      if (result.count === 0) {
        throw new Error("Expense group not found");
      }
    },
  };
}
