import Link from "next/link";
import { formatPesoAmount, sumCentavos } from "@/app/lib/money";
import { getSpendings } from "@/app/(dashboard)/spending/_lib/spending.queries";
import NewSpendingButton from "./_components/NewSpendingButton";

export default async function Spendings() {
  const spendings = await getSpendings();

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight">
            Red<span className="text-red-500">Funds</span>
          </h1>
          <NewSpendingButton />
        </div>
      </header>

      {/* Main */}
      <main className="max-w-6xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h2 className="text-2xl font-semibold">Your Spendings</h2>
          <p className="text-gray-400 mt-1">
            Select a spending to view its categories and expenses.
          </p>
        </div>

        {spendings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <div className="w-16 h-16 bg-gray-900 border border-gray-800 rounded-full flex items-center justify-center mb-4">
              <span className="text-2xl">💰</span>
            </div>
            <p className="text-gray-300 font-medium">No spendings yet</p>
            <p className="text-gray-500 text-sm mt-1">
              Click &quot;+ New&quot; to create your first spending.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {spendings.map((spending) => {
              const totalCentavos = sumCentavos(
                spending.categories.flatMap((category) =>
                  category.expenses.map((expense) => expense.amountCentavos)
                )
              );
              const totalExpenses = spending.categories.reduce(
                (sum, cat) => sum + cat._count.expenses,
                0
              );

              return (
                <Link key={spending.id} href={`/spending/${spending.id}`}>
                  <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 hover:border-red-500/50 hover:bg-gray-800/80 transition-all cursor-pointer group">
                    <div className="flex items-start justify-between mb-4">
                      <h3 className="font-semibold text-white text-lg group-hover:text-red-400 transition-colors leading-tight">
                        {spending.name}
                      </h3>
                      <span className="text-red-500 text-xs font-medium bg-red-500/10 px-2 py-1 rounded-full shrink-0 ml-2">
                        Active
                      </span>
                    </div>

                    <p className="text-3xl font-bold text-white mb-4 tracking-tight">
                      {formatPesoAmount(totalCentavos)}
                    </p>

                    <div className="flex gap-3 text-sm text-gray-400">
                      <span>{spending._count.categories} categories</span>
                      <span>·</span>
                      <span>{totalExpenses} expenses</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
