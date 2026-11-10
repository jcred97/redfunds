import Link from "next/link";
import type { ReactNode } from "react";

export default function ExpenseGroupLink({
  id,
  children,
}: {
  id: number;
  children: ReactNode;
}) {
  return (
    <Link href={`/spending/${id}`} className="relative block">
      {children}
    </Link>
  );
}
