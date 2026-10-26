"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useRef,
  useState,
  useTransition,
  ViewTransition,
  type FormEvent,
} from "react";
import { authClient } from "@/app/lib/auth-client";
import LoadingScreen from "@/app/components/LoadingScreen/LoadingScreen";

export default function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  const router = useRouter();
  const submitting = useRef(false);
  const [authPending, setAuthPending] = useState(false);
  const [redirecting, startNavigation] = useTransition();
  const [error, setError] = useState("");
  const signingUp = mode === "sign-up";
  const pending = authPending || redirecting;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submitting.current || pending) return;

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const name = String(formData.get("name") ?? "").trim();

    setError("");

    if (signingUp && !name) {
      setError("Enter your name.");
      return;
    }

    if (signingUp && password !== formData.get("confirmPassword")) {
      setError("Your passwords do not match.");
      return;
    }

    submitting.current = true;
    setAuthPending(true);

    try {
      const result = signingUp
        ? await authClient.signUp.email({
            name,
            email,
            password,
            callbackURL: "/",
          })
        : await authClient.signIn.email({
            email,
            password,
            callbackURL: "/",
          });

      if (result.error) {
        setError(
          result.error.status === 429
            ? "Too many attempts. Please wait a moment and try again."
            : signingUp
              ? "We could not create your account. Check your details, or sign in if you already have an account."
              : "Unable to sign in. Check your email and password. If you have not registered yet, create an account first."
        );

        return;
      }

      // Track navigation separately so loading continues after the auth response.
      startNavigation(() => {
        router.replace("/");
        router.refresh();
      });
    } catch {
      setError("Unable to connect. Please try again.");
    } finally {
      submitting.current = false;
      setAuthPending(false);
    }
  }

  const inputClass =
    "mt-2 w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-white outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/30 disabled:opacity-60";

  const loadingMessage = redirecting
    ? "Opening your expense groups..."
    : signingUp
      ? "Creating your account..."
      : "Signing in...";

  return (
    <ViewTransition
      key={mode}
      name="auth-page"
      share="auth-page-fade"
      enter="auth-page-fade"
      default="none"
    >
      <main className="flex min-h-screen items-center justify-center bg-gray-950 px-6 py-12 text-white">
        <section
          inert={pending}
          aria-hidden={pending}
          className="w-full max-w-md rounded-2xl border border-gray-800 bg-gray-900 p-6 sm:p-8"
          aria-labelledby="auth-title"
        >
          <p className="mb-8 text-xl font-bold tracking-tight">
            Red<span className="text-red-500">Funds</span>
          </p>

          <h1 id="auth-title" className="text-2xl font-semibold">
            {signingUp ? "Create your account" : "Sign in to RedFunds"}
          </h1>

          <p className="mt-2 text-sm text-gray-400">
            {signingUp
              ? "Keep your expense groups and spending in one private place."
              : "Use the email and password you registered with."}
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5" aria-busy={pending}>
            <fieldset disabled={pending} className="space-y-5">
              {signingUp && (
                <div>
                  <label htmlFor="name" className="text-sm font-medium">
                    Name
                  </label>
                  <input
                    id="name"
                    name="name"
                    autoComplete="name"
                    required
                    maxLength={100}
                    className={inputClass}
                  />
                </div>
              )}

              <div>
                <label htmlFor="email" className="text-sm font-medium">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  maxLength={254}
                  className={inputClass}
                />
              </div>

              <div>
                <label htmlFor="password" className="text-sm font-medium">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete={signingUp ? "new-password" : "current-password"}
                  required
                  minLength={signingUp ? 12 : undefined}
                  maxLength={128}
                  aria-describedby={signingUp ? "password-help" : undefined}
                  className={inputClass}
                />
                {signingUp && (
                  <p id="password-help" className="mt-2 text-xs text-gray-400">
                    Use 12 to 128 characters.
                  </p>
                )}
              </div>

              {signingUp && (
                <div>
                  <label htmlFor="confirm-password" className="text-sm font-medium">
                    Confirm password
                  </label>
                  <input
                    id="confirm-password"
                    name="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={12}
                    maxLength={128}
                    className={inputClass}
                  />
                </div>
              )}
            </fieldset>

            {error && (
              <p
                role="alert"
                className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300"
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={pending}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-500 px-4 py-3 font-medium text-white transition-colors hover:bg-red-600 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-red-400 disabled:cursor-wait disabled:opacity-60"
            >
              {signingUp ? "Create account" : "Sign in"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-400">
            {signingUp ? "Already have an account? " : "Don't have an account? "}
            <Link
              href={signingUp ? "/sign-in" : "/sign-up"}
              aria-disabled={pending}
              tabIndex={pending ? -1 : undefined}
              onClick={(event) => {
                if (pending) event.preventDefault();
              }}
              className="font-medium text-red-400 underline-offset-4 hover:underline aria-disabled:pointer-events-none aria-disabled:opacity-50"
            >
              {signingUp ? "Sign in" : "Create an account"}
            </Link>
          </p>
        </section>
        {pending && <LoadingScreen message={loadingMessage} />}
      </main>
    </ViewTransition>
  );
}
