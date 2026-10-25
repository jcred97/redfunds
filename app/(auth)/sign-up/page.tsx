import { redirect } from "next/navigation";
import { getCurrentUser } from "@/app/lib/session";
import AuthForm from "../_components/AuthForm";

export default async function SignUpPage() {
  if (await getCurrentUser()) redirect("/");

  return <AuthForm mode="sign-up" />;
}
