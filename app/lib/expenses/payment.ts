import type { PaymentMethod } from "@/generated/prisma/enums";

export const paymentMethodLabels = {
  CASH: "Cash",
  DEBIT_CARD: "Debit card",
  CREDIT_CARD: "Credit card",
  BANK_TRANSFER: "Bank transfer",
  BANK_PAYMENT: "Bank payment",
} satisfies Record<PaymentMethod, string>;

export const bankPaymentMethodFields = {
  DEBIT_CARD: "supportedDebitCard",
  CREDIT_CARD: "supportedCreditCard",
  BANK_TRANSFER: "supportedBankTransfer",
  BANK_PAYMENT: "supportedBankPayment",
} as const satisfies Record<Exclude<PaymentMethod, "CASH">, string>;

export type BankPaymentMethod = keyof typeof bankPaymentMethodFields;

export type ExpenseBankOption = {
  id: number;
  name: string;
  paymentMethods: BankPaymentMethod[];
};
