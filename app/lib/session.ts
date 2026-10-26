import "server-only";

import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./auth";

// React cache is scoped to a render request, never a shared user/session cache.
export const getCurrentUser = cache(async () => {
  const session = await auth.api.getSession({
    headers: await headers(),
    // Server rendering cannot send renewed cookies; the browser handles renewal.
    query: { disableRefresh: true },
  });

  return session?.user ?? null;
});

export async function requireUser() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/sign-in");
  }

  return user;
}

export async function requireUserId(): Promise<string> {
  return (await requireUser()).id;
}
