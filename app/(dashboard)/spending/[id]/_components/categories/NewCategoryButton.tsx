"use client";

import CreateNameDialog from "@/app/components/dialogs/CreateNameDialog";
import { createCategory } from "@/app/(dashboard)/_lib/categories/mutations";

export default function NewCategoryButton({
  expenseGroupId,
}: {
  expenseGroupId: number;
}) {
  async function createCategoryInGroup(formData: FormData) {
    formData.set("expenseGroupId", String(expenseGroupId));

    return createCategory(null, formData);
  }

  return (
    <CreateNameDialog
      triggerLabel="+ New Category"
      title="New Category"
      description="Categories organize the expenses in this group."
      placeholder="e.g. Food or Transport"
      pendingMessage="Creating your category. Please wait..."
      failureMessage="Unable to create your category. Please try again."
      createAction={createCategoryInGroup}
    />
  );
}
