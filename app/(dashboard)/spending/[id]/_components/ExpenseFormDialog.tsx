"use client";

import { useId, useState } from "react";
import FormDialog from "@/app/components/FormDialog/FormDialog";
import {
  createExpense,
  updateExpense,
} from "@/app/(dashboard)/expense-groups/_lib/expense.mutations";
import { getManilaToday } from "@/app/lib/expense-date";
import { formatPesoInput } from "@/app/lib/money";

export type EditableExpense = {
  id: number;
  title: string;
  amountCentavos: number;
  date: string;
  categoryId: number;
};

type ExpenseFormDialogProps = {
  expenseGroupId: number;
  categories: { id: number; name: string }[];
  expense?: EditableExpense;
};

export default function ExpenseFormDialog({
  expenseGroupId,
  categories,
  expense,
}: ExpenseFormDialogProps) {
  const fieldId = useId();
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const hasCategories = categories.length > 0;

  function resetFields() {
    if (expense) {
      setTitle(expense.title);
      setAmount(formatPesoInput(expense.amountCentavos));
      setDate(expense.date.slice(0, 10));
      setCategoryId(String(expense.categoryId));
    } else {
      setTitle("");
      setAmount("");
      setDate(getManilaToday());
      setCategoryId(String(categories[0]?.id ?? ""));
    }
  }

  async function saveExpenseInGroup(formData: FormData) {
    formData.set("expenseGroupId", String(expenseGroupId));

    if (expense) {
      formData.set("expenseId", String(expense.id));

      return updateExpense(null, formData);
    }

    return createExpense(null, formData);
  }

  const inputClass =
    "mt-2 w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-white outline-none focus:border-red-500 disabled:opacity-60";

  return (
    <div>
      <FormDialog
        triggerLabel={expense ? "Edit" : "+ New Expense"}
        triggerAriaLabel={expense ? `Edit expense: ${expense.title}` : undefined}
        triggerFocusKey={expense ? `expense-${expense.id}` : undefined}
        triggerVariant={expense ? "secondary" : "primary"}
        title={expense ? "Edit Expense" : "New Expense"}
        description={
          expense
            ? "Update this expense in your group."
            : "Record an expense in this group."
        }
        pendingMessage="Saving your expense. Please wait..."
        failureMessage="Unable to save your expense. Please try again."
        submitLabel={expense ? "Save changes" : "Save expense"}
        pendingLabel="Saving..."
        disabled={!hasCategories}
        onOpenAction={resetFields}
        submitAction={saveExpenseInGroup}
      >
        <div>
          <label htmlFor={`${fieldId}-title`} className="text-sm text-gray-400">
            Title
          </label>
          <input
            id={`${fieldId}-title`}
            name="title"
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
            maxLength={100}
            placeholder="e.g. Lunch"
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor={`${fieldId}-amount`} className="text-sm text-gray-400">
            Amount (PHP)
          </label>
          <input
            id={`${fieldId}-amount`}
            name="amount"
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            required
            maxLength={20}
            placeholder="150.75"
            aria-describedby={`${fieldId}-amount-help`}
            className={inputClass}
          />
          <p id={`${fieldId}-amount-help`} className="mt-1 text-xs text-gray-400">
            Enter pesos with up to two decimal places.
          </p>
        </div>

        <div>
          <label htmlFor={`${fieldId}-date`} className="text-sm text-gray-400">
            Date
          </label>
          <input
            id={`${fieldId}-date`}
            name="date"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            required
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor={`${fieldId}-category`} className="text-sm text-gray-400">
            Category
          </label>
          <select
            id={`${fieldId}-category`}
            name="categoryId"
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            required
            className={inputClass}
          >
            <option value="">Select a category</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
      </FormDialog>

      {!hasCategories && (
        <p className="mt-1 text-xs text-gray-400">Create a category first.</p>
      )}
    </div>
  );
}
