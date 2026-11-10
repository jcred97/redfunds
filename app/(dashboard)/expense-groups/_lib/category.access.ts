import { Prisma, type PrismaClient } from "@/generated/prisma/client";

const MAX_RECORD_ID = 2_147_483_647;

function validId(id: number): boolean {
  return Number.isSafeInteger(id) && id > 0 && id <= MAX_RECORD_ID;
}

function parseName(name: unknown): string {
  if (typeof name !== "string" || !name.trim()) {
    throw new TypeError("Name is required");
  }

  const trimmedName = name.trim();
  if (trimmedName.length > 100) {
    throw new TypeError("Name must be 100 characters or fewer");
  }

  return trimmedName;
}

function ownedCategory(expenseGroupId: number, categoryId: number, userId: string) {
  if (!validId(expenseGroupId) || !validId(categoryId)) {
    throw new TypeError("Category not found in this expense group");
  }

  return { id: categoryId, expenseGroupId, expenseGroup: { userId } };
}

export function createCategoryAccess(
  db: PrismaClient,
  requireUserId: () => Promise<string>
) {
  return {
    async create(expenseGroupId: number, name: unknown) {
      const userId = await requireUserId();

      if (!validId(expenseGroupId)) {
        throw new TypeError("Expense group not found");
      }

      const categoryName = parseName(name);

      try {
        return await db.category.create({
          data: {
            name: categoryName,
            // The write can only connect to a group owned by this session's user.
            expenseGroup: { connect: { id: expenseGroupId, userId } },
          },
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2025"
        ) {
          // Foreign, unclaimed, and missing groups must look the same to callers.
          throw new TypeError("Expense group not found");
        }

        throw error;
      }
    },
    async update(expenseGroupId: number, categoryId: number, name: unknown) {
      const userId = await requireUserId();
      const where = ownedCategory(expenseGroupId, categoryId, userId);
      const result = await db.category.updateMany({
        where,
        data: { name: parseName(name) },
      });

      if (result.count === 0) {
        throw new TypeError("Category not found in this expense group");
      }
    },
    async delete(expenseGroupId: number, categoryId: number) {
      const userId = await requireUserId();
      const where = ownedCategory(expenseGroupId, categoryId, userId);

      try {
        // The foreign key also rejects deletion if an expense is added concurrently.
        const result = await db.category.deleteMany({
          where: { ...where, expenses: { none: {} } },
        });
        if (result.count > 0) {
          return;
        }

        // Check only owned categories when choosing the error to show.
        if (await db.category.findFirst({ where, select: { id: true } })) {
          throw new TypeError("Move or delete this category's expenses first.");
        }

        throw new TypeError("Category not found in this expense group");
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2003"
        ) {
          throw new TypeError("Move or delete this category's expenses first.");
        }

        throw error;
      }
    },
  };
}
