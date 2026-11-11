import Form from "next/form";
import Link from "next/link";

type ExpenseHistoryFiltersProps = {
  groupPath: string;
  categories: { id: number; name: string }[];
  month?: string;
  categoryId?: number;
};

const fieldClass = "mt-1 block h-10 w-full min-w-0 rounded-lg border border-gray-700 bg-gray-800 px-3 text-base text-white [color-scheme:dark] focus-visible:outline-2 focus-visible:outline-red-400 sm:text-sm";

export default function ExpenseHistoryFilters({
  groupPath,
  categories,
  month,
  categoryId,
}: ExpenseHistoryFiltersProps) {
  const categoryUnavailable =
    categoryId !== undefined && !categories.some((category) => category.id === categoryId);

  return (
    <Form
      action={groupPath}
      aria-label="Expense history filters"
      prefetch={false}
      className="mb-4 grid grid-cols-1 gap-3 rounded-xl border border-gray-800 bg-gray-900 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end"
    >
      <label className="min-w-0 text-sm text-gray-300">
        Month
        <input
          type="month"
          name="month"
          defaultValue={month ?? ""}
          min="0001-01"
          max="9999-12"
          pattern="[0-9]{4}-(0[1-9]|1[0-2])"
          placeholder="YYYY-MM"
          className={fieldClass}
        />
      </label>
      <label className="min-w-0 text-sm text-gray-300">
        Category
        <select name="category" defaultValue={categoryId ?? ""} className={fieldClass}>
          <option value="">All categories</option>
          {categoryUnavailable && <option value={categoryId}>Unavailable category</option>}
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          className="h-10 cursor-pointer rounded-lg border border-gray-700 px-3 text-sm font-medium text-white hover:bg-gray-800 focus-visible:outline-2 focus-visible:outline-red-400"
        >
          Apply filters
        </button>
        {(month || categoryId !== undefined) && (
          <Link href={groupPath} className="text-sm text-gray-300 underline hover:text-white">
            Clear filters
          </Link>
        )}
      </div>
    </Form>
  );
}
