"use client";

import { useId, useRef, useState } from "react";
import FormDialog from "@/app/components/dialogs/FormDialog";
import {
  createExpense,
  updateExpense,
} from "@/app/(dashboard)/_lib/expenses/mutations";
import { getManilaToday } from "@/app/lib/expenses/date";
import { formatPesoInput } from "@/app/lib/expenses/money";
import { paymentMethodLabels, type ExpenseBankOption } from "@/app/lib/expenses/payment";
import type { PaymentMethod } from "@/generated/prisma/enums";

export type EditableExpense = {
  id: number;
  title: string;
  amountCentavos: number;
  date: string;
  updatedAt: string;
  categoryId: number;
  paymentMethod: PaymentMethod | null;
  bankAssignmentId: number | null;
  bankName: string | null;
};

type ExpenseFormDialogProps = {
  expenseGroupId: number;
  categories: { id: number; name: string }[];
  bankOptions: ExpenseBankOption[];
  expense?: EditableExpense;
};

export default function ExpenseFormDialog({
  expenseGroupId,
  categories,
  bankOptions,
  expense,
}: ExpenseFormDialogProps) {
  const fieldId = useId();
  const submissionId = useRef("");
  const expectedUpdatedAt = useRef("");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | "">("");
  const [bankAssignmentId, setBankAssignmentId] = useState("");
  const hasCategories = categories.length > 0;
  const canSelectBank = paymentMethod !== "" && paymentMethod !== "CASH";
  const eligibleBanks = canSelectBank
    ? bankOptions.filter((bank) => bank.paymentMethods.includes(paymentMethod))
    : [];
  const bankHelp = paymentMethod === ""
    ? "Choose a payment method to see eligible banks."
    : paymentMethod === "CASH"
      ? "Cash expenses don't use a bank."
      : eligibleBanks.length === 0
        ? "Enable a bank for this payment method in the Banks tab."
        : null;
  const hasRecordedBank =
    expense?.bankName != null &&
    paymentMethod === (expense.paymentMethod ?? "") &&
    bankAssignmentId === String(expense.bankAssignmentId ?? "");
  const showUnavailableBank =
    hasRecordedBank &&
    bankAssignmentId !== "" &&
    !eligibleBanks.some((bank) => String(bank.id) === bankAssignmentId);

  function resetFields() {
    if (expense) {
      expectedUpdatedAt.current = expense.updatedAt;
      setTitle(expense.title);
      setAmount(formatPesoInput(expense.amountCentavos));
      setDate(expense.date.slice(0, 10));
      setCategoryId(String(expense.categoryId));
      setPaymentMethod(expense.paymentMethod ?? "");
      setBankAssignmentId(String(expense.bankAssignmentId ?? ""));
    } else {
      submissionId.current = crypto.randomUUID();
      setTitle("");
      setAmount("");
      setDate(getManilaToday());
      setCategoryId(String(categories[0]?.id ?? ""));
      setPaymentMethod("");
      setBankAssignmentId("");
    }
  }

  function changePaymentMethod(method: PaymentMethod | "") {
    setPaymentMethod(method);
    if (
      method === "" ||
      method === "CASH" ||
      !bankOptions.some(
        (bank) => String(bank.id) === bankAssignmentId && bank.paymentMethods.includes(method)
      )
    ) {
      setBankAssignmentId("");
    }
  }

  async function saveExpenseInGroup(formData: FormData) {
    formData.set("expenseGroupId", String(expenseGroupId));
    formData.set("paymentMethod", paymentMethod);
    formData.set("bankAssignmentId", bankAssignmentId);

    if (expense) {
      formData.set("expenseId", String(expense.id));
      formData.set("expectedUpdatedAt", expectedUpdatedAt.current);

      return updateExpense(null, formData);
    }

    formData.set("submissionId", submissionId.current);
    return createExpense(null, formData);
  }

  const inputClass =
    "mt-2 w-full min-w-0 rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-white outline-none focus:border-red-500 disabled:opacity-60";

  return (
    <div>
      <FormDialog
        triggerLabel={expense ? "Edit" : "+ New Expense"}
        triggerAriaLabel={expense ? `Edit expense: ${expense.title}` : undefined}
        triggerFocusKey={expense ? `expense-${expense.id}` : undefined}
        triggerVariant={expense ? "secondary" : "primary"}
        title={expense ? "Edit Expense" : "New Expense"}
        description={
          expense
            ? "Update this expense in your group."
            : "Record an expense in this group."
        }
        pendingMessage="Saving your expense. Please wait..."
        failureMessage="Unable to save your expense. Please try again."
        submitLabel={expense ? "Save changes" : "Save expense"}
        pendingLabel="Saving..."
        disabled={!hasCategories}
        onOpenAction={resetFields}
        submitAction={saveExpenseInGroup}
      >
        <div>
          <label htmlFor={`${fieldId}-title`} className="text-sm text-gray-400">
            Title
          </label>
          <input
            id={`${fieldId}-title`}
            name="title"
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
            maxLength={100}
            placeholder="e.g. Lunch"
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor={`${fieldId}-amount`} className="text-sm text-gray-400">
            Amount (PHP)
          </label>
          <input
            id={`${fieldId}-amount`}
            name="amount"
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            required
            maxLength={20}
            placeholder="150.75"
            aria-describedby={`${fieldId}-amount-help`}
            className={inputClass}
          />
          <p id={`${fieldId}-amount-help`} className="mt-1 text-xs text-gray-400">
            Enter pesos with up to two decimal places.
          </p>
        </div>

        <div>
          <label htmlFor={`${fieldId}-date`} className="text-sm text-gray-400">
            Date
          </label>
          <input
            id={`${fieldId}-date`}
            name="date"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            required
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor={`${fieldId}-category`} className="text-sm text-gray-400">
            Category
          </label>
          <select
            id={`${fieldId}-category`}
            name="categoryId"
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            required
            className={inputClass}
          >
            <option value="">Select a category</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor={`${fieldId}-payment-method`} className="text-sm text-gray-400">
            Payment method
          </label>
          <select
            id={`${fieldId}-payment-method`}
            name="paymentMethod"
            value={paymentMethod}
            onChange={(event) => changePaymentMethod(event.target.value as PaymentMethod | "")}
            className={inputClass}
          >
            <option value="">No payment method</option>
            {Object.entries(paymentMethodLabels).map(([method, label]) => (
              <option key={method} value={method}>{label}</option>
            ))}
          </select>
        </div>

        {(!expense || canSelectBank) && (
          <div>
            <label htmlFor={`${fieldId}-bank`} className="text-sm text-gray-400">
              Bank <span className="text-xs">(optional)</span>
            </label>
            <select
              id={`${fieldId}-bank`}
              name="bankAssignmentId"
              value={bankAssignmentId}
              onChange={(event) => setBankAssignmentId(event.target.value)}
              disabled={!canSelectBank}
              aria-describedby={bankHelp ? `${fieldId}-bank-help` : undefined}
              className={inputClass}
            >
              <option value="">No bank</option>
              {showUnavailableBank && (
                <option value={bankAssignmentId} disabled>{expense?.bankName} (previously selected)</option>
              )}
              {eligibleBanks.map((bank) => (
                <option key={bank.id} value={bank.id}>{bank.name}</option>
              ))}
            </select>
            {bankHelp && (
              <p id={`${fieldId}-bank-help`} className="mt-1 text-xs text-gray-400">
                {bankHelp}
              </p>
            )}
          </div>
        )}
        {hasRecordedBank && (!canSelectBank || bankAssignmentId === "") && (
          <p className="wrap-anywhere text-sm text-gray-400">Recorded bank: {expense?.bankName}</p>
        )}
      </FormDialog>

      {!hasCategories && (
        <p className="mt-1 text-xs text-gray-400">Create a category first.</p>
      )}
    </div>
  );
}
