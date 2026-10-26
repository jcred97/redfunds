"use client";

import { useEffect, useRef } from "react";
import LoadingSpinner from "@/app/components/LoadingSpinner/LoadingSpinner";

export default function LoadingScreen({ message }: { message: string }) {
  const screen = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previousFocus = document.activeElement;
    screen.current?.focus();

    return () => {
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus();
      }
    };
  }, []);

  return (
    <div
      ref={screen}
      role="dialog"
      aria-modal="true"
      aria-label="Please wait"
      tabIndex={-1}
      onKeyDown={(event) => {
        // This screen has no controls; keep keyboard focus here while waiting.
        if (event.key === "Tab") event.preventDefault();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950 px-6 text-white outline-none"
    >
      <div role="status" className="flex items-center gap-3 text-gray-300">
        <LoadingSpinner />
        <p>{message}</p>
      </div>
    </div>
  );
}
