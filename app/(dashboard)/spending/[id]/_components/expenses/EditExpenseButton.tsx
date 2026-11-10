"use client";

import ExpenseFormDialog, { type EditableExpense } from "./ExpenseFormDialog";

export default function EditExpenseButton({
  expenseGroupId,
  expense,
  categories,
}: {
  expenseGroupId: number;
  expense: EditableExpense;
  categories: { id: number; name: string }[];
}) {
  return (
    <ExpenseFormDialog
      expenseGroupId={expenseGroupId}
      expense={expense}
      categories={categories}
    />
  );
}
