"use client";

import {
  useId,
  useRef,
  useState,
  useTransition,
  type FormEvent,
  type MouseEvent,
  type ReactNode,
} from "react";

type CreateDialogProps = {
  triggerLabel: string;
  title: string;
  description: string;
  children: ReactNode;
  onOpenAction: () => void;
  disabled?: boolean;
  submitLabel?: string;
  pendingLabel?: string;
  pendingMessage: string;
  failureMessage: string;
  createAction: (
    formData: FormData
  ) => Promise<{ error: string } | { success: true } | null>;
};

export default function CreateDialog({
  triggerLabel,
  title,
  description,
  children,
  onOpenAction,
  disabled = false,
  submitLabel = "Create",
  pendingLabel = "Creating...",
  pendingMessage,
  failureMessage,
  createAction,
}: CreateDialogProps) {
  const dialogId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const submitting = useRef(false);
  const [error, setError] = useState("");
  const [pending, startSaving] = useTransition();

  function openDialog() {
    if (disabled || submitting.current || pending || dialogRef.current?.open) {
      return;
    }

    onOpenAction();
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

    if (disabled || submitting.current || pending) {
      return;
    }

    const formData = new FormData(event.currentTarget);
    submitting.current = true;
    setError("");

    startSaving(async () => {
      try {
        const result = await createAction(formData);

        if (result && "error" in result) {
          setError(result.error);
        } else if (result && "success" in result) {
          dialogRef.current?.close();
        }
      } catch {
        setError(failureMessage);
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
        disabled={disabled}
        className="flex cursor-pointer items-center gap-1.5 bg-red-500 hover:bg-red-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-50"
      >
        {triggerLabel}
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
          {title}
        </h2>
        <p id={`${dialogId}-description`} className="text-sm text-gray-400 mb-5">
          {description}
        </p>

        <form
          onSubmit={handleSubmit}
          aria-busy={pending}
          aria-describedby={error ? `${dialogId}-error` : undefined}
        >
          <fieldset disabled={pending} className="mb-4 space-y-4">
            {children}
          </fieldset>

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
              className="cursor-pointer px-4 py-2 text-sm bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors disabled:cursor-wait disabled:opacity-50"
            >
              {pending ? pendingLabel : submitLabel}
            </button>
          </div>
        </form>

        {pending && (
          <p role="status" className="mt-3 text-sm text-gray-400">
            {pendingMessage}
          </p>
        )}
      </dialog>
    </>
  );
}
