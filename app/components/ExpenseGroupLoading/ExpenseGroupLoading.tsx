"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

type ExpenseGroupTarget = { id: number; name: string };

const ExpenseGroupLoadingContext = createContext<{
  selectedGroup: ExpenseGroupTarget | null;
  selectGroup: (group: ExpenseGroupTarget) => void;
} | null>(null);

export function ExpenseGroupLoadingProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [previousPathname, setPreviousPathname] = useState(pathname);
  const [selectedGroup, setSelectedGroup] = useState<ExpenseGroupTarget | null>(null);

  // Keep the selected name through navigation, then forget it when leaving that group.
  if (pathname !== previousPathname) {
    setPreviousPathname(pathname);

    if (selectedGroup && pathname !== `/spending/${selectedGroup.id}`) {
      setSelectedGroup(null);
    }
  }

  return (
    <ExpenseGroupLoadingContext.Provider
      value={{ selectedGroup, selectGroup: setSelectedGroup }}
    >
      {children}
    </ExpenseGroupLoadingContext.Provider>
  );
}

export function useExpenseGroupLoading() {
  const context = useContext(ExpenseGroupLoadingContext);

  if (!context) {
    throw new Error("Expense-group loading requires ExpenseGroupLoadingProvider.");
  }

  return context;
}
