export default function ExpenseGroupBanks({
  assignments,
}: {
  assignments: { id: number; active: boolean; bank: { name: string; active: boolean } }[];
}) {
  return (
    <section aria-labelledby="banks-title">
      <h2 id="banks-title" className="mb-4 text-lg font-semibold">Banks</h2>
      {assignments.length === 0 ? (
        <p className="rounded-xl border border-gray-800 bg-gray-900 p-5 text-sm text-gray-400">
          No banks have been added to this expense group.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {assignments.map(({ id, active, bank }) => (
            <li key={id} className="min-w-0 rounded-lg border border-gray-800 bg-gray-900 px-4 py-3 text-sm">
              <h3 className="wrap-anywhere font-medium">{bank.name}</h3>
              {(!active || !bank.active) && <p className="mt-1 text-gray-400">Inactive</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
