import { Prisma, type PrismaClient } from "@/generated/prisma/client";

const MAX_EXPENSE_GROUP_ID = 2_147_483_647;

export function createCategoryAccess(
  db: PrismaClient,
  requireUserId: () => Promise<string>
) {
  return {
    async create(expenseGroupId: number, name: unknown) {
      const userId = await requireUserId();

      if (
        !Number.isSafeInteger(expenseGroupId) ||
        expenseGroupId <= 0 ||
        expenseGroupId > MAX_EXPENSE_GROUP_ID
      ) {
        throw new TypeError("Expense group not found");
      }

      if (typeof name !== "string" || !name.trim()) {
        throw new TypeError("Name is required");
      }

      if (name.trim().length > 100) {
        throw new TypeError("Name must be 100 characters or fewer");
      }

      try {
        return await db.category.create({
          data: {
            name: name.trim(),
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
  };
}
