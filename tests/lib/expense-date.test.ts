import assert from "node:assert/strict";
import test from "node:test";
import {
  formatExpenseDate,
  getManilaToday,
  parseExpenseDate,
} from "../../app/lib/expense-date";

test("expense calendar dates are exact UTC-midnight values, including leap days", () => {
  for (const [input, expected] of [
    ["2026-10-27", "2026-10-27T00:00:00.000Z"],
    ["2024-02-29", "2024-02-29T00:00:00.000Z"],
    [" 2026-01-01 ", "2026-01-01T00:00:00.000Z"],
    ["0001-01-01", "0001-01-01T00:00:00.000Z"],
  ]) {
    assert.equal(parseExpenseDate(input).toISOString(), expected);
  }
});

test("invalid or rolled-over calendar dates are rejected", () => {
  for (const value of [
    null,
    new Date(),
    "",
    "2026-02-29",
    "2026-04-31",
    "2026-00-01",
    "2026-13-01",
    "2026-01-00",
    "2026-1-1",
    "0000-01-01",
    "2026-10-27T00:00:00Z",
    "2026-10-27 trailing text",
  ]) {
    assert.throws(
      () => parseExpenseDate(value),
      /^TypeError: Enter a valid expense date\.$/,
    );
  }
});

test("new expense defaults follow Manila's day and year boundaries", () => {
  assert.equal(getManilaToday(new Date("2026-10-27T15:59:59Z")), "2026-10-27");
  assert.equal(getManilaToday(new Date("2026-10-27T16:00:00Z")), "2026-10-28");
  assert.equal(getManilaToday(new Date("2026-12-31T16:00:00Z")), "2027-01-01");
});

test("expense display preserves the stored calendar day", () => {
  const date = parseExpenseDate("2026-01-01");
  assert.equal(formatExpenseDate(date), "Jan 1, 2026");
  assert.equal(formatExpenseDate(date.toISOString()), "Jan 1, 2026");
});
