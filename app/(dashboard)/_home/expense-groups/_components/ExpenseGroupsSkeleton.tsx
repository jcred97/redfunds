import Skeleton from "@/app/components/Skeleton/Skeleton";

export default function ExpenseGroupsSkeleton() {
  return (
    <>
      <p role="status" className="sr-only">
        Loading your expense groups...
      </p>

      <div
        aria-hidden="true"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        {Array.from({ length: 6 }, (_, index) => (
          <div
            key={index}
            className="rounded-xl border border-gray-800 bg-gray-900 p-6"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <Skeleton className="h-7 w-3/5" />
              <Skeleton className="h-6 w-14 rounded-full" />
            </div>
            <Skeleton className="mb-4 h-9 w-2/3" />
            <div className="flex gap-3">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-5 w-20" />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
