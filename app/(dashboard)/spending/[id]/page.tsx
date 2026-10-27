import Link from "next/link";
import { notFound } from "next/navigation";
import { formatPesoAmount, sumCentavos } from "@/app/lib/money";
import ExpenseHistory from "./_components/ExpenseHistory";
import NewCategoryButton from "./_components/NewCategoryButton";
import NewExpenseButton from "./_components/NewExpenseButton";
import {
  getExpenseGroupById,
  getExpensesByExpenseGroupId,
} from "@/app/(dashboard)/expense-groups/_lib/expense-group.queries";

export default async function ExpenseGroupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: rawId } = await params;
  const id = Number(rawId);

  const [expenseGroup, expenses] = await Promise.all([
    getExpenseGroupById(id),
    getExpensesByExpenseGroupId(id),
  ]);

  if (!expenseGroup) {
    notFound();
  }

  const totalCentavos = sumCentavos(
    expenses.map((expense) => expense.amountCentavos)
  );

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href="/"
              className="text-gray-400 hover:text-white transition-colors text-sm"
            >
              ← Back
            </Link>
            <span className="text-gray-700">|</span>
            <h1 className="break-words text-xl font-bold">{expenseGroup.name}</h1>
          </div>
          <NewExpenseButton
            expenseGroupId={expenseGroup.id}
            categories={expenseGroup.categories.map((category) => ({
              id: category.id,
              name: category.name,
            }))}
          />
        </div>
      </header>

      {/* Main */}
      <main className="max-w-6xl mx-auto px-6 py-10">
        {/* Summary */}
        <div className="grid grid-cols-1 gap-4 mb-8 sm:grid-cols-3">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <p className="text-sm text-gray-400 mb-1">Total Spent</p>
            <p className="text-2xl font-bold text-white">
              {formatPesoAmount(totalCentavos)}
            </p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <p className="text-sm text-gray-400 mb-1">Expenses</p>
            <p className="text-2xl font-bold text-white">{expenses.length}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <p className="text-sm text-gray-400 mb-1">Categories</p>
            <p className="text-2xl font-bold text-white">
              {expenseGroup.categories.length}
            </p>
          </div>
        </div>

        <section className="mb-8" aria-labelledby="categories-title">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 id="categories-title" className="text-lg font-semibold">
              Categories
            </h2>
            <NewCategoryButton expenseGroupId={expenseGroup.id} />
          </div>

          {expenseGroup.categories.length === 0 ? (
            <p className="rounded-xl border border-gray-800 bg-gray-900 p-5 text-sm text-gray-400">
              No categories yet. Add one such as Food or Transport.
            </p>
          ) : (
            <ul className="flex flex-wrap gap-3">
              {expenseGroup.categories.map((category) => (
                <li
                  key={category.id}
                  className="min-w-0 max-w-full rounded-lg border border-gray-800 bg-gray-900 px-4 py-3 text-sm"
                >
                  <span className="break-words font-medium">
                    {category.icon && (
                      <span aria-hidden="true">{category.icon} </span>
                    )}
                    {category.name}
                  </span>
                  <span className="ml-2 text-gray-400">
                    {category._count.expenses} expenses
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Table */}
        {expenses.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <div className="w-16 h-16 bg-gray-900 border border-gray-800 rounded-full flex items-center justify-center mb-4">
              <span className="text-2xl">💸</span>
            </div>
            <p className="text-gray-300 font-medium">No expenses yet</p>
            <p className="text-gray-500 text-sm mt-1">
              Click &quot;+ New Expense&quot; to add your first expense.
            </p>
          </div>
        ) : (
          <ExpenseHistory
            expenseGroupId={expenseGroup.id}
            categories={expenseGroup.categories.map((category) => ({
              id: category.id,
              name: category.name,
            }))}
            expenses={expenses}
          />
        )}
      </main>
    </div>
  );
}
