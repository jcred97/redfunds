"use client";

import CreateNameDialog from "@/app/components/dialogs/CreateNameDialog";
import { createExpenseGroup } from "@/app/(dashboard)/_lib/expense-groups/mutations";

export default function NewExpenseGroupButton({ inSwitcher = false }: { inSwitcher?: boolean }) {
  return (
    <CreateNameDialog
      triggerVariant={inSwitcher ? "menu" : "primary"}
      triggerLabel={inSwitcher ? (
        <>
          <span aria-hidden="true" className="text-lg leading-none text-red-600">+</span>
          Create new expense group
        </>
      ) : (
        <>
          <span aria-hidden="true">+ </span>New
          <span className="hidden sm:inline"> Expense</span>
          <span className="max-[360px]:sr-only"> Group</span>
        </>
      )}
      title="New Expense Group"
      description="An expense group is a workspace for your categories and expenses."
      placeholder="e.g. JC Personal"
      pendingMessage="Creating your expense group. Please wait..."
      failureMessage="Unable to create your expense group. Please try again."
      createAction={(formData) => createExpenseGroup(null, formData)}
    />
  );
}
