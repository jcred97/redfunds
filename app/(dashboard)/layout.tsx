import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import AccountMenu from "@/app/components/auth/AccountMenu";
import { requireUser } from "@/app/lib/auth/session";
import redTallyLogo from "@/public/branding/redtally-logo.png";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await requireUser();

  return (
    <>
      <header className="border-b border-gray-800 bg-[#100d14] text-white">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-3 sm:gap-8 sm:px-6">
          <Link
            href="/"
            className="flex h-8 w-32 shrink-0 items-center justify-center overflow-hidden rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-red-400 sm:h-9 sm:w-40"
          >
            <Image
              src={redTallyLogo}
              alt="RedTally home"
              sizes="(min-width: 640px) 215px, 172px"
              loading="eager"
              className="h-auto w-[134%] max-w-none shrink-0"
            />
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
