/** Largest amount supported by PostgreSQL's signed Int column, in centavos. */
export const MAX_AMOUNT_CENTAVOS = 2_147_483_647;

/** Parse pesos without floating-point arithmetic. Extra decimal places are rejected. */
export function parsePesoAmount(value: string): number {
  if (typeof value !== "string") {
    throw new TypeError("Enter an amount as a decimal string.");
  }

  const amount = value.trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(amount)) {
    throw new Error("Enter a positive peso amount with at most two decimal places.");
  }

  const [pesos, fractional = ""] = amount.split(".");
  const centavos = BigInt(pesos) * BigInt(100) + BigInt(fractional.padEnd(2, "0"));
  if (centavos <= BigInt(0)) {
    throw new RangeError("Amount must be greater than zero.");
  }
  if (centavos > BigInt(MAX_AMOUNT_CENTAVOS)) {
    throw new RangeError("Amount must not exceed ₱21,474,836.47.");
  }

  return Number(centavos);
}

function assertCentavos(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError("Centavos must be a nonnegative safe integer.");
  }
}

/** Format saved centavos for an editable peso field, without grouping or symbols. */
export function formatPesoInput(amountCentavos: number): string {
  assertCentavos(amountCentavos);
  const value = BigInt(amountCentavos);
  const pesos = value / BigInt(100);
  const fraction = (value % BigInt(100)).toString().padStart(2, "0");

  return `${pesos}.${fraction}`;
}

/** Format integer centavos exactly, including totals above a single amount's limit. */
export function formatPesoAmount(amountCentavos: number): string {
  assertCentavos(amountCentavos);
  const value = BigInt(amountCentavos);
  const pesos = (value / BigInt(100)).toLocaleString("en-PH");
  const fraction = (value % BigInt(100)).toString().padStart(2, "0");
  return `₱${pesos}.${fraction}`;
}

/** Sum centavos without silently losing precision in large totals. */
export function sumCentavos(amounts: Iterable<number>): number {
  let total = 0;
  for (const amount of amounts) {
    assertCentavos(amount);
    if (amount > Number.MAX_SAFE_INTEGER - total) {
      throw new RangeError("The total exceeds the safe integer limit for centavos.");
    }
    total += amount;
  }
  return total;
}
