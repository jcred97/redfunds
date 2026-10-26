"use client";

import { authClient } from "@/app/lib/auth-client";

export default function SessionRefresh() {
  // Mount Better Auth's browser checks so renewed cookies reach the browser.
  authClient.useSession();

  return null;
}
