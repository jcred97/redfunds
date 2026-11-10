import ExpenseGroups from "./(dashboard)/_home/expense-groups/ExpenseGroups";
import { requireUser } from "@/app/lib/auth/session";

export default async function Home() {
  await requireUser();

  return <ExpenseGroups />;
}
