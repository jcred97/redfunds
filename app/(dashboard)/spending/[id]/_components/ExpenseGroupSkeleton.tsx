import Link from "next/link";
import Skeleton from "@/app/components/Skeleton/Skeleton";

export default function ExpenseGroupSkeleton() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <p role="status" className="sr-only">
        Loading expense group...
      </p>

      <header className="border-b border-gray-800 px-6 py-4">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href="/"
              className="text-sm text-gray-400 transition-colors hover:text-white"
            >
              ← Back
            </Link>
            <span aria-hidden="true" className="text-gray-700">|</span>
            <Skeleton className="h-7 w-36 sm:w-48" />
          </div>
          <Skeleton className="h-10 w-36 rounded-lg" />
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-6 py-10">
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {["Total Spent", "Expenses", "Categories"].map((label) => (
            <div
              key={label}
              className="rounded-xl border border-gray-800 bg-gray-900 p-5"
            >
              <p className="mb-1 text-sm text-gray-400">{label}</p>
              <Skeleton className="h-8 w-28" />
            </div>
          ))}
        </div>

        <section className="mb-8" aria-labelledby="loading-categories-title">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 id="loading-categories-title" className="text-lg font-semibold">
              Categories
            </h2>
            <Skeleton className="h-10 w-36 rounded-lg" />
          </div>
          <div aria-hidden="true" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((index) => (
              <div
                key={index}
                className="rounded-lg border border-gray-800 bg-gray-900 px-4 py-3"
              >
                <Skeleton className="h-5 w-32" />
                <Skeleton className="mt-1 h-5 w-20" />
                <div className="mt-3 flex gap-2">
                  <Skeleton className="h-9 w-20 rounded-lg" />
                  <Skeleton className="h-9 w-16 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="loading-expenses-title">
          <h2 id="loading-expenses-title" className="mb-4 text-lg font-semibold">
            Expenses
          </h2>

          <div aria-hidden="true" className="space-y-3 sm:hidden">
            {[0, 1, 2].map((index) => (
              <div
                key={index}
                className="rounded-xl border border-gray-800 bg-gray-900 p-4"
              >
                <div className="flex justify-between gap-3">
                  <Skeleton className="h-6 w-1/2" />
                  <Skeleton className="h-6 w-20" />
                </div>
                <Skeleton className="mt-2 h-5 w-2/3" />
                <div className="mt-3 flex justify-end">
                  <Skeleton className="h-9 w-16 rounded-lg" />
                </div>
              </div>
            ))}
          </div>

          <div
            aria-hidden="true"
            className="hidden rounded-xl border border-gray-800 bg-gray-900 sm:block"
          >
            <div className="grid grid-cols-7 gap-4 border-b border-gray-800 px-6 py-4">
              {Array.from({ length: 7 }, (_, index) => (
                <Skeleton key={index} className="h-4 w-full" />
              ))}
            </div>
            {[0, 1, 2, 3, 4].map((row) => (
              <div
                key={row}
                className="grid grid-cols-7 gap-4 border-b border-gray-800 px-6 py-5 last:border-b-0"
              >
                {Array.from({ length: 7 }, (_, column) => (
                  <Skeleton key={column} className="h-5 w-full" />
                ))}
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
