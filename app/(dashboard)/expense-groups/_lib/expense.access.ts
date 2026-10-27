import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { parsePesoAmount } from "@/app/lib/money";
import { parseExpenseDate } from "@/app/lib/expense-date";

const MAX_RECORD_ID = 2_147_483_647;

type ExpenseInput = {
  title: unknown;
  amount: unknown;
  date: unknown;
};

function validId(id: number): boolean {
  return Number.isSafeInteger(id) && id > 0 && id <= MAX_RECORD_ID;
}

export function createExpenseAccess(
  db: PrismaClient,
  requireUserId: () => Promise<string>
) {
  return {
    async create(expenseGroupId: number, categoryId: number, input: ExpenseInput) {
      const userId = await requireUserId();

      if (!validId(expenseGroupId) || !validId(categoryId)) {
        throw new TypeError("Category not found in this expense group");
      }

      if (typeof input.title !== "string" || !input.title.trim()) {
        throw new TypeError("Title is required");
      }

      const title = input.title.trim();

      if (title.length > 100) {
        throw new TypeError("Title must be 100 characters or fewer");
      }

      if (typeof input.amount !== "string") {
        throw new TypeError("Enter an amount as a decimal string.");
      }

      let amountCentavos: number;

      try {
        amountCentavos = parsePesoAmount(input.amount);
      } catch (error) {
        if (error instanceof Error) {
          throw new TypeError(error.message);
        }

        throw error;
      }

      const date = parseExpenseDate(input.date);

      try {
        return await db.expense.create({
          data: {
            title,
            amountCentavos,
            date,
            // Both category membership and the session's ownership are checked.
            category: {
              connect: {
                id_expenseGroupId: { id: categoryId, expenseGroupId },
                expenseGroup: { userId },
              },
            },
          },
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2025"
        ) {
          throw new TypeError("Category not found in this expense group");
        }

        throw error;
      }
    },
  };
}
