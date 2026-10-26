"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { authClient } from "@/app/lib/auth-client";
import LoadingScreen from "@/app/components/LoadingScreen/LoadingScreen";

export default function SignOutButton() {
  const router = useRouter();
  const submitting = useRef(false);
  const [authPending, setAuthPending] = useState(false);
  const [redirecting, startNavigation] = useTransition();
  const [error, setError] = useState("");
  const pending = authPending || redirecting;

  async function signOut() {
    if (submitting.current || pending) return;

    submitting.current = true;
    setAuthPending(true);
    setError("");

    try {
      const result = await authClient.signOut();

      if (result.error) {
        setError("Unable to sign out. Please try again.");
        return;
      }

      // Keep loading visible while the sign-in page is being loaded.
      startNavigation(() => {
        router.replace("/sign-in");
        router.refresh();
      });
    } catch {
      setError("Unable to sign out. Please try again.");
    } finally {
      submitting.current = false;
      setAuthPending(false);
    }
  }

  return (
    <>
      <div className="text-right" inert={pending} aria-hidden={pending}>
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

      {pending && <LoadingScreen message="Signing out..." />}
    </>
  );
}
