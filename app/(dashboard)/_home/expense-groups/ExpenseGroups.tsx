import { Suspense } from "react";
import { formatPesoAmount, sumCentavos } from "@/app/lib/expenses/money";
import { getExpenseGroups } from "@/app/(dashboard)/_lib/expense-groups/queries";
import ExpenseGroupSettings from "@/app/(dashboard)/_components/expense-groups/ExpenseGroupSettings";
import NewExpenseGroupButton from "@/app/(dashboard)/_components/expense-groups/NewExpenseGroupButton";
import ExpenseGroupLink from "./_components/ExpenseGroupLink";
import ExpenseGroupsSkeleton from "./_components/ExpenseGroupsSkeleton";

export default function ExpenseGroups() {
  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
      <div className="mb-8 flex items-center gap-2 sm:gap-4">
        <h1 id="expense-groups-title" tabIndex={-1} className="min-w-0 wrap-break-word text-lg font-semibold sm:text-2xl">
          Your Expense Groups
        </h1>
        <div className="ml-auto shrink-0 whitespace-nowrap max-sm:[&>button]:px-2.5 max-sm:[&>button]:text-xs">
          <NewExpenseGroupButton />
        </div>
      </div>

      <Suspense fallback={<ExpenseGroupsSkeleton />}>
        <ExpenseGroupCards />
      </Suspense>
    </main>
  );
}

async function ExpenseGroupCards() {
  const expenseGroups = await getExpenseGroups();

  return (
    <>
      {expenseGroups.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 text-center">
          <div className="w-16 h-16 bg-gray-900 border border-gray-800 rounded-full flex items-center justify-center mb-4">
            <span className="text-2xl">💰</span>
          </div>
          <p className="text-gray-300 font-medium">No expense groups yet</p>
          <p className="text-gray-500 text-sm mt-1">
            Create your first expense group to start tracking expenses.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {expenseGroups.map((expenseGroup) => {
            const totalCentavos = sumCentavos(
              expenseGroup.categories.flatMap((category) =>
                category.expenses.map((expense) => expense.amountCentavos)
              )
            );
            const totalExpenses = expenseGroup.categories.reduce(
              (expenseCount, category) => expenseCount + category._count.expenses,
              0
            );

            return (
              <article key={expenseGroup.id} className="relative">
                <ExpenseGroupLink id={expenseGroup.id}>
                  <div className="group cursor-pointer rounded-xl border border-gray-800 bg-gray-900 p-6 transition-all hover:border-red-500/50 hover:bg-gray-800/80">
                    <h2 className="mb-4 wrap-anywhere pr-10 text-lg leading-tight font-semibold text-white transition-colors group-hover:text-red-400">
                      {expenseGroup.name}
                    </h2>

                    <p className="mb-4 text-3xl font-bold tracking-tight text-white">
                      {formatPesoAmount(totalCentavos)}
                    </p>

                    <div className="flex gap-3 text-sm text-gray-400">
                      <span>{expenseGroup._count.categories} categories</span>
                      <span>·</span>
                      <span>{totalExpenses} expenses</span>
                    </div>
                  </div>
                </ExpenseGroupLink>
                <div className="absolute top-4 right-4">
                  <ExpenseGroupSettings
                    group={{ id: expenseGroup.id, name: expenseGroup.name }}
                    onGroupList
                  />
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
