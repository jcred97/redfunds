"use client";

import { useId, useState } from "react";
import FormDialog from "@/app/components/FormDialog/FormDialog";

type CreateNameDialogProps = {
  triggerLabel: string;
  title: string;
  description: string;
  placeholder: string;
  pendingMessage: string;
  failureMessage: string;
  createAction: (
    formData: FormData
  ) => Promise<{ error: string } | { success: true } | null>;
};

export default function CreateNameDialog({
  placeholder,
  createAction,
  ...dialogProps
}: CreateNameDialogProps) {
  const inputId = useId();
  const [name, setName] = useState("");

  return (
    <FormDialog
      {...dialogProps}
      submitAction={createAction}
      onOpenAction={() => setName("")}
    >
      <div>
        <label htmlFor={inputId} className="block text-sm text-gray-400 mb-2">
          Name
        </label>
        <input
          id={inputId}
          name="name"
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          maxLength={100}
          placeholder={placeholder}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-red-500 transition-colors"
        />
      </div>
    </FormDialog>
  );
}
