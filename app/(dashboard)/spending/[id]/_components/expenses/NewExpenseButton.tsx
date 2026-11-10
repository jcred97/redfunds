"use client";

import ExpenseFormDialog from "./ExpenseFormDialog";

export default function NewExpenseButton({
  expenseGroupId,
  categories,
}: {
  expenseGroupId: number;
  categories: { id: number; name: string }[];
}) {
  return (
    <ExpenseFormDialog expenseGroupId={expenseGroupId} categories={categories} />
  );
}
