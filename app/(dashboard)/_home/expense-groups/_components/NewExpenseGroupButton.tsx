"use client";

import {
  useId,
  useRef,
  useState,
  useTransition,
  type FormEvent,
  type MouseEvent,
} from "react";
import { createExpenseGroup } from "@/app/(dashboard)/expense-groups/_lib/expense-group.mutations";

export default function NewExpenseGroupButton() {
  const dialogId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const submitting = useRef(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [pending, startSaving] = useTransition();

  function openDialog() {
    if (submitting.current || pending || dialogRef.current?.open) {
      return;
    }

    setName("");
    setError("");
    dialogRef.current?.showModal();
  }

  function closeDialog() {
    if (submitting.current || pending) {
      return;
    }

    dialogRef.current?.close();
  }

  function handleBackdropClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target !== event.currentTarget) {
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    const clickedOutside =
      event.clientX < bounds.left ||
      event.clientX > bounds.right ||
      event.clientY < bounds.top ||
      event.clientY > bounds.bottom;

    if (clickedOutside) {
      closeDialog();
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submitting.current || pending) {
      return;
    }

    const formData = new FormData(event.currentTarget);
    submitting.current = true;
    setError("");

    startSaving(async () => {
      try {
        const result = await createExpenseGroup(null, formData);

        if (result && "error" in result) {
          setError(result.error);
        } else if (result && "success" in result) {
          dialogRef.current?.close();
        }
      } catch {
        setError("Unable to create your expense group. Please try again.");
      } finally {
        submitting.current = false;
      }
    });
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-controls={dialogId}
        onClick={openDialog}
        className="flex items-center gap-1.5 bg-red-500 hover:bg-red-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
      >
        + New
      </button>

      <dialog
        ref={dialogRef}
        id={dialogId}
        aria-labelledby={`${dialogId}-title`}
        aria-describedby={`${dialogId}-description`}
        onCancel={(event) => {
          if (submitting.current || pending) {
            event.preventDefault();
          }
        }}
        onClose={() => triggerRef.current?.focus()}
        onClick={handleBackdropClick}
        className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-xl border border-gray-800 bg-gray-900 p-6 text-white backdrop:bg-black/60"
      >
        <h2
          id={`${dialogId}-title`}
          className="text-lg font-semibold text-white mb-1"
        >
          New Expense Group
        </h2>
        <p id={`${dialogId}-description`} className="text-sm text-gray-400 mb-5">
          An expense group is a workspace for your categories and expenses.
        </p>

        <form onSubmit={handleSubmit} aria-busy={pending}>
          <div className="mb-4">
            <label
              htmlFor={`${dialogId}-name`}
              className="block text-sm text-gray-400 mb-2"
            >
              Name
            </label>
            <input
              id={`${dialogId}-name`}
              name="name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={pending}
              required
              maxLength={100}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? `${dialogId}-error` : undefined}
              placeholder="e.g. JC Personal"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-red-500 transition-colors"
            />
          </div>

          {error && (
            <p
              id={`${dialogId}-error`}
              role="alert"
              className="text-red-400 text-sm mb-4"
            >
              {error}
            </p>
          )}

          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={closeDialog}
              disabled={pending}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors disabled:opacity-50"
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

        {pending && (
          <p role="status" className="mt-3 text-sm text-gray-400">
            Creating your expense group. Please wait...
          </p>
        )}
      </dialog>
    </>
  );
}
