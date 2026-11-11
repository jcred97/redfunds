import type { BankCatalogEntry } from "@/app/(dashboard)/_lib/banks/access";
import BankSettingsDialog from "./BankSettingsDialog";

export default function ExpenseGroupBanks({
  expenseGroupId,
  banks,
}: {
  expenseGroupId: number;
  banks: BankCatalogEntry[];
}) {
  return (
    <section aria-labelledby="banks-title">
      <h2 id="banks-title" className="mb-4 text-lg font-semibold">Banks</h2>
      {banks.length === 0 ? (
        <p className="rounded-xl border border-gray-800 bg-gray-900 p-5 text-sm text-gray-400">
          No banks are available.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {banks.map((bank) => (
            <li key={bank.id} className="min-w-0">
              <BankSettingsDialog expenseGroupId={expenseGroupId} bank={bank} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
