import { requireUser } from "@/app/lib/auth/session";
import ExpenseGroups from "./_home/expense-groups/ExpenseGroups";

export default async function Home() {
  await requireUser();

  return <ExpenseGroups />;
}
