import { PaymentMethod, Prisma, type Expense, type PrismaClient } from "@/generated/prisma/client";
import { parseExpenseMonth } from "@/app/lib/expenses/date";

// Expense-group IDs use PostgreSQL's signed INTEGER column.
const MAX_EXPENSE_GROUP_ID = 2_147_483_647;
const MAX_NAME_LENGTH = 100;
const EXPENSES_PAGE_SIZE = 25;
const GROUP_HAS_DEPENDENCIES =
  "Remove this expense group's categories, budgets, and bank assignments before deleting it.";

type ExpensePageRow = {
  totalExpenses: bigint;
  totalCentavos: bigint;
  totalPages: bigint;
  page: bigint;
} & (
  | { id: null }
  | (Pick<Expense, "id" | "title" | "amountCentavos" | "date" | "updatedAt" | "categoryId" | "paymentMethod" | "bankAssignmentId" | "legacyBankName"> & {
      categoryName: string;
      categoryIcon: string | null;
      bankName: string | null;
    })
);

type ExpenseGroupSummary = {
  id: number;
  name: string;
  categoryCount: bigint;
  expenseCount: bigint;
  totalCentavos: bigint;
};

export type ExpenseHistoryFilters = {
  month?: string;
  categoryId?: number;
  paymentMethod?: PaymentMethod;
  bank?: { assignmentId: number } | { legacyKey: string };
};

type ExpenseHistoryBankOption = { value: string; label: string };

export class ExpenseGroupAccessError extends Error {}

function validId(id: number) {
  return (
    Number.isSafeInteger(id) &&
    id > 0 &&
    id <= MAX_EXPENSE_GROUP_ID
  );
}

export function parseExpenseHistoryBankFilter(value: unknown): ExpenseHistoryFilters["bank"] {
  if (typeof value !== "string" || value.trim() !== value) return undefined;

  const assignment = /^assignment:([1-9]\d{0,9})$/.exec(value);
  if (assignment) {
    const assignmentId = Number(assignment[1]);
    return validId(assignmentId) ? { assignmentId } : undefined;
  }

  const legacy = /^legacy:([a-f0-9]{64})$/.exec(value);
  return legacy ? { legacyKey: legacy[1] } : undefined;
}

export function parseExpenseHistoryPaymentMethod(value: unknown): PaymentMethod | undefined {
  return typeof value === "string" && Object.hasOwn(PaymentMethod, value)
    ? PaymentMethod[value as keyof typeof PaymentMethod]
    : undefined;
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

      return db.$queryRaw<ExpenseGroupSummary[]>`
        WITH owned_groups AS (
          SELECT "id", "name", "createdAt"
          FROM "Spending"
          WHERE "userId" = ${userId}
        ),
        category_counts AS (
          SELECT c."spendingId" AS "groupId", COUNT(*) AS "categoryCount"
          FROM "Category" AS c
          JOIN owned_groups AS g ON g."id" = c."spendingId"
          GROUP BY c."spendingId"
        ),
        expense_totals AS (
          SELECT e."expenseGroupId" AS "groupId",
                 COUNT(*) AS "expenseCount",
                 SUM(e."amountCentavos") AS "totalCentavos"
          FROM "Expense" AS e
          JOIN owned_groups AS g ON g."id" = e."expenseGroupId"
          GROUP BY e."expenseGroupId"
        )
        SELECT g."id", g."name",
               COALESCE(c."categoryCount", 0) AS "categoryCount",
               COALESCE(e."expenseCount", 0) AS "expenseCount",
               COALESCE(e."totalCentavos", 0) AS "totalCentavos"
        FROM owned_groups AS g
        LEFT JOIN category_counts AS c ON c."groupId" = g."id"
        LEFT JOIN expense_totals AS e ON e."groupId" = g."id"
        ORDER BY g."createdAt" DESC, g."id" DESC
      `;
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

    async listExpenseHistoryBankOptions(id: number) {
      const userId = await requireUserId();
      if (!validId(id)) return [];

      // Use a digest as the URL value so recorded labels stay out of URLs.
      return db.$queryRaw<ExpenseHistoryBankOption[]>`
        WITH owned_group AS (
          SELECT id FROM "Spending" WHERE id = ${id} AND "userId" = ${userId}
        ), legacy_banks AS (
          SELECT DISTINCT expense.bank AS name
          FROM "Expense" expense
          JOIN owned_group ON owned_group.id = expense."expenseGroupId"
          WHERE expense."bankAssignmentId" IS NULL AND expense.bank ~ '[^[:space:]]'
        )
        SELECT 'assignment:' || assignment.id AS value, bank.name AS label
        FROM "ExpenseGroupBank" assignment
        JOIN owned_group ON owned_group.id = assignment."expenseGroupId"
        JOIN "Bank" bank ON bank.id = assignment."bankId"
        UNION ALL
        SELECT 'legacy:' || encode(sha256(convert_to(name, 'UTF8')), 'hex') AS value,
          name || ' (recorded name)' AS label
        FROM legacy_banks
        ORDER BY label, value
      `;
    },

    async getExpensePageById(
      id: number,
      requestedPage: number,
      { month, categoryId, paymentMethod, bank }: ExpenseHistoryFilters = {}
    ) {
      const userId = await requireUserId();
      if (!validId(id)) return null;

      const page = Number.isSafeInteger(requestedPage) && requestedPage >= 1 ? requestedPage : 1;
      const selectedMonth = parseExpenseMonth(month);
      const monthStart = selectedMonth ? `${selectedMonth}-01` : undefined;
      // The date column stores UTC calendar dates. Use the same bounds for totals and rows.
      const monthFilter = monthStart
        ? Prisma.sql`AND date >= ${monthStart}::timestamp
                     AND date < ${monthStart}::timestamp + INTERVAL '1 month'`
        : Prisma.empty;
      const categoryFilter = categoryId !== undefined && validId(categoryId)
        ? Prisma.sql`AND "categoryId" = ${categoryId}`
        : Prisma.empty;
      const paymentMethodFilter = paymentMethod
        ? Prisma.sql`AND "transactionType" = ${paymentMethod}::"TransactionType"`
        : Prisma.empty;
      let bankFilter = Prisma.empty;
      if (bank && "assignmentId" in bank) {
        bankFilter = Prisma.sql`AND "bankAssignmentId" = ${bank.assignmentId}`;
      } else if (bank) {
        bankFilter = Prisma.sql`AND "bankAssignmentId" IS NULL
          AND bank ~ '[^[:space:]]'
          AND encode(sha256(convert_to(bank, 'UTF8')), 'hex') = ${bank.legacyKey}`;
      }
      const expenseFilters = Prisma.sql`${monthFilter} ${categoryFilter} ${paymentMethodFilter} ${bankFilter}`;

      // Clamp the page and read its rows in the same database snapshot as the totals.
      const rows = await db.$queryRaw<ExpensePageRow[]>`
        WITH pagination AS (
          SELECT expense_group.id, totals.*,
            LEAST(totals."totalPages", ${page}::bigint) AS page
          FROM "Spending" expense_group
          CROSS JOIN LATERAL (
            SELECT COUNT(*) AS "totalExpenses",
              COALESCE(SUM("amountCentavos"), 0) AS "totalCentavos",
              GREATEST(1, (COUNT(*) + ${EXPENSES_PAGE_SIZE - 1}) / ${EXPENSES_PAGE_SIZE}) AS "totalPages"
            FROM "Expense"
            WHERE "expenseGroupId" = expense_group.id
              ${expenseFilters}
          ) totals
          WHERE expense_group.id = ${id} AND expense_group."userId" = ${userId}
        )
        SELECT pagination."totalExpenses", pagination."totalCentavos", pagination."totalPages", pagination.page,
          expense.id, expense.title, expense."amountCentavos", expense.date, expense."updatedAt", expense."categoryId",
          expense."transactionType" AS "paymentMethod", expense."bankAssignmentId", expense.bank AS "legacyBankName",
          category.name AS "categoryName", category.icon AS "categoryIcon", bank.name AS "bankName"
        FROM pagination
        LEFT JOIN LATERAL (
          SELECT id, title, "amountCentavos", date, "updatedAt", "categoryId", "transactionType", bank, "bankAssignmentId"
          FROM "Expense"
          WHERE "expenseGroupId" = pagination.id
            ${expenseFilters}
          ORDER BY date DESC, id DESC
          LIMIT ${EXPENSES_PAGE_SIZE}
          OFFSET (pagination.page - 1) * ${EXPENSES_PAGE_SIZE}
        ) expense ON true
        LEFT JOIN "Category" category
          ON category.id = expense."categoryId" AND category."spendingId" = pagination.id
        LEFT JOIN "ExpenseGroupBank" assignment
          ON assignment.id = expense."bankAssignmentId" AND assignment."expenseGroupId" = pagination.id
        LEFT JOIN "Bank" bank ON bank.id = assignment."bankId"
        ORDER BY expense.date DESC, expense.id DESC
      `;

      const [summary] = rows;
      if (!summary) return null;

      return {
        totalExpenses: Number(summary.totalExpenses),
        totalCentavos: summary.totalCentavos,
        totalPages: Number(summary.totalPages),
        page: Number(summary.page),
        expenses: rows.filter((row) => row.id !== null).map((row) => ({
          id: row.id,
          title: row.title,
          amountCentavos: row.amountCentavos,
          date: row.date,
          updatedAt: row.updatedAt,
          categoryId: row.categoryId,
          paymentMethod: row.paymentMethod,
          bankAssignmentId: row.bankAssignmentId,
          legacyBankName: row.legacyBankName,
          category: { name: row.categoryName, icon: row.categoryIcon },
          bankAssignment: row.bankName === null ? null : { bank: { name: row.bankName } },
        })),
      };
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
