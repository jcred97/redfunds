"use client";

import { useState } from "react";
import type { BankCatalogEntry } from "@/app/(dashboard)/_lib/banks/access";
import { saveBankAssignment } from "@/app/(dashboard)/_lib/banks/mutations";
import FormDialog from "@/app/components/dialogs/FormDialog";
import BankLogo from "./BankLogo";

const paymentMethods = [
  { name: "supportedDebitCard", label: "Debit card" },
  { name: "supportedCreditCard", label: "Credit card" },
  { name: "supportedBankTransfer", label: "Bank transfer" },
  { name: "supportedBankPayment", label: "Bank payment" },
] as const;

const checkboxClass =
  "size-4 shrink-0 accent-red-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400";

export default function BankSettingsDialog({
  expenseGroupId,
  bank,
}: {
  expenseGroupId: number;
  bank: BankCatalogEntry;
}) {
  const savedEnabled = bank.assignment?.active ?? false;
  const [enabled, setEnabled] = useState(savedEnabled);
  const status = bank.active ? (savedEnabled ? "Enabled" : "Not enabled") : "Unavailable";
  const statusColor = bank.active && savedEnabled ? "text-emerald-400" : "text-gray-400";

  async function save(formData: FormData) {
    formData.set("expenseGroupId", String(expenseGroupId));
    formData.set("bankId", String(bank.id));
    return saveBankAssignment(formData);
  }

  return (
    <FormDialog
      triggerLabel={(
        <>
          <BankLogo name={bank.name} />
          <span className="min-w-0">
            <span className="block wrap-anywhere font-medium">{bank.name}</span>
            <span className={`mt-1 block ${statusColor}`}>{status}</span>
          </span>
        </>
      )}
      triggerClassName="flex h-full w-full cursor-pointer items-center gap-3 rounded-lg border border-gray-800 bg-gray-900 px-4 py-3 text-left text-sm transition-colors hover:border-gray-600 hover:bg-gray-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400"
      title={bank.name}
      description={
        bank.active
          ? "Choose how you use this bank in this expense group."
          : "This bank is unavailable for new use."
      }
      onOpenAction={() => setEnabled(savedEnabled)}
      submitLabel="Save changes"
      pendingLabel="Saving..."
      pendingMessage="Saving bank settings..."
      failureMessage="Unable to save bank settings. Please try again."
      submitAction={save}
    >
      <label className="flex min-h-11 items-center gap-3 rounded-lg border border-gray-700 px-3 py-2 text-sm font-medium has-disabled:opacity-60">
        <input
          type="checkbox"
          name="active"
          checked={enabled}
          disabled={!bank.active && !savedEnabled}
          onChange={(event) => setEnabled(event.target.checked)}
          className={checkboxClass}
        />
        Enable for this expense group
      </label>

      <fieldset disabled={!enabled || !bank.active} className="disabled:opacity-60">
        <legend className="mb-1 text-sm font-medium">Payment methods</legend>
        {paymentMethods.map(({ name, label }) => (
          <label key={name} className="flex min-h-11 items-center gap-3 text-sm text-gray-200">
            <input
              type="checkbox"
              name={name}
              defaultChecked={bank.assignment?.[name] ?? false}
              className={checkboxClass}
            />
            {label}
          </label>
        ))}
      </fieldset>
    </FormDialog>
  );
}
