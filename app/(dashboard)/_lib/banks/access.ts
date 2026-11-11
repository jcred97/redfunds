import type { BankAssignment, PrismaClient } from "@/generated/prisma/client";
import {
  bankPaymentMethodFields,
  type BankPaymentMethod,
  type ExpenseBankOption,
} from "@/app/lib/expenses/payment";

const MAX_RECORD_ID = 2_147_483_647;
const BANK_UNAVAILABLE = "This bank is unavailable for this expense group.";

type BankSettings = Pick<
  BankAssignment,
  "active" | "supportedDebitCard" | "supportedCreditCard" | "supportedBankTransfer" | "supportedBankPayment"
>;

export type BankCatalogEntry = {
  id: number;
  name: string;
  active: boolean;
  assignment: BankSettings | null;
};

function validId(id: number) {
  return Number.isSafeInteger(id) && id > 0 && id <= MAX_RECORD_ID;
}

function readId(formData: FormData, name: string) {
  const values = formData.getAll(name);
  const [value] = values;
  if (values.length !== 1 || typeof value !== "string" || !/^[1-9]\d{0,9}$/.test(value)) {
    throw new TypeError(BANK_UNAVAILABLE);
  }

  const id = Number(value);
  if (!validId(id)) throw new TypeError(BANK_UNAVAILABLE);
  return id;
}

function readCheckbox(formData: FormData, name: string) {
  const values = formData.getAll(name);
  if (values.length === 0) return false;
  if (values.length === 1 && values[0] === "on") return true;
  throw new TypeError("The bank settings are invalid.");
}

export function createBankAccess(db: PrismaClient, requireUserId: () => Promise<string>) {
  return {
    async listForExpenses(expenseGroupId: number): Promise<ExpenseBankOption[]> {
      const userId = await requireUserId();
      if (!validId(expenseGroupId)) return [];

      const assignments = await db.bankAssignment.findMany({
        where: { expenseGroup: { id: expenseGroupId, userId }, active: true, bank: { active: true } },
        select: {
          id: true,
          bank: { select: { name: true } },
          supportedDebitCard: true,
          supportedCreditCard: true,
          supportedBankTransfer: true,
          supportedBankPayment: true,
        },
        orderBy: [{ bank: { name: "asc" } }, { id: "asc" }],
      });
      const methods = Object.keys(bankPaymentMethodFields) as BankPaymentMethod[];
      return assignments.map((assignment) => ({
        id: assignment.id,
        name: assignment.bank.name,
        paymentMethods: methods.filter((method) => assignment[bankPaymentMethodFields[method]]),
      }));
    },

    async list(expenseGroupId: number): Promise<BankCatalogEntry[]> {
      const userId = await requireUserId();
      if (!validId(expenseGroupId)) return [];

      const group = { id: expenseGroupId, userId };
      if (!(await db.expenseGroup.findUnique({ where: group, select: { id: true } }))) return [];

      const groupAssignment = { expenseGroup: group };
      const banks = await db.bank.findMany({
        where: {
          OR: [{ active: true }, { assignments: { some: groupAssignment } }],
        },
        select: {
          id: true,
          name: true,
          active: true,
          assignments: {
            where: groupAssignment,
            select: {
              active: true,
              supportedDebitCard: true,
              supportedCreditCard: true,
              supportedBankTransfer: true,
              supportedBankPayment: true,
            },
          },
        },
        orderBy: [{ name: "asc" }, { id: "asc" }],
      });

      return banks.map(({ assignments, ...bank }) => ({
        ...bank,
        assignment: assignments[0] ?? null,
      }));
    },

    async save(formData: FormData): Promise<number> {
      const userId = await requireUserId();
      const expenseGroupId = readId(formData, "expenseGroupId");
      const bankId = readId(formData, "bankId");
      const active = readCheckbox(formData, "active");
      const supportedDebitCard = readCheckbox(formData, "supportedDebitCard");
      const supportedCreditCard = readCheckbox(formData, "supportedCreditCard");
      const supportedBankTransfer = readCheckbox(formData, "supportedBankTransfer");
      const supportedBankPayment = readCheckbox(formData, "supportedBankPayment");

      if (!active) {
        // Keep the assignment and its settings for past expenses and later reactivation.
        const group = { id: expenseGroupId, userId };
        const updated = await db.bankAssignment.updateMany({
          where: { expenseGroup: group, bankId },
          data: { active: false },
        });

        if (updated.count === 0) {
          // Disabling a bank that has never been enabled needs no assignment.
          const ownedGroup = await db.expenseGroup.findUnique({ where: group, select: { id: true } });
          const bank = ownedGroup && await db.bank.findUnique({
            where: { id: bankId, active: true },
            select: { id: true },
          });
          if (!bank) throw new TypeError(BANK_UNAVAILABLE);
        }

        return expenseGroupId;
      }

      if (!(supportedDebitCard || supportedCreditCard || supportedBankTransfer || supportedBankPayment)) {
        throw new TypeError("Choose at least one payment method to enable this bank.");
      }

      // Lock eligibility while the database upserts the unique group/bank pair.
      const written = await db.$executeRaw`
        INSERT INTO "ExpenseGroupBank" (
          "expenseGroupId", "bankId", "active",
          "supportedDebitCard", "supportedCreditCard", "supportedBankTransfer", "supportedBankPayment",
          "updatedAt"
        )
        SELECT expense_group."id", bank."id", TRUE,
          ${supportedDebitCard}, ${supportedCreditCard}, ${supportedBankTransfer}, ${supportedBankPayment},
          CURRENT_TIMESTAMP
        FROM "Spending" AS expense_group
        CROSS JOIN "Bank" AS bank
        WHERE expense_group."id" = ${expenseGroupId} AND expense_group."userId" = ${userId}
          AND bank."id" = ${bankId} AND bank."active"
        FOR SHARE OF expense_group, bank
        ON CONFLICT ("expenseGroupId", "bankId") DO UPDATE SET
          "active" = EXCLUDED."active",
          "supportedDebitCard" = EXCLUDED."supportedDebitCard",
          "supportedCreditCard" = EXCLUDED."supportedCreditCard",
          "supportedBankTransfer" = EXCLUDED."supportedBankTransfer",
          "supportedBankPayment" = EXCLUDED."supportedBankPayment",
          "updatedAt" = EXCLUDED."updatedAt"
      `;
      if (written === 0) throw new TypeError(BANK_UNAVAILABLE);
      return expenseGroupId;
    },
  };
}
