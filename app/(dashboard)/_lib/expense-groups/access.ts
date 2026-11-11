import { Prisma, type PrismaClient } from "@/generated/prisma/client";

// Expense-group IDs use PostgreSQL's signed INTEGER column.
const MAX_EXPENSE_GROUP_ID = 2_147_483_647;
const MAX_NAME_LENGTH = 100;
const GROUP_HAS_DEPENDENCIES =
  "Remove this expense group's categories, budgets, and bank assignments before deleting it.";

export class ExpenseGroupAccessError extends Error {}

function validId(id: number) {
  return (
    Number.isSafeInteger(id) &&
    id > 0 &&
    id <= MAX_EXPENSE_GROUP_ID
  );
}

function parseName(name: unknown) {
  if (typeof name !== "string" || !name.trim()) {
    throw new TypeError("Name is required");
  }

  const trimmedName = name.trim();
  if (trimmedName.length > MAX_NAME_LENGTH) {
    throw new TypeError("Name must be 100 characters or fewer");
  }

  return trimmedName;
}

function ownedGroup(id: number, userId: string) {
  if (!validId(id)) {
    throw new ExpenseGroupAccessError("Expense group not found");
  }

  return { id, userId };
}

function copyName(name: string) {
  const suffix = " (copy)";
  const shortened = name.trim()
    .slice(0, MAX_NAME_LENGTH - suffix.length)
    .replace(/[\uD800-\uDBFF]$/, "")
    .trimEnd();
  return (shortened || "Expense Group") + suffix;
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

    async listForSwitcher() {
      const userId = await requireUserId();
      return db.expenseGroup.findMany({
        where: { userId },
        select: { id: true, name: true },
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

      return db.expenseGroup.create({
        data: { name: parseName(name), userId },
      });
    },

    async rename(id: number, name: unknown) {
      const userId = await requireUserId();
      const result = await db.expenseGroup.updateMany({
        where: ownedGroup(id, userId),
        data: { name: parseName(name) },
      });
      if (result.count === 0) {
        throw new ExpenseGroupAccessError("Expense group not found");
      }
    },

    async duplicate(id: number) {
      const userId = await requireUserId();
      const where = ownedGroup(id, userId);

      return db.$transaction(async (tx) => {
        const source = await tx.expenseGroup.findUnique({
          where,
          include: {
            budgets: true,
            bankAssignments: true,
            categories: { include: { expenses: true } },
          },
        });
        if (!source) {
          throw new ExpenseGroupAccessError("Expense group not found");
        }

        const copy = await tx.expenseGroup.create({
          data: {
            userId,
            name: copyName(source.name),
            budgets: {
              createMany: {
                data: source.budgets.map(({ budgetMonth, amountCentavos, description }) => ({
                  budgetMonth,
                  amountCentavos,
                  description,
                })),
              },
            },
            bankAssignments: {
              createMany: {
                data: source.bankAssignments.map((assignment) => ({
                  bankId: assignment.bankId,
                  active: assignment.active,
                  supportedDebitCard: assignment.supportedDebitCard,
                  supportedCreditCard: assignment.supportedCreditCard,
                  supportedBankTransfer: assignment.supportedBankTransfer,
                  supportedBankPayment: assignment.supportedBankPayment,
                })),
              },
            },
          },
          select: {
            id: true,
            bankAssignments: { select: { id: true, bankId: true } },
          },
        });

        const copiedIdsByBank = new Map(copy.bankAssignments.map(({ bankId, id }) => [bankId, id]));
        const copiedAssignmentIds = new Map(
          source.bankAssignments.map(({ id, bankId }) => [id, copiedIdsByBank.get(bankId)]),
        );

        // Nest expenses under their new category so categories with the same name stay distinct.
        await tx.expenseGroup.update({
          where: { id: copy.id },
          data: {
            categories: {
              create: source.categories.map((category) => ({
                name: category.name,
                icon: category.icon,
                color: category.color,
                expenses: {
                  createMany: {
                    data: category.expenses.map((expense) => {
                      const bankAssignmentId = expense.bankAssignmentId === null
                        ? null
                        : copiedAssignmentIds.get(expense.bankAssignmentId);
                      if (bankAssignmentId === undefined) {
                        throw new Error("Could not match the copied bank assignment");
                      }
                      return {
                        title: expense.title,
                        amountCentavos: expense.amountCentavos,
                        date: expense.date,
                        notes: expense.notes,
                        legacyBankName: expense.legacyBankName,
                        paymentMethod: expense.paymentMethod,
                        bankAssignmentId,
                      };
                    }),
                  },
                },
              })),
            },
          },
          select: { id: true },
        });
        return { id: copy.id };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
    },

    async delete(id: number) {
      const userId = await requireUserId();

      const where = ownedGroup(id, userId);
      try {
        const result = await db.expenseGroup.deleteMany({
          where: {
            ...where,
            categories: { none: {} },
            budgets: { none: {} },
            bankAssignments: { none: {} },
          },
        });
        if (result.count > 0) {
          return;
        }
        if (!(await db.expenseGroup.findUnique({ where, select: { id: true } }))) {
          throw new ExpenseGroupAccessError("Expense group not found");
        }
        throw new ExpenseGroupAccessError(GROUP_HAS_DEPENDENCIES);
      } catch (error) {
        // The foreign keys also protect records added while the delete was in flight.
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
          throw new ExpenseGroupAccessError(GROUP_HAS_DEPENDENCIES);
        }
        throw error;
      }
    },
  };
}
