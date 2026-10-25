import type { ReactNode } from "react";
import { requireUser } from "@/app/lib/session";
import SignOutButton from "@/app/components/SignOutButton/SignOutButton";

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
          <SignOutButton />
        </div>
      </div>
      {children}
    </>
  );
}
