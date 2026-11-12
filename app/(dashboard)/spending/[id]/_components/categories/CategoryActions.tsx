"use client";

import { useId } from "react";
import FormDialog from "@/app/components/dialogs/FormDialog";
import {
  deleteCategory,
  updateCategory,
} from "@/app/(dashboard)/_lib/categories/mutations";

type CategoryActionsProps = {
  expenseGroupId: number;
  category: { id: number; name: string };
  expenseCount: number;
};

export default function CategoryActions({
  expenseGroupId,
  category,
  expenseCount,
}: CategoryActionsProps) {
  const nameId = useId();

  async function rename(formData: FormData) {
    formData.set("expenseGroupId", String(expenseGroupId));
    formData.set("categoryId", String(category.id));
    return updateCategory(null, formData);
  }

  async function remove(formData: FormData) {
    formData.set("expenseGroupId", String(expenseGroupId));
    formData.set("categoryId", String(category.id));
    return deleteCategory(null, formData);
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <FormDialog
        triggerLabel="Rename"
        triggerAriaLabel={`Rename category: ${category.name}`}
        triggerVariant="secondary"
        title="Rename category"
        description="Enter a new name for this category."
        onOpenAction={() => {}}
        submitLabel="Save name"
        pendingLabel="Saving..."
        pendingMessage="Renaming category..."
        failureMessage="Unable to rename the category. Please try again."
        submitAction={rename}
      >
        <div>
          <label htmlFor={nameId} className="mb-2 block text-sm text-gray-400">
            Name
          </label>
          <input
            id={nameId}
            name="name"
            type="text"
            defaultValue={category.name}
            required
            maxLength={100}
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-white transition-colors focus:border-red-400 focus:outline-none"
          />
        </div>
      </FormDialog>

      {expenseCount === 0 ? (
        <FormDialog
          triggerLabel="Delete"
          triggerAriaLabel={`Delete category: ${category.name}`}
          triggerVariant="danger"
          destructive
          returnFocusId="expense-group-title"
          title="Delete category?"
          description="This permanently removes the empty category."
          onOpenAction={() => {}}
          submitLabel="Delete category"
          pendingLabel="Deleting..."
          pendingMessage="Deleting category..."
          failureMessage="Unable to delete the category. Please try again."
          submitAction={remove}
        >
          <p className="break-words font-medium">{category.name}</p>
        </FormDialog>
      ) : (
        <p className="basis-full text-xs text-gray-400">
          Move or delete its expenses first to delete this category.
        </p>
      )}
    </div>
  );
}
