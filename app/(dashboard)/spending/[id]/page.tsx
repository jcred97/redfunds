import Link from "next/link";
import { notFound } from "next/navigation";
import { parseExpenseMonth } from "@/app/lib/expenses/date";
import { formatPesoAmount } from "@/app/lib/expenses/money";
import { getBankCatalogForExpenseGroup, getExpenseBankOptions } from "@/app/(dashboard)/_lib/banks/queries";
import {
  parseExpenseHistoryBankFilter,
  parseExpenseHistoryPaymentMethod,
} from "@/app/(dashboard)/_lib/expense-groups/access";
import ExpenseGroupBanks from "./_components/banks/ExpenseGroupBanks";
import ExpenseCategories from "./_components/categories/ExpenseCategories";
import ExpenseGroupSettings from "@/app/(dashboard)/_components/expense-groups/ExpenseGroupSettings";
import ExpenseGroupSwitcher from "@/app/(dashboard)/_components/expense-groups/ExpenseGroupSwitcher";
import ExpenseHistory from "./_components/expenses/ExpenseHistory";
import ExpenseHistoryFilters from "./_components/expenses/ExpenseHistoryFilters";
import NewCategoryButton from "./_components/categories/NewCategoryButton";
import NewExpenseButton from "./_components/expenses/NewExpenseButton";
import {
  getExpenseGroupById,
  getExpenseGroupOptions,
  getExpenseHistoryBankOptionsByExpenseGroupId,
  getExpensePageByExpenseGroupId,
} from "@/app/(dashboard)/_lib/expense-groups/queries";

export default async function ExpenseGroupPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    tab?: string | string[];
    page?: string | string[];
    month?: string | string[];
    category?: string | string[];
    paymentMethod?: string | string[];
    bank?: string | string[];
  }>;
}) {
  const [{ id: rawId }, { tab, page: rawPage, month: rawMonth, category, paymentMethod: rawMethod, bank: rawBank }] =
    await Promise.all([params, searchParams]);
  const id = Number(rawId);
  const showCategories = tab === "categories";
  const showBanks = tab === "banks";
  const showExpenses = !showCategories && !showBanks;
  const requestedPage = typeof rawPage === "string" && /^[1-9]\d*$/.test(rawPage)
    ? Number(rawPage)
    : 1;
  const month = parseExpenseMonth(rawMonth);
  const requestedCategory = typeof category === "string" && /^[1-9]\d{0,9}$/.test(category)
    ? Number(category)
    : undefined;
  const categoryId = requestedCategory !== undefined && requestedCategory <= 2_147_483_647
    ? requestedCategory
    : undefined;
  const paymentMethod = parseExpenseHistoryPaymentMethod(rawMethod);
  const bank = parseExpenseHistoryBankFilter(rawBank);
  const bankFilterValue = bank && typeof rawBank === "string" ? rawBank : undefined;
  const filters = { month, categoryId, paymentMethod, bank };
  const filterParams = new URLSearchParams();
  if (month !== undefined) filterParams.set("month", month);
  if (categoryId !== undefined) filterParams.set("category", String(categoryId));
  if (paymentMethod !== undefined) filterParams.set("paymentMethod", paymentMethod);
  if (bankFilterValue !== undefined) filterParams.set("bank", bankFilterValue);
  const filterQuery = filterParams.toString();

  const [expenseGroup, groups, expensePage, bankCatalog, bankOptions, historyBankOptions] = await Promise.all([
    getExpenseGroupById(id),
    getExpenseGroupOptions(),
    showExpenses ? getExpensePageByExpenseGroupId(id, requestedPage, filters) : null,
    showBanks ? getBankCatalogForExpenseGroup(id) : null,
    showExpenses ? getExpenseBankOptions(id) : [],
    showExpenses ? getExpenseHistoryBankOptionsByExpenseGroupId(id) : [],
  ]);

  if (!expenseGroup || (showExpenses && !expensePage) || (showBanks && !bankCatalog)) {
    notFound();
  }

  const groupPath = `/spending/${expenseGroup.id}`;
  const categoriesTab = "?tab=categories";
  const banksTab = "?tab=banks";
  const tabSuffix = showBanks ? banksTab : showCategories ? categoriesTab : "";
  const currentGroup = { id: expenseGroup.id, name: expenseGroup.name };
  const categoryOptions = expenseGroup.categories.map(({ id, name }) => ({ id, name }));

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-6 text-white">
      <header className="pt-6">
        <div className="flex items-center justify-between gap-4">
          <ExpenseGroupSwitcher
            key={`switcher-${expenseGroup.id}`}
            currentGroup={currentGroup}
            groups={groups}
            tabSuffix={tabSuffix}
          />
          <ExpenseGroupSettings key={`settings-${expenseGroup.id}`} group={currentGroup} tabSuffix={tabSuffix} />
        </div>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-1 border-b border-gray-800 sm:mt-6 sm:gap-4">
          <nav aria-label="Expense group views" className="flex flex-wrap">
            {[
              { label: "Expenses", href: groupPath, current: showExpenses },
              { label: "Categories", href: groupPath + categoriesTab, current: showCategories },
              { label: "Banks", href: groupPath + banksTab, current: showBanks },
            ].map(({ label, href, current }) => (
              <Link
                key={label}
                href={href}
                aria-current={current ? "page" : undefined}
                className={`-mb-px border-b-2 px-2.5 py-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-red-400 sm:px-4 ${current ? "border-red-500 text-white" : "border-transparent text-gray-400 hover:text-white"}`}
              >
                {label}
              </Link>
            ))}
          </nav>
          {!showBanks && (
            <div className="ml-auto min-w-0 pb-2 [&_button]:ml-auto [&_button]:whitespace-nowrap [&_p]:text-right max-sm:[&_button]:px-2.5 max-sm:[&_button]:text-xs">
              {showCategories ? (
                <NewCategoryButton expenseGroupId={expenseGroup.id} />
              ) : (
                <NewExpenseButton expenseGroupId={expenseGroup.id} categories={categoryOptions} bankOptions={bankOptions} />
              )}
            </div>
          )}
        </div>
      </header>

      <main className="py-6 sm:py-8">
        {expensePage ? (
          <>
            <ExpenseHistoryFilters
              key={`${expenseGroup.id}:${filterQuery}:${expensePage.page}`}
              groupPath={groupPath}
              categories={categoryOptions}
              banks={historyBankOptions}
              month={month}
              categoryId={categoryId}
              paymentMethod={paymentMethod}
              bank={bankFilterValue}
            />
            <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
                <p className="mb-1 text-sm text-gray-400">Total Spent</p>
                <p className="text-2xl font-bold">
                  {formatPesoAmount(expensePage.totalCentavos)}
                </p>
              </div>
              <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
                <p className="mb-1 text-sm text-gray-400">Expenses</p>
                <p className="text-2xl font-bold">{expensePage.totalExpenses}</p>
              </div>
              <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
                <p className="mb-1 text-sm text-gray-400">Group categories</p>
                <p className="text-2xl font-bold">{expenseGroup.categories.length}</p>
              </div>
            </div>

            {expensePage.totalExpenses === 0 ? (
              <div className="flex flex-col items-center justify-center py-32 text-center">
                <div className="mb-4 flex size-16 items-center justify-center rounded-full border border-gray-800 bg-gray-900">
                  <span className="text-2xl">💸</span>
                </div>
                <h2 id="expense-history-title" tabIndex={-1} className="font-medium text-gray-300">
                  {filterQuery ? "No expenses match these filters" : "No expenses yet"}
                </h2>
                {!filterQuery && (
                  <p className="mt-1 text-sm text-gray-500">
                    {categoryOptions.length === 0
                      ? "Add a category in the Categories tab to start recording expenses."
                      : "Click + New Expense to add your first expense."}
                  </p>
                )}
              </div>
            ) : (
              <ExpenseHistory
                expenseGroupId={expenseGroup.id}
                categories={categoryOptions}
                bankOptions={bankOptions}
                expenses={expensePage.expenses}
                page={expensePage.page}
                totalPages={expensePage.totalPages}
                filterQuery={filterQuery}
              />
            )}
          </>
        ) : bankCatalog ? (
          <ExpenseGroupBanks key={expenseGroup.id} expenseGroupId={expenseGroup.id} banks={bankCatalog} />
        ) : (
          <ExpenseCategories expenseGroupId={expenseGroup.id} categories={expenseGroup.categories} />
        )}
      </main>
    </div>
  );
}
