"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import {
  deleteExpenseGroup,
  duplicateExpenseGroup,
  renameExpenseGroup,
} from "@/app/(dashboard)/_lib/expense-groups/mutations";
import FormDialog from "@/app/components/dialogs/FormDialog";

const menuItemClass =
  "flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left text-sm font-medium transition-colors hover:bg-gray-800 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-red-400";

const iconPaths = {
  settings: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm-2-5h4l.5 2.3 1.8 1 2.2-.7 2 3.4-1.7 1.6v2.8l1.7 1.6-2 3.4-2.2-.7-1.8 1-.5 2.3h-4l-.5-2.3-1.8-1-2.2.7-2-3.4 1.7-1.6v-2.8L3.5 9l2-3.4 2.2.7 1.8-1L10 3Z",
  edit: "m14.5 6.5 3 3M4 20l4-.8L20 7.2a2.1 2.1 0 0 0-3-3L5 16l-1 4Z",
  currency: "M12 2v20m4-16H9a3 3 0 0 0 0 6h6a3 3 0 0 1 0 6H7",
  duplicate: "M8 16H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v3M10 8h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2Z",
  delete: "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5m4-5v5",
  close: "m6 6 12 12M6 18 18 6",
};

function SettingsIcon({ name }: { name: keyof typeof iconPaths }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4 shrink-0"
    >
      <path d={iconPaths[name]} />
    </svg>
  );
}

export default function ExpenseGroupSettings({
  group,
  tabSuffix = "",
  onGroupList = false,
}: {
  group: { id: number; name: string };
  tabSuffix?: string;
  onGroupList?: boolean;
}) {
  const router = useRouter();
  const settingsId = useId();
  const panelId = useId();
  const nameId = useId();
  const currencyId = useId();
  const settingsRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const currencyRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    function closeOnOutsideClick(event: PointerEvent) {
      if (event.target instanceof Node && !settingsRef.current?.contains(event.target)) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [open]);

  function closeMenu() {
    setOpen(false);
  }

  async function duplicate() {
    const result = await duplicateExpenseGroup(group.id);
    if ("success" in result) router.push(`/spending/${result.id}${tabSuffix}`);
    return result;
  }

  async function remove() {
    const result = await deleteExpenseGroup(group.id);
    if ("success" in result) {
      if (onGroupList) {
        requestAnimationFrame(() => document.getElementById("expense-groups-title")?.focus());
      } else {
        router.replace("/");
      }
    }
    return result;
  }

  return (
    <div
      ref={settingsRef}
      className="relative shrink-0"
      onBlur={(event) => {
        if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) closeMenu();
      }}
      onKeyDown={(event) => {
        if (open && event.key === "Escape" && event.currentTarget.contains(event.target as Node)) {
          event.stopPropagation();
          closeMenu();
          triggerRef.current?.focus();
        }
      }}
    >
      <button
        id={settingsId}
        ref={triggerRef}
        type="button"
        aria-label={onGroupList ? `Settings for ${group.name}` : undefined}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(!open)}
        className="flex min-h-10 min-w-10 cursor-pointer items-center justify-center gap-2 rounded-md px-2 py-2 text-sm font-medium text-gray-300 transition-colors hover:bg-gray-800 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400"
      >
        <SettingsIcon name="settings" />
        {!onGroupList && "Settings"}
      </button>

      <div
        id={panelId}
        hidden={!open}
        className="absolute top-full right-0 z-10 mt-2 w-60 max-w-[calc(100vw-3rem)] overflow-hidden rounded-lg border border-gray-800 bg-gray-900 py-1 text-gray-200 shadow-xl"
      >
        <FormDialog
          triggerLabel={
            <>
              <SettingsIcon name="edit" />
              Edit Name
            </>
          }
          triggerClassName={menuItemClass}
          returnFocusId={settingsId}
          title="Edit expense group name"
          description="Enter a new name for this expense group."
          onOpenAction={closeMenu}
          submitLabel="Save name"
          pendingLabel="Saving…"
          pendingMessage="Renaming expense group…"
          failureMessage="Unable to rename the expense group. Please try again."
          submitAction={(formData) => renameExpenseGroup(group.id, formData)}
        >
          <label htmlFor={nameId} className="block text-sm text-gray-300">
            Name
            <input
              id={nameId}
              name="name"
              defaultValue={group.name}
              required
              maxLength={100}
              className="mt-2 w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-white focus:border-red-500 focus:outline-none"
            />
          </label>
        </FormDialog>

        <button
          type="button"
          aria-haspopup="dialog"
          aria-controls={currencyId}
          className={menuItemClass}
          onClick={() => {
            closeMenu();
            currencyRef.current?.showModal();
          }}
        >
          <SettingsIcon name="currency" />
          Change Currency
        </button>

        <FormDialog
          triggerLabel={
            <>
              <SettingsIcon name="duplicate" />
              Duplicate Expense Group
            </>
          }
          triggerClassName={menuItemClass}
          returnFocusId={settingsId}
          title="Duplicate expense group?"
          description="This creates a separate copy with the same categories, expenses, budgets, and bank assignments."
          onOpenAction={closeMenu}
          submitLabel="Duplicate group"
          pendingLabel="Duplicating…"
          pendingMessage="Duplicating expense group…"
          failureMessage="Unable to duplicate the expense group. Please try again."
          submitAction={duplicate}
        >
          <p className="wrap-anywhere font-medium">{group.name}</p>
        </FormDialog>

        <FormDialog
          triggerLabel={
            <>
              <SettingsIcon name="delete" />
              Delete Expense Group
            </>
          }
          triggerClassName={`${menuItemClass} text-red-400 hover:bg-red-500/10`}
          destructive
          returnFocusId={settingsId}
          title="Delete expense group?"
          description="This permanently removes the group. Only empty expense groups can be deleted."
          onOpenAction={closeMenu}
          submitLabel="Delete group"
          pendingLabel="Deleting…"
          pendingMessage="Deleting expense group…"
          failureMessage="Unable to delete the expense group. Please try again."
          submitAction={remove}
        >
          <p className="wrap-anywhere font-medium">{group.name}</p>
        </FormDialog>
      </div>

      <dialog
        ref={currencyRef}
        id={currencyId}
        aria-labelledby={`${currencyId}-title`}
        aria-describedby={`${currencyId}-status`}
        onClose={() => triggerRef.current?.focus()}
        className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-xl border border-gray-800 bg-gray-900 p-6 text-white backdrop:bg-black/60"
      >
        <form method="dialog">
          <div className="flex items-center justify-between gap-4">
            <h2 id={`${currencyId}-title`} className="text-lg font-semibold">Select a currency</h2>
            <button
              type="submit"
              aria-label="Close currency dialog"
              className="cursor-pointer rounded-md p-2 text-gray-400 hover:bg-gray-800 hover:text-white focus-visible:outline-2 focus-visible:outline-red-400"
            >
              <SettingsIcon name="close" />
            </button>
          </div>
          <label className="mt-6 block text-sm font-medium text-gray-300">
            Expense Group Currency
            <select
              disabled
              className="mt-2 w-full cursor-not-allowed rounded-lg border border-gray-700 bg-gray-800 px-3 py-2.5 text-gray-300 disabled:opacity-70"
            >
              <option>PHP – Philippine peso</option>
            </select>
          </label>
          <p id={`${currencyId}-status`} className="mt-3 text-sm text-gray-400">
            Currency changes are still in development.
          </p>
          <div className="mt-8 flex justify-end">
            <button
              type="submit"
              className="cursor-pointer rounded-lg border border-gray-700 px-4 py-2 text-sm font-medium text-gray-200 hover:bg-gray-800 focus-visible:outline-2 focus-visible:outline-red-400"
            >
              Close
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
