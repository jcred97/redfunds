"use client";

import { useEffect, useRef, useState, useActionState } from "react";
import {
  createExpenseGroup,
  type ActionState,
} from "@/app/(dashboard)/expense-groups/_lib/expense-group.mutations";

export default function NewExpenseGroupButton() {
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, action, pending] = useActionState(
    async (previousState: ActionState, formData: FormData) => {
      const result = await createExpenseGroup(previousState, formData);
      if (result && "success" in result) {
        setOpen(false);
      }
      return result;
    },
    null
  );

  // Focus input when modal opens
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 bg-red-500 hover:bg-red-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
      >
        + New
      </button>

      {open && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 w-full max-w-md mx-4">
            <h2 className="text-lg font-semibold text-white mb-1">
              New Expense Group
            </h2>
            <p className="text-sm text-gray-400 mb-5">
              An expense group is a workspace for your categories and expenses.
            </p>

            <form action={action}>
              <div className="mb-4">
                <label className="block text-sm text-gray-400 mb-2">
                  Name
                </label>
                <input
                  ref={inputRef}
                  name="name"
                  type="text"
                  placeholder="e.g. JC Personal"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-red-500 transition-colors"
                />
              </div>

              {state && "error" in state && (
                <p className="text-red-400 text-sm mb-4">{state.error}</p>
              )}

              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="px-4 py-2 text-sm bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  {pending ? "Creating..." : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
