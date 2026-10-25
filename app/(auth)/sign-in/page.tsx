import { redirect } from "next/navigation";
import { getCurrentUser } from "@/app/lib/session";
import AuthForm from "../_components/AuthForm";

export default async function SignInPage() {
  if (await getCurrentUser()) redirect("/");

  return <AuthForm mode="sign-in" />;
}
