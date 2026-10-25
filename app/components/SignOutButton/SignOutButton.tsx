"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { authClient } from "@/app/lib/auth-client";

export default function SignOutButton() {
  const router = useRouter();
  const submitting = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function signOut() {
    if (submitting.current) return;

    submitting.current = true;
    setPending(true);
    setError("");

    try {
      const result = await authClient.signOut();

      if (result.error) {
        setError("Unable to sign out. Please try again.");
        return;
      }

      router.replace("/sign-in");
      router.refresh();
    } catch {
      setError("Unable to sign out. Please try again.");
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  return (
    <div className="text-right">
      <button
        type="button"
        onClick={signOut}
        disabled={pending}
        className="rounded-lg border border-gray-700 px-3 py-2 text-sm text-gray-300 transition-colors hover:border-gray-500 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-red-400 disabled:opacity-60"
      >
        {pending ? "Signing out..." : "Sign out"}
      </button>

      {error && (
        <p role="alert" className="mt-2 max-w-xs text-xs text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
