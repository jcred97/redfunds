"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import NewExpenseGroupButton from "@/app/(dashboard)/_components/expense-groups/NewExpenseGroupButton";

type ExpenseGroupOption = { id: number; name: string };

export default function ExpenseGroupSwitcher({
  currentGroup,
  groups,
  tabSuffix,
}: {
  currentGroup: ExpenseGroupOption;
  groups: ExpenseGroupOption[];
  tabSuffix: string;
}) {
  const panelId = useId();
  const switcherRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    function closeOnOutsideClick(event: PointerEvent) {
      if (
        event.target instanceof Element &&
        !switcherRef.current?.contains(event.target) &&
        !event.target.closest("dialog")
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [open]);

  function closeAndFocusTrigger() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  return (
    <div
      ref={switcherRef}
      className="relative w-fit max-w-full"
      onBlur={(event) => {
        const next = event.relatedTarget;
        // The create dialog is rendered in a portal and returns focus to its trigger.
        if (next && !event.currentTarget.contains(next) && !next.closest("dialog")) {
          setOpen(false);
        }
      }}
      onKeyDown={(event) => {
        if (open && event.key === "Escape" && event.currentTarget.contains(event.target as Node)) {
          event.stopPropagation();
          closeAndFocusTrigger();
        }
      }}
    >
      <h1 id="expense-group-title" tabIndex={-1} className="text-2xl font-bold tracking-tight sm:text-3xl">
        <button
          ref={triggerRef}
          type="button"
          aria-label={`${currentGroup.name}, switch expense group`}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen(!open)}
          className="inline-flex max-w-full cursor-pointer items-center gap-2 rounded-sm text-left hover:text-gray-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-red-400"
        >
          <span className="min-w-0 wrap-anywhere">{currentGroup.name}</span>
          <svg
            aria-hidden="true"
            viewBox="0 0 16 16"
            fill="none"
            className={`size-4 shrink-0 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
          >
            <path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </h1>

      <div
        id={panelId}
        hidden={!open}
        className="absolute top-full left-0 z-10 mt-2 w-64 max-w-[calc(100vw-3rem)] overflow-hidden rounded-lg border border-gray-200 bg-white text-gray-900 shadow-xl"
      >
        <nav aria-label="Switch expense group">
          <Link
            href="/"
            onNavigate={closeAndFocusTrigger}
            className="block py-3 pr-4 pl-10 text-sm hover:bg-gray-100 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-red-600"
          >
            All expense groups
            <span className="mt-0.5 block text-xs text-gray-600">
              {groups.length} {groups.length === 1 ? "group" : "groups"}
            </span>
          </Link>
          <ul className="max-h-60 overflow-y-auto overscroll-contain">
            {groups.map((group) => {
              const selected = group.id === currentGroup.id;
              return (
                <li key={group.id}>
                  <Link
                    href={`/spending/${group.id}${tabSuffix}`}
                    prefetch={false}
                    aria-current={selected ? "page" : undefined}
                    onNavigate={closeAndFocusTrigger}
                    className={`flex items-start gap-2 px-4 py-2.5 text-sm hover:bg-gray-100 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-red-600 ${selected ? "bg-red-50 font-semibold" : ""}`}
                  >
                    <span aria-hidden="true" className="w-4 shrink-0 text-red-600">
                      {selected && "✓"}
                    </span>
                    <span className="min-w-0 wrap-anywhere">{group.name}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="border-t border-gray-200 py-1">
          <NewExpenseGroupButton inSwitcher />
        </div>
      </div>
    </div>
  );
}
