import Link from "next/link";
import type { ReactNode } from "react";
import AccountMenu from "@/app/components/auth/AccountMenu";
import { requireUser } from "@/app/lib/auth/session";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await requireUser();

  return (
    <>
      <header className="border-b border-gray-800 bg-gray-950 text-white">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-6 py-3 sm:gap-8">
          <Link
            href="/"
            className="shrink-0 rounded-sm text-lg font-bold tracking-tight focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-red-400 sm:text-xl"
          >
            Red<span className="text-red-500">Tally</span>
          </Link>
          <nav aria-label="Main navigation" className="mr-auto">
            <Link
              href="/"
              aria-current="location"
              className="inline-block rounded-sm py-2 text-sm font-semibold whitespace-nowrap text-white transition-colors hover:text-red-400 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-red-400"
            >
              Expense Group
            </Link>
          </nav>
          <AccountMenu name={user.name} email={user.email} />
        </div>
      </header>
      {children}
    </>
  );
}
