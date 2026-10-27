"use client";

import Link, { useLinkStatus } from "next/link";
import type { ReactNode } from "react";

function NavigationStatus({ name }: { name: string }) {
  const { pending } = useLinkStatus();

  return (
    <span
      role="status"
      className="pointer-events-none absolute bottom-1 left-6 right-6 h-4 truncate text-xs text-gray-400"
    >
      {pending && `Opening ${name}...`}
    </span>
  );
}

export default function ExpenseGroupLink({
  id,
  name,
  children,
}: {
  id: number;
  name: string;
  children: ReactNode;
}) {
  return (
    <Link href={`/spending/${id}`} className="relative block">
      {children}
      <NavigationStatus name={name} />
    </Link>
  );
}
