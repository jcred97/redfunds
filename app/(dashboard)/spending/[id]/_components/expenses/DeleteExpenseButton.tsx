"use client";

import FormDialog from "@/app/components/dialogs/FormDialog";
import { formatPesoAmount } from "@/app/lib/expenses/money";
import { deleteExpense } from "@/app/(dashboard)/_lib/expenses/mutations";

export default function DeleteExpenseButton({
  expenseGroupId,
  expense,
}: {
  expenseGroupId: number;
  expense: { id: number; title: string; amountCentavos: number };
}) {
  async function confirmDelete(formData: FormData) {
    formData.set("expenseGroupId", String(expenseGroupId));
    formData.set("expenseId", String(expense.id));
    return deleteExpense(null, formData);
  }

  return (
    <FormDialog
      triggerLabel="Delete"
      triggerAriaLabel={`Delete expense: ${expense.title}`}
      triggerFocusKey={`delete-expense-${expense.id}`}
      triggerVariant="danger"
      destructive
      returnFocusId="expense-group-title"
      title="Delete expense?"
      description="This permanently removes the expense and updates your totals. This cannot be undone."
      onOpenAction={() => {}}
      submitLabel="Delete expense"
      pendingLabel="Deleting..."
      pendingMessage="Deleting expense..."
      failureMessage="Unable to delete the expense. Please try again."
      submitAction={confirmDelete}
    >
      <p className="break-words font-medium">{expense.title}</p>
      <p className="text-red-400">{formatPesoAmount(expense.amountCentavos)}</p>
    </FormDialog>
  );
}
