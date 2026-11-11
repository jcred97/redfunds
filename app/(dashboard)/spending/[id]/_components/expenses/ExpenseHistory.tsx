import Link from "next/link";
import type { getExpensePageByExpenseGroupId } from "@/app/(dashboard)/_lib/expense-groups/queries";
import { formatPesoAmount } from "@/app/lib/expenses/money";
import { formatExpenseDate } from "@/app/lib/expenses/date";
import EditExpenseButton from "./EditExpenseButton";
import DeleteExpenseButton from "./DeleteExpenseButton";

type ExpenseHistoryProps = {
  expenseGroupId: number;
  categories: { id: number; name: string }[];
  expenses: NonNullable<Awaited<ReturnType<typeof getExpensePageByExpenseGroupId>>>["expenses"];
  page: number;
  totalPages: number;
};

const pageLinkClass = "rounded-lg border px-3 py-2 text-sm font-medium";

export default function ExpenseHistory({
  expenseGroupId,
  categories,
  expenses,
  page,
  totalPages,
}: ExpenseHistoryProps) {
  function expenseActions(expense: ExpenseHistoryProps["expenses"][number]) {
    return (
      <div className="flex flex-wrap justify-end gap-2">
        <EditExpenseButton
          expenseGroupId={expenseGroupId}
          categories={categories}
          expense={{
            id: expense.id,
            title: expense.title,
            amountCentavos: expense.amountCentavos,
            date: expense.date.toISOString(),
            updatedAt: expense.updatedAt.toISOString(),
            categoryId: expense.categoryId,
          }}
        />
        <DeleteExpenseButton
          expenseGroupId={expenseGroupId}
          expense={{
            id: expense.id,
            title: expense.title,
            amountCentavos: expense.amountCentavos,
          }}
        />
      </div>
    );
  }

  return (
    <section aria-labelledby="expense-history-title">
      <h2 id="expense-history-title" tabIndex={-1} className="mb-4 text-lg font-semibold">
        Expenses
      </h2>

      <ul className="space-y-3 sm:hidden">
        {expenses.map((expense) => (
          <li key={expense.id} className="rounded-xl border border-gray-800 bg-gray-900 p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h3 className="min-w-0 flex-1 break-words font-medium">
                {expense.title}
              </h3>
              <p className="whitespace-nowrap font-semibold text-red-400">
                {formatPesoAmount(expense.amountCentavos)}
              </p>
            </div>
            <p className="mt-2 break-words text-sm text-gray-400">
              {formatExpenseDate(expense.date)} · {expense.category.name}
            </p>
            <div className="mt-3 flex justify-end">{expenseActions(expense)}</div>
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto rounded-xl border border-gray-800 bg-gray-900 sm:block">
        <table className="w-full text-sm">
          <caption className="sr-only">Expense history</caption>
          <thead>
            <tr className="border-b border-gray-800 text-left text-xs uppercase tracking-wider text-gray-400">
              <th scope="col" className="px-6 py-4">Date</th>
              <th scope="col" className="px-6 py-4">Title</th>
              <th scope="col" className="px-6 py-4">Category</th>
              <th scope="col" className="px-6 py-4">Payment Method</th>
              <th scope="col" className="px-6 py-4">Bank</th>
              <th scope="col" className="px-6 py-4 text-right">Amount</th>
              <th scope="col" className="px-6 py-4">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {expenses.map((expense) => (
              <tr key={expense.id} className="hover:bg-gray-800/50 transition-colors">
                <td className="px-6 py-4 text-gray-400">{formatExpenseDate(expense.date)}</td>
                <td className="px-6 py-4 font-medium">{expense.title}</td>
                <td className="px-6 py-4 text-gray-300">
                  {expense.category.icon && <span aria-hidden="true">{expense.category.icon} </span>}
                  {expense.category.name}
                </td>
                <td className="px-6 py-4 text-gray-400">
                  {expense.paymentMethod ? expense.paymentMethod.replace(/_/g, " ") : "—"}
                </td>
                <td className="px-6 py-4 text-gray-400">
                  {expense.bankAssignment?.bank.name ?? expense.legacyBankName ?? "—"}
                </td>
                <td className="px-6 py-4 text-right font-semibold text-red-400">
                  {formatPesoAmount(expense.amountCentavos)}
                </td>
                <td className="px-6 py-4">{expenseActions(expense)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <nav aria-label="Expense history pages" className="mt-4 flex items-center justify-end gap-3">
          {page > 1 ? (
            <Link
              href={expensePageHref(expenseGroupId, page - 1)}
              prefetch={false}
              className={`${pageLinkClass} border-gray-700 text-gray-200 hover:bg-gray-800`}
            >
              Previous
            </Link>
          ) : (
            <span aria-disabled="true" className={`${pageLinkClass} border-gray-800 text-gray-500`}>
              Previous
            </span>
          )}
          <span className="text-sm text-gray-400">Page {page} of {totalPages}</span>
          {page < totalPages ? (
            <Link
              href={expensePageHref(expenseGroupId, page + 1)}
              prefetch={false}
              className={`${pageLinkClass} border-gray-700 text-gray-200 hover:bg-gray-800`}
            >
              Next
            </Link>
          ) : (
            <span aria-disabled="true" className={`${pageLinkClass} border-gray-800 text-gray-500`}>
              Next
            </span>
          )}
        </nav>
      )}
    </section>
  );
}

function expensePageHref(groupId: number, page: number) {
  const query = page > 1 ? `?page=${page}` : "";
  return `/spending/${groupId}${query}#expense-history-title`;
}
