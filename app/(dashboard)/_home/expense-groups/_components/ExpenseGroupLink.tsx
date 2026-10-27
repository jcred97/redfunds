"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition, type ReactNode } from "react";
import LoadingScreen from "@/app/components/LoadingScreen/LoadingScreen";
import { useExpenseGroupLoading } from "@/app/components/ExpenseGroupLoading/ExpenseGroupLoading";

export default function ExpenseGroupLink({
  id,
  name,
  children,
}: {
  id: number;
  name: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const { selectGroup } = useExpenseGroupLoading();
  const [pending, startNavigation] = useTransition();
  const href = `/spending/${id}`;

  return (
    <>
      <Link
        href={href}
        aria-disabled={pending}
        onNavigate={(event) => {
          event.preventDefault();

          if (pending) {
            return;
          }

          selectGroup({ id, name });
          startNavigation(() => router.push(href));
        }}
      >
        {children}
      </Link>
      {pending && <LoadingScreen message={`Loading ${name}...`} />}
    </>
  );
}
