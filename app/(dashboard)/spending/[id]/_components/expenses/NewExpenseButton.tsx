"use client";

import ExpenseFormDialog from "./ExpenseFormDialog";
import type { ExpenseBankOption } from "@/app/lib/expenses/payment";

export default function NewExpenseButton({
  expenseGroupId,
  categories,
  bankOptions,
}: {
  expenseGroupId: number;
  categories: { id: number; name: string }[];
  bankOptions: ExpenseBankOption[];
}) {
  return (
    <ExpenseFormDialog expenseGroupId={expenseGroupId} categories={categories} bankOptions={bankOptions} />
  );
}
