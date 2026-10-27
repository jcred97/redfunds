"use client";

import { usePathname } from "next/navigation";
import LoadingScreen from "@/app/components/LoadingScreen/LoadingScreen";
import { useExpenseGroupLoading } from "@/app/components/ExpenseGroupLoading/ExpenseGroupLoading";

export default function Loading() {
  const pathname = usePathname();
  const { selectedGroup } = useExpenseGroupLoading();
  let message = "Loading...";

  if (selectedGroup && pathname === `/spending/${selectedGroup.id}`) {
    message = `Loading ${selectedGroup.name}...`;
  }

  return <LoadingScreen message={message} />;
}
