import { createHash } from "node:crypto";
import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { parsePesoAmount } from "@/app/lib/money";
import { parseExpenseDate } from "@/app/lib/expense-date";

const MAX_RECORD_ID = 2_147_483_647;
const SUBMISSION_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ExpenseInput = {
  title: unknown;
  amount: unknown;
  date: unknown;
};

function validId(id: number): boolean {
  return Number.isSafeInteger(id) && id > 0 && id <= MAX_RECORD_ID;
}

function parseExpenseInput(input: ExpenseInput) {
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

  return { title, amountCentavos, date: parseExpenseDate(input.date) };
}

export function createExpenseAccess(
  db: PrismaClient,
  requireUserId: () => Promise<string>
) {
  return {
    async delete(expenseGroupId: number, expenseId: number) {
      const userId = await requireUserId();

      if (!validId(expenseGroupId) || !validId(expenseId)) {
        throw new TypeError("Expense not found in this expense group");
      }

      // Ownership and deletion happen in one query, never a separate pre-check.
      const result = await db.expense.deleteMany({
        where: {
          id: expenseId,
          expenseGroupId,
          category: { expenseGroup: { userId } },
        },
      });

      if (result.count === 0) {
        throw new TypeError("Expense not found in this expense group");
      }
    },

    async create(
      expenseGroupId: number,
      categoryId: number,
      input: ExpenseInput,
      submissionId: unknown
    ) {
      const userId = await requireUserId();

      if (!validId(expenseGroupId) || !validId(categoryId)) {
        throw new TypeError("Category not found in this expense group");
      }

      if (
        typeof submissionId !== "string" ||
        submissionId.length !== 36 ||
        !SUBMISSION_ID_PATTERN.test(submissionId)
      ) {
        throw new TypeError("Unable to identify this draft. Refresh the page and try again.");
      }

      const values = parseExpenseInput(input);
      const submissionKey = { expenseGroupId, id: submissionId.toLowerCase() };
      const payloadHash = createHash("sha256")
        .update(JSON.stringify([categoryId, values.title, values.amountCentavos, values.date]))
        .digest("hex");

      try {
        return await db.$transaction(async (tx) => {
          // Claim the submission before inserting the expense. A failed write releases the claim.
          await tx.expenseSubmission.create({
            data: {
              id: submissionKey.id,
              payloadHash,
              expenseGroup: { connect: { id: expenseGroupId, userId } },
            },
          });

          return tx.expense.create({
            data: {
              ...values,
              category: {
                connect: {
                  id_expenseGroupId: { id: categoryId, expenseGroupId },
                  expenseGroup: { userId },
                },
              },
              submission: { connect: { expenseGroupId_id: submissionKey } },
            },
          });
        });
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
          throw error;
        }

        if (error.code === "P2025") {
          throw new TypeError("Category not found in this expense group");
        }

        if (error.code !== "P2002") {
          throw error;
        }

        const submission = await db.expenseSubmission.findUnique({
          where: { expenseGroupId_id: submissionKey, expenseGroup: { userId } },
          include: { expense: true },
        });
        if (!submission) {
          throw error;
        }

        if (submission.payloadHash !== payloadHash) {
          throw new TypeError(
            "This draft was already saved with different details. Close it and review the saved expense."
          );
        }

        if (!submission.expense) {
          throw new TypeError("This expense was already saved and has since been deleted.");
        }

        return submission.expense;
      }
    },

    async update(
      expenseGroupId: number,
      expenseId: number,
      categoryId: number,
      input: ExpenseInput,
      expectedUpdatedAt: unknown
    ) {
      const userId = await requireUserId();

      if (!validId(expenseGroupId) || !validId(expenseId) || !validId(categoryId)) {
        throw new TypeError("Expense or category not found in this expense group");
      }

      const values = parseExpenseInput(input);
      const updatedAt = new Date(
        typeof expectedUpdatedAt === "string" ? expectedUpdatedAt : NaN
      );
      // Advance the version even when two edits arrive in the same millisecond.
      const nextUpdatedAt = new Date(Math.max(Date.now(), updatedAt.getTime() + 1));
      if (
        Number.isNaN(nextUpdatedAt.getTime()) ||
        updatedAt.toISOString() !== expectedUpdatedAt
      ) {
        throw new TypeError("Unable to identify this edit. Refresh the page and try again.");
      }

      const ownedExpense = {
        id: expenseId,
        expenseGroupId,
        category: { expenseGroup: { userId } },
      };

      try {
        const [expense] = await db.expense.updateManyAndReturn({
          where: { ...ownedExpense, updatedAt },
          // The composite foreign key keeps the replacement category in this group.
          data: {
            ...values,
            categoryId,
            updatedAt: nextUpdatedAt,
          },
        });

        if (expense) {
          return expense;
        }
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2003"
        ) {
          throw new TypeError("Expense or category not found in this expense group");
        }

        throw error;
      }

      const existingExpense = await db.expense.findUnique({
        where: ownedExpense,
        select: { id: true },
      });
      if (existingExpense) {
        throw new TypeError(
          "This expense changed since you opened it. Copy any changes you want to keep, then refresh the page."
        );
      }

      throw new TypeError("Expense or category not found in this expense group");
    },
  };
}
