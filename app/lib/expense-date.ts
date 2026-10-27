/** Expense dates are calendar dates stored at UTC midnight, not payment instants. */
export function parseExpenseDate(value: unknown): Date {
  if (typeof value !== "string") {
    throw new TypeError("Enter a valid expense date.");
  }

  const calendarDate = value.trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(calendarDate) || calendarDate.startsWith("0000-")) {
    throw new TypeError("Enter a valid expense date.");
  }

  const date = new Date(`${calendarDate}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== calendarDate) {
    throw new TypeError("Enter a valid expense date.");
  }

  return date;
}

/** Use the Philippine calendar day for the new-expense form's default. */
export function getManilaToday(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const year = parts.find((part) => part.type === "year")!.value;
  const month = parts.find((part) => part.type === "month")!.value;
  const day = parts.find((part) => part.type === "day")!.value;

  return `${year}-${month}-${day}`;
}

/** Keep the stored calendar day unchanged across browser/server time zones. */
export function formatExpenseDate(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;

  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}
