"use client";

import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  sessionOptions: {
    // Recheck an existing session every five minutes while the app is open.
    refetchInterval: 5 * 60,
    refetchOnWindowFocus: true,
    refetchWhenOffline: false,
  },
});
