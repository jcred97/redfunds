import Skeleton from "@/app/components/feedback/Skeleton";

export default function ExpenseGroupSkeleton() {
  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-6 text-white">
      <p role="status" className="sr-only">
        Loading expense group...
      </p>

      <header className="pt-6" aria-hidden="true">
        <div className="flex items-center justify-between gap-4">
          <Skeleton className="h-8 w-44 sm:h-9 sm:w-52" />
          <Skeleton className="h-6 w-20 shrink-0" />
        </div>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-1 border-b border-gray-800 sm:mt-6 sm:gap-4">
          <div className="flex flex-wrap text-sm font-medium text-gray-400">
            <span className="px-2.5 py-3 sm:px-4">Expenses</span>
            <span className="px-2.5 py-3 sm:px-4">Categories</span>
            <span className="px-2.5 py-3 sm:px-4">Banks</span>
          </div>
          <div className="ml-auto pb-2">
            <Skeleton className="h-8 w-24 rounded-lg sm:h-9 sm:w-32" />
          </div>
        </div>
      </header>

      <main className="py-6 sm:py-8">
        <div
          aria-hidden="true"
          className="mb-4 grid grid-cols-1 gap-3 rounded-xl border border-gray-800 bg-gray-900 p-4 sm:grid-cols-2 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto] lg:items-end"
        >
          {["w-12", "w-16", "w-24", "w-10"].map((width) => (
            <div key={width}>
              <Skeleton className={`h-5 ${width}`} />
              <Skeleton className="mt-1 h-10 w-full rounded-lg" />
            </div>
          ))}
          <Skeleton className="h-10 w-28 rounded-lg sm:col-span-2 lg:col-span-1" />
        </div>
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {["Total Spent", "Expenses", "Group categories"].map((label) => (
            <div
              key={label}
              className="rounded-xl border border-gray-800 bg-gray-900 p-5"
            >
              <p className="mb-1 text-sm text-gray-400">{label}</p>
              <Skeleton className="h-8 w-28" />
            </div>
          ))}
        </div>

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
