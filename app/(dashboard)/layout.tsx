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
      <header className="border-b border-gray-800 bg-gray-950 px-6 py-4 text-white">
        <nav
          aria-label="Main navigation"
          className="mx-auto flex max-w-6xl items-center justify-between gap-4"
        >
          <Link
            href="/"
            className="rounded-sm text-xl font-bold tracking-tight focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-red-400"
          >
            Red<span className="text-red-500">Funds</span>
          </Link>
          <AccountMenu name={user.name} email={user.email} />
        </nav>
      </header>
      {children}
    </>
  );
}
