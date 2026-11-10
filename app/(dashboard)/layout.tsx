import type { ReactNode } from "react";
import { requireUser } from "@/app/lib/auth/session";
import AccountMenu from "@/app/components/auth/AccountMenu";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await requireUser();

  return (
    <>
      <div className="border-b border-gray-800 bg-gray-950 px-6 py-3 text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <p
            className="min-w-0 truncate text-sm text-gray-400"
            title={user.email}
          >
            {user.name || user.email}
          </p>
          <AccountMenu name={user.name} email={user.email} />
        </div>
      </div>
      {children}
    </>
  );
}
