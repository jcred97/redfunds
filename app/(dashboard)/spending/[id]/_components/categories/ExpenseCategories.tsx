import CategoryActions from "./CategoryActions";

export default function ExpenseCategories({
  expenseGroupId,
  categories,
}: {
  expenseGroupId: number;
  categories: {
    id: number;
    name: string;
    icon: string | null;
    _count: { expenses: number };
  }[];
}) {
  return (
    <section aria-labelledby="categories-title">
      <h2 id="categories-title" className="mb-4 text-lg font-semibold">
        Categories
      </h2>
      {categories.length === 0 ? (
        <p className="rounded-xl border border-gray-800 bg-gray-900 p-5 text-sm text-gray-400">
          No categories yet. Add one such as Food or Transport.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => (
            <li
              key={category.id}
              className="min-w-0 rounded-lg border border-gray-800 bg-gray-900 px-4 py-3 text-sm"
            >
              <h3 className="wrap-anywhere font-medium">
                {category.icon && <span aria-hidden="true">{category.icon} </span>}
                {category.name}
              </h3>
              <p className="mt-1 text-gray-400">
                {category._count.expenses} {category._count.expenses === 1 ? "expense" : "expenses"}
              </p>
              <CategoryActions
                expenseGroupId={expenseGroupId}
                category={{ id: category.id, name: category.name }}
                expenseCount={category._count.expenses}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
