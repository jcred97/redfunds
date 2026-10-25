import assert from "node:assert/strict";
import test from "node:test";
import { formatPesoAmount, MAX_AMOUNT_CENTAVOS, parsePesoAmount, sumCentavos } from "../../app/lib/money";

test("peso inputs become exact centavos and totals", () => {
  assert.equal(parsePesoAmount("150.75"), 15075);
  assert.equal(parsePesoAmount(" 0001.5 "), 150);
  assert.equal(parsePesoAmount("1"), 100);
  assert.equal(parsePesoAmount("0.01"), 1);
  assert.equal(sumCentavos([parsePesoAmount("0.10"), parsePesoAmount("0.20")]), 30);
  assert.equal(formatPesoAmount(30), "₱0.30");
});

test("single expense limits preserve every centavo", () => {
  assert.equal(parsePesoAmount("21474836.47"), MAX_AMOUNT_CENTAVOS);
  assert.throws(() => parsePesoAmount("21474836.48"), /must not exceed/);
  assert.throws(() => parsePesoAmount("9".repeat(200)), /must not exceed/);
  for (const value of ["0", "0.00", "000.0"]) {
    assert.throws(() => parsePesoAmount(value), /greater than zero/);
  }
});

test("reject ambiguous or invalid input instead of rounding", () => {
  for (const value of ["", " ", "-0", "-1", "+1", "1e2", "Infinity", "NaN", "1,000", "₱1", ".50", "1.", "1.001", "1.000", "1 00", "1\n.00"]) {
    assert.throws(() => parsePesoAmount(value), /positive peso amount/, value);
  }
  assert.throws(() => parsePesoAmount(1 as unknown as string), TypeError);
});

test("formats zero, grouping, and large aggregate totals exactly", () => {
  assert.equal(formatPesoAmount(0), "₱0.00");
  assert.equal(formatPesoAmount(1), "₱0.01");
  assert.equal(formatPesoAmount(123456), "₱1,234.56");
  assert.equal(formatPesoAmount(MAX_AMOUNT_CENTAVOS), "₱21,474,836.47");
  assert.equal(formatPesoAmount(Number.MAX_SAFE_INTEGER), "₱90,071,992,547,409.91");
});

test("aggregate totals support multiple maximum expenses and reject unsafe values", () => {
  assert.equal(sumCentavos([]), 0);
  assert.equal(sumCentavos([MAX_AMOUNT_CENTAVOS, MAX_AMOUNT_CENTAVOS]), 4294967294);
  assert.equal(sumCentavos([Number.MAX_SAFE_INTEGER - 1, 1]), Number.MAX_SAFE_INTEGER);
  assert.throws(() => sumCentavos([Number.MAX_SAFE_INTEGER, 1]), /total exceeds/);
  for (const value of [-1, 0.1, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => sumCentavos([value]), /nonnegative safe integer/);
    assert.throws(() => formatPesoAmount(value), /nonnegative safe integer/);
  }
});
