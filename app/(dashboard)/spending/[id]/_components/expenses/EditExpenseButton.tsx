"use client";

import ExpenseFormDialog, { type EditableExpense } from "./ExpenseFormDialog";
import type { ExpenseBankOption } from "@/app/lib/expenses/payment";

export default function EditExpenseButton({
  expenseGroupId,
  expense,
  categories,
  bankOptions,
}: {
  expenseGroupId: number;
  expense: EditableExpense;
  categories: { id: number; name: string }[];
  bankOptions: ExpenseBankOption[];
}) {
  return (
    <ExpenseFormDialog
      expenseGroupId={expenseGroupId}
      expense={expense}
      categories={categories}
      bankOptions={bankOptions}
    />
  );
}
