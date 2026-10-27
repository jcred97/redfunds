"use client";

import CreateNameDialog from "@/app/components/CreateNameDialog/CreateNameDialog";
import { createExpenseGroup } from "@/app/(dashboard)/expense-groups/_lib/expense-group.mutations";

export default function NewExpenseGroupButton() {
  return (
    <CreateNameDialog
      triggerLabel="+ New"
      title="New Expense Group"
      description="An expense group is a workspace for your categories and expenses."
      placeholder="e.g. JC Personal"
      pendingMessage="Creating your expense group. Please wait..."
      failureMessage="Unable to create your expense group. Please try again."
      createAction={(formData) => createExpenseGroup(null, formData)}
    />
  );
}
